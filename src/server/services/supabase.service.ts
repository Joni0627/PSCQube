import { createClient } from "@supabase/supabase-js";
import { TABLE_ALIASES, getIdColumnAndKey, mapItemForSupabase, mapSupabaseRowToClient } from "../utils/mappings.js";
import { sanitizeColumnName } from "../utils/sanitizers.js";
import { formatSupabaseError, extractColumnFromError } from "../utils/helpers.js";
import { invalidateCache } from "../cache/cache.service.js";
import { TABLE_SCHEMAS } from "../schemas/tableSchemas.js";

let supabaseClient: any = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      // Auto-sanitize the URL to prevent /rest/v1/ invalid path errors
      supabaseUrl = supabaseUrl.trim();
      try {
        const parsed = new URL(supabaseUrl);
        supabaseUrl = `${parsed.protocol}//${parsed.host}`;
      } catch (e) {
        // Fallback regex sanitization
        supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
      }

      if (supabaseUrl.includes("/dashboard") || supabaseUrl.includes("/project/")) {
        console.error(`
🚨 [Supabase Configuration Error] 🚨
Your SUPABASE_URL is configured with the Dashboard/Studio URL: "${supabaseUrl}".
This is why you are receiving HTML elements instead of API responses.
Please update SUPABASE_URL to your Project API URL, which looks like: https://xxxx.supabase.co
--------------------------------------------------`);
        return null;
      }
      console.log(`[Supabase Service] Auto-initializing client for sanitized URL: ${supabaseUrl}`);
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn(`[Supabase Service] Missing SUPABASE_URL or SUPABASE_KEY. Supabase operations will be skipped.`);
    }
  }
  return supabaseClient;
}

export interface ReadOptions {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function readFromSupabase(tableName: string, options?: ReadOptions): Promise<any[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const table = tableName.toLowerCase();
  const tablesToTry = [table, ...(TABLE_ALIASES[table] || [])];
  if (table.endsWith("v2") && !tablesToTry.includes(table.slice(0, -2))) {
    tablesToTry.push(table.slice(0, -2));
  }

  for (const targetTable of tablesToTry) {
    try {
      let allData: any[] = [];
      let start = 0;
      const limit = 1000; // Supabase hard API limit per request
      let hasMore = true;
      let targetError = null;

      while (hasMore) {
        let query = supabase.from(targetTable).select("*");
        
        if (options?.date) {
          query = query.eq("fecha", options.date);
        } else if (options?.dateFrom && options?.dateTo) {
          query = query.gte("fecha", options.dateFrom).lte("fecha", options.dateTo);
        }
        
        const { data, error } = await query.range(start, start + limit - 1);
        
        if (error) {
          targetError = error;
          break;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          start += limit;
          if (data.length < limit) {
            hasMore = false; // Fetched the last page
          }
        } else {
          hasMore = false;
        }
      }

      if (targetError) {
        const errStr = (targetError.message || "").toLowerCase();
        const errCode = targetError.code || "";
        const isTableMissing = errCode === "42P01" || errCode === "PGRST205" || errStr.includes("does not exist") || errStr.includes("no existe") || errStr.includes("not found") || errStr.includes("could not find the table") || errStr.includes("invalid path");
        
        if (isTableMissing) {
          console.log(`[Supabase Read] Table '${targetTable}' does not exist in database yet (expected fallback).`);
          continue;
        }
        console.error(`[Supabase Read Error] Failed reading '${targetTable}':`, formatSupabaseError(targetError));
        throw targetError;
      }

      if (allData.length > 0) {
        console.log(`[Supabase Read] Successfully loaded ${allData.length} total records from table '${targetTable}'.`);
        
        const mappedList = new Array(allData.length);
        for (let i = 0; i < allData.length; i++) {
          mappedList[i] = mapSupabaseRowToClient(tableName, allData[i]);
        }
        
        return mappedList;
      }
    } catch (err: any) {
      const errMsg = formatSupabaseError(err);
      console.warn(`[Supabase Read Trial Notice] Trial for table '${targetTable}': ${errMsg}`);
    }
  }

  return [];
}

export async function writeToSupabase(tableName: string, action: 'insert' | 'update' | 'upsert', idKey: string, idVal: any, rawData: any): Promise<any> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log(`[Supabase Write] Skipped: credentials not set.`);
    return null;
  }

  const table = tableName.toLowerCase();
  const payload = mapItemForSupabase(tableName, rawData);

  const { sheetCol: dbIdCol } = getIdColumnAndKey(tableName);

  // If doing update/upsert, ensure ID is set both raw and sanitized using the DB column name
  if (idVal !== undefined && idVal !== null) {
    payload[dbIdCol] = idVal;
    
    const cleanDbIdCol = sanitizeColumnName(dbIdCol);
    if (cleanDbIdCol && cleanDbIdCol !== dbIdCol) {
      payload[cleanDbIdCol] = idVal;
    }
  }

  let currentTable = table;
  let attempt = 0;
  const maxAttempts = 25;
  let aliasIndex = 0;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      let query;
      if (action === 'insert') {
        query = supabase.from(currentTable).insert([payload]).select();
      } else if (action === 'update') {
        const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;
        query = supabase.from(currentTable).update(payload).eq(dbIdCol, cleanIdVal).select();
      } else {
        query = supabase.from(currentTable).upsert([payload], { onConflict: dbIdCol }).select();
      }

      const { data, error } = await query;

      if (!error) {
        if (action === 'update') {
          if (!data || data.length === 0) {
            const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;
            console.log(`[Supabase Write Fallback] 0 rows updated for ${dbIdCol}=${cleanIdVal} in ${currentTable}. Attempting insert fallback...`);
            const insertQuery = await supabase.from(currentTable).insert([payload]).select();
            if (!insertQuery.error && insertQuery.data && insertQuery.data.length > 0) {
              console.log(`[Supabase Write Fallback] Successfully inserted record into ${currentTable} on update fallback.`);
              return insertQuery.data;
            }
            if (insertQuery.error) {
              console.warn(`[Supabase Write Fallback] Insert failed:`, formatSupabaseError(insertQuery.error));
            }
          }
        }
        console.log(`[Supabase Write] Successfully completed ${action} in ${currentTable} after ${attempt} attempts.`);
        return data;
      }

      // Analyze Error
      const errStr = error.message || "";
      if (errStr.includes("<!DOCTYPE") || errStr.includes("<html")) {
        console.error(`🚨 [Supabase Error] Received an HTML response page instead of JSON API response. This occurs when SUPABASE_URL is configured to the browser's Studio dashboard webpage instead of the REST API Endpoint URL.`);
        throw error;
      }

      console.warn(`[Supabase Error Attempt ${attempt}] table ${currentTable}: ${formatSupabaseError(error)}`);

      // Code 42P01: Table missing
      if (error.code === '42P01' || errStr.toLowerCase().includes('does not exist') || errStr.toLowerCase().includes('no existe') || errStr.toLowerCase().includes('not found')) {
        const aliases = TABLE_ALIASES[table] || [];
        if (aliasIndex < aliases.length) {
          const nextTable = aliases[aliasIndex];
          aliasIndex++;
          console.log(`[Supabase Table Fallback] Table '${currentTable}' does not exist. Retrying with alias '${nextTable}'...`);
          currentTable = nextTable;
          continue;
        } else if (currentTable.endsWith('v2')) {
          const fallback = currentTable.slice(0, -2);
          console.log(`[Supabase Table Fallback] Last-resort table fallback. Retrying with non-v2 name '${fallback}'...`);
          currentTable = fallback;
          continue;
        }
      }

      // Code 42703: Missing column / Schema cache error
      if (
        error.code === '42703' || 
        error.code === 'PGRST204' || 
        errStr.includes('column') || 
        errStr.includes('schema cache')
      ) {
        const missingCol = extractColumnFromError(error.message);
        if (missingCol && payload[missingCol] !== undefined) {
          const val = payload[missingCol];
          const cleanCol = sanitizeColumnName(missingCol);
          if (cleanCol && cleanCol !== missingCol && payload[cleanCol] === undefined) {
            payload[cleanCol] = val;
          }
          console.log(`[Supabase Self-Heal] Column '${missingCol}' does not exist in table '${currentTable}'. Removing and retrying...`);
          delete payload[missingCol];
          continue;
        }
        
        const matchAnyQuote = error.message.match(/['"“]([^'"”]+)['"”]/g);
        if (matchAnyQuote) {
          let removedAny = false;
          for (const quoted of matchAnyQuote) {
            const col = quoted.replace(/['"“]/g, '');
            if (payload[col] !== undefined && col !== idKey) {
              const val = payload[col];
              const cleanCol = sanitizeColumnName(col);
              if (cleanCol && cleanCol !== col && payload[cleanCol] === undefined) {
                payload[cleanCol] = val;
              }
              console.log(`[Supabase Self-Heal] Removing column '${col}' from payload.`);
              delete payload[col];
              removedAny = true;
            }
          }
          if (removedAny) continue;
        }
      }

      // Code 23505: Duplicate primary key on insert -> perform update fallback
      if (error.code === '23505' || errStr.toLowerCase().includes('duplicate key') || errStr.toLowerCase().includes('unique constraint') || errStr.toLowerCase().includes('already exists')) {
        console.log(`[Supabase Self-Heal] Code 23505 duplicate key in '${currentTable}' on ${action}. Performing update fallback...`);
        const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;
        const updateFallback = await supabase.from(currentTable).update(payload).eq(dbIdCol, cleanIdVal).select();
        if (!updateFallback.error && updateFallback.data && updateFallback.data.length > 0) {
          console.log(`[Supabase Self-Heal] Successfully updated duplicate key record in '${currentTable}'.`);
          return updateFallback.data;
        }
        if (updateFallback.error) {
          console.warn(`[Supabase Self-Heal] Update fallback error:`, formatSupabaseError(updateFallback.error));
        }
      }

      // Code 22P02: Invalid type representation
      if (error.code === '22P02') {
        const errStrLower = errStr.toLowerCase();
        let invalidStr: string | null = null;
        
        const matchVal = errStr.match(/['"“]([^"'”]+)['"”]/);
        if (matchVal) {
          invalidStr = matchVal[1];
        }

        console.log(`[Supabase Self-Heal] 22P02 handling. Extracted invalidStr: '${invalidStr}'.`);

        if (invalidStr) {
          let fixedAny = false;
          const searchStr = invalidStr.toLowerCase().trim();
          const keys = Object.keys(payload);
          
          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const valStr = String(payload[key]).toLowerCase().trim();
            
            if (valStr === searchStr || valStr.includes(searchStr) || searchStr.includes(valStr)) {
              if (errStrLower.includes('numeric') || errStrLower.includes('integer') || errStrLower.includes('double') || errStrLower.includes('real')) {
                const numericPart = String(payload[key]).replace(/[^\d.,-]/g, '').replace(/,/g, '.');
                const parsedNum = parseFloat(numericPart);
                if (!isNaN(parsedNum)) {
                  console.log(`[Supabase Self-Heal] Fixed invalid numeric column '${key}' from '${payload[key]}' to ${parsedNum}.`);
                  payload[key] = parsedNum;
                } else {
                  console.log(`[Supabase Self-Heal] Cannot parse '${payload[key]}' as number. Setting column '${key}' to null.`);
                  payload[key] = null;
                }
                fixedAny = true;
              } else if (errStrLower.includes('boolean')) {
                const lowerVal = String(payload[key]).toLowerCase().trim();
                const isTrue = lowerVal === 'si' || lowerVal === 'sí' || lowerVal === 'yes' || lowerVal === 'true' || lowerVal === '1' || lowerVal === 't' || lowerVal === 's';
                console.log(`[Supabase Self-Heal] Fixed invalid boolean column '${key}' from '${payload[key]}' to ${isTrue}.`);
                payload[key] = isTrue;
                fixedAny = true;
              } else {
                console.log(`[Supabase Self-Heal] Nullifying invalid value '${payload[key]}' for column '${key}'.`);
                payload[key] = null;
                fixedAny = true;
              }
            }
          }
          
          if (fixedAny) {
            console.log(`[Supabase Self-Heal] Payload key(s) corrected. Retrying write...`);
            continue;
          }
        }
      }

      throw error;

    } catch (err: any) {
      console.error(`[Supabase Write Failure] table ${currentTable} failed completely: ${formatSupabaseError(err)}`);
      throw err;
    }
  }
  throw new Error(`No se pudo completar la escritura en Supabase para la tabla ${tableName} tras ${maxAttempts} intentos.`);
}

export async function deleteFromSupabase(tableName: string, idKey: string, idVal: any): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const table = tableName.toLowerCase();
  const cleanIdVal = typeof idVal === 'string' ? idVal.trim() : idVal;

  const { sheetCol: dbIdCol } = getIdColumnAndKey(tableName);
  
  const tablesToTry = [table, ...(TABLE_ALIASES[table] || [])];
  if (table.endsWith("v2") && !tablesToTry.includes(table.slice(0, -2))) {
    tablesToTry.push(table.slice(0, -2));
  }

  // Cascade Deletes for PRODUCCIONV2
  const upperTable = tableName.toUpperCase();
  if (upperTable === "PRODUCCIONV2") {
    console.log(`[Supabase Delete Cascade] Executing cascade deletes for production report '${cleanIdVal}'...`);
    
    try {
      const { data: bqData } = await supabase
        .from("paros_boquillasv2")
        .delete()
        .eq("produccion_id", cleanIdVal)
        .select();
      console.log(`[Supabase Delete Cascade] Deleted ${bqData ? bqData.length : 0} nozzle entries from paros_boquillasv2.`);
    } catch (bqErr) {
      console.error(`[Supabase Delete Cascade Error] Failed removing related paros_boquillasv2:`, bqErr);
    }

    try {
      const { data: bqDetails } = await supabase
        .from("detalles_produccionv2")
        .delete()
        .eq("produccion_id", cleanIdVal)
        .select();
      console.log(`[Supabase Delete Cascade] Deleted ${bqDetails ? bqDetails.length : 0} production detail entries from detalles_produccionv2.`);
    } catch (detErr) {
      console.error(`[Supabase Delete Cascade Error] Failed removing related detalles_produccionv2:`, detErr);
    }
  }

  let lastError: any = null;
  for (const targetTable of tablesToTry) {
    try {
      let colUsed = dbIdCol;
      const { data, error } = await supabase.from(targetTable).delete().eq(dbIdCol, cleanIdVal).select();

      if (error) {
        const errStr = (error.message || "").toLowerCase();
        const isTableMissing = error.code === "42P01" || error.code === "PGRST205" || errStr.includes("does not exist") || errStr.includes("no existe") || errStr.includes("not found") || errStr.includes("could not find the table");

        if (isTableMissing) {
          console.log(`[Supabase Delete Warning] Table '${targetTable}' does not exist. Trying next fallback...`);
          continue;
        }

        // Try idKey as fallback
        if (idKey && idKey !== dbIdCol) {
          colUsed = idKey;
          const rxFallback = await supabase.from(targetTable).delete().eq(idKey, cleanIdVal).select();
          if (!rxFallback.error) {
            const deletedCount = rxFallback.data ? rxFallback.data.length : 0;
            console.log(`[Supabase Delete] Table: ${targetTable}, Columna: ${colUsed}, ID: ${cleanIdVal}, Filas eliminadas: ${deletedCount}`);
            if (rxFallback.data !== null && deletedCount > 0) {
              invalidateCache(tableName);
              return true;
            }
          }
        }

        // Try cleanIdKey as fallback
        const cleanIdKey = sanitizeColumnName(dbIdCol);
        if (cleanIdKey !== dbIdCol) {
          colUsed = cleanIdKey;
          const rx = await supabase.from(targetTable).delete().eq(cleanIdKey, cleanIdVal).select();
          if (!rx.error) {
            const deletedCount = rx.data ? rx.data.length : 0;
            console.log(`[Supabase Delete] Table: ${targetTable}, Columna: ${colUsed}, ID: ${cleanIdVal}, Filas eliminadas: ${deletedCount}`);
            if (rx.data !== null && deletedCount > 0) {
              invalidateCache(tableName);
              return true;
            }
          }
        }

        throw error;
      }

      const deletedCount = data ? data.length : 0;
      console.log(`[Supabase Delete] Table: ${targetTable}, Columna: ${colUsed}, ID: ${cleanIdVal}, Filas eliminadas: ${deletedCount}`);

      if (data !== null && deletedCount > 0) {
        invalidateCache(tableName);
        return true;
      } else {
        console.warn(`[Supabase Delete Warning] No rows deleted in table ${targetTable} matching ${colUsed}=${cleanIdVal} (returned count:0)`);
        return false;
      }

    } catch (err) {
      console.warn(`[Supabase Delete Trial Error] Trial for '${targetTable}' failed: ${formatSupabaseError(err)}`);
      lastError = err;
    }
  }

  console.error(`[Supabase Delete Failure] All delete trials for table ${table} failed.`);
  throw lastError || new Error(`Todas las pruebas de eliminación en Supabase para la tabla ${table} fallaron.`);
}