import { Router } from "express";
import { GenericRepository } from "../repositories/generic.repository.js";
import { ProductionService } from "../services/production.service.js";
import { ParosService } from "../services/paros.service.js";
import { MaestrosService } from "../services/maestros.service.js";
import { TABLE_SCHEMAS } from "../schemas/tableSchemas.js";
import { getIdColumnAndKey } from "../utils/mappings.js";
import { areRecordsEqual, areNozzleNewsListsEqual, areDetailsListsEqual, formatSupabaseError } from "../utils/helpers.js";
import { getSupabaseClient } from "../services/supabase.service.js";
import { invalidateCache, MASTER_TABLES } from "../cache/cache.service.js";
const router = Router();

// Helper to trace and log incoming calls with comprehensive diagnostics
function logTraceRequest(req: any, endpoint: string, tableRequested: string) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const firstIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : 'unknown';
    console.log(`[PSCQUBE] ${new Date().toISOString()} - ${endpoint} - Table: ${tableRequested} - IP: ${firstIp}`);
    return;
  }

  const timestamp = new Date().toISOString();
  const queryParams = JSON.stringify(req.query || {});
  const bodyParams = req.body ? JSON.stringify(req.body) : "{}";
  const userAgent = req.headers["user-agent"] || "No User-Agent";
  const referer = req.headers["referer"] || "No Referer";
  const source = req.query.source || "N/A";
  const bypassCache = req.query.bypassCache || "false";
  
  // IP Extraction & Anonymization
  let rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  let ip = 'unknown';
  if (typeof rawIp === 'string') {
    const firstIp = rawIp.split(',')[0].trim();
    if (firstIp.includes('.')) {
      const parts = firstIp.split('.');
      if (parts.length >= 2) {
        ip = `${parts[0]}.${parts[1]}.x.x`;
      } else {
        ip = firstIp;
      }
    } else if (firstIp.includes(':')) {
      const parts = firstIp.split(':');
      if (parts.length >= 2) {
        ip = `${parts[0]}:${parts[1]}:x:x`;
      } else {
        ip = firstIp;
      }
    } else {
      ip = firstIp;
    }
  }

  // Identify application origin callers if customized headers exist
  const appCallerHeader = req.headers["x-app-caller"] || "Not Specified (Legacy/Generic)";
  const secChUa = req.headers["sec-ch-ua"] || "N/A";
  const secChUaPlatform = req.headers["sec-ch-ua-platform"] || "N/A";
  const secFetchSite = req.headers["sec-fetch-site"] || "N/A";
  const secFetchMode = req.headers["sec-fetch-mode"] || "N/A";
  const authHeader = req.headers["authorization"] ? "Attached" : "None";
  const cookieHeader = req.headers["cookie"] ? "Attached" : "None";

  console.log(`
====== [PSCQUBE API TRACE LOG] ======
Timestamp (Exact): ${timestamp}
Accessed Endpoint: ${endpoint}
Requested Table  : ${tableRequested}
Bypass Cache Flag: ${bypassCache}
Origin Source Tracker: ${source}
Anonymized IP    : ${ip}
Received Query   : ${queryParams}
Received Body    : ${bodyParams}
User-Agent       : ${userAgent}
sec-ch-ua        : ${secChUa}
sec-ch-ua-plat   : ${secChUaPlatform}
sec-fetch-site   : ${secFetchSite}
sec-fetch-mode   : ${secFetchMode}
Referer          : ${referer}
App Caller ID    : ${appCallerHeader}
Credentials Meta : Auth=${authHeader}, Cookies=${cookieHeader}
======================================
`);
}

// Reconciles incoming collection list against cached database state
async function reconcileTableData(tableName: string, incomingData: any[], allowDeleteMissing: boolean = false): Promise<void> {
  const upperTable = tableName.toUpperCase();
  const dbData = await GenericRepository.findAll(tableName);
  const { clientKey } = getIdColumnAndKey(tableName);

  const dbMap = new Map<string, any>();
  dbData.forEach(item => {
    if (item && item[clientKey] !== undefined) {
      dbMap.set(String(item[clientKey]), item);
    }
  });

  const incomingMap = new Map<string, any>();
  incomingData.forEach(item => {
    if (item && item[clientKey] !== undefined) {
      incomingMap.set(String(item[clientKey]), item);
    }
  });

  // Batch enrich all incoming valid items in a single call to prevent N sequential network/db requests
  const validIncomingItems = incomingData.filter(item => !!item);
  await MaestrosService.enrichDataIfNeeded(tableName, validIncomingItems);

  for (const item of incomingData) {
    if (!item) continue;

    const rawId = item[clientKey] !== undefined && item[clientKey] !== null ? item[clientKey] : (item.id || item.ID);
    if (!rawId) continue;
    const itemId = String(rawId);
    if (dbMap.has(itemId)) {
      const dbItem = dbMap.get(itemId);
      const schema = TABLE_SCHEMAS[upperTable];
      const headers = schema ? schema.sheetHeaders : [];
      
      const equalBase = areRecordsEqual(item, dbItem, headers, schema);
      let equalNozzles = true;
      let equalDetails = true;
      if (upperTable === "PRODUCCIONV2") {
        equalNozzles = areNozzleNewsListsEqual(item.nozzleNews, dbItem.nozzleNews);
        equalDetails = areDetailsListsEqual(item.materialsDetails, dbItem.materialsDetails);
      }

      if (!equalBase || !equalNozzles || !equalDetails) {
        console.log(`[Reconciler] Item ${itemId} has changed in table ${tableName}. Modifying...`);
        await GenericRepository.update(tableName, itemId, item);
        if (upperTable === "PRODUCCIONV2") {
          await ProductionService.syncProductionChildren(item);
        }
      }
    } else {
      console.log(`[Reconciler] Item ${itemId} is new in table ${tableName}. Appending...`);
      await GenericRepository.create(tableName, item);
      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }
    }
  }

  // Deletions against incoming state
  if (allowDeleteMissing) {
    for (const dbItem of dbData) {
      if (!dbItem) continue;
      const dbId = String(dbItem[clientKey]);
      if (!incomingMap.has(dbId)) {
        console.log(`[Reconciler] Item ${dbId} is deleted in client. Triggering deletion...`);
        if (upperTable === "PRODUCCIONV2") {
          await ProductionService.deleteProductionChildren(dbId);
        }
        await GenericRepository.delete(tableName, dbId);
      }
    }
  }
}

// GET Endpoint to test Supabase connection and check table columns
router.get("/api/supabase-test", async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({
        success: false,
        error: "Supabase client is not initialized. Check your SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY env variables."
      });
    }

    const testTables = ["turnosv2", "usuariosv2", "cambio_productov2", "parosv2", "produccionv2"];
    const results: Record<string, any> = {};

    for (const table of testTables) {
      try {
        const { data, error } = await supabase.from(table).select("*").limit(5);
        results[table] = {
          success: !error,
          rowCount: data ? data.length : 0,
          sample: data || [],
          columns: data && data.length > 0 ? Object.keys(data[0]) : [],
          error: error ? formatSupabaseError(error) : null
        };
      } catch (err: any) {
        results[table] = {
          success: false,
          error: err.message || err.toString()
        };
      }
    }

    console.log("=== SUPABASE-TEST RESULTS ===");
    console.log("PAROSV2 Row Count:", results["parosv2"]?.rowCount);
    console.log("PAROSV2 Sample:", JSON.stringify(results["parosv2"]?.sample, null, 2));
    
    return res.json({
      success: true,
      message: "Supabase connection and structure diagnostics.",
      supabaseUrl: process.env.SUPABASE_URL,
      hasKey: !!(process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      results
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || error.toString()
    });
  }
});

// Helpers to handle Vercel CDN cache headers
function setCdnCacheHeader(res: any, maxAge: number, sMaxAge: number) {
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=600`);
}

function setNoCacheHeader(res: any) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
}

const APP_BUILD_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || "v2.0.1-stable";

// GET Version Endpoint
router.get("/api/version", (req, res) => {
  setCdnCacheHeader(res, 60, 1800);
  return res.json({
    success: true,
    version: APP_BUILD_VERSION
  });
});

// GET Status Endpoint (Google Sheets status is now mock-returned as we operate purely on Supabase)
router.get("/api/sheets/status", async (req, res) => {
  setCdnCacheHeader(res, 60, 300);
  return res.json({
    success: true,
    configured: true,
    hasKey: true,
    isJsonConfigured: true,
    email: "supabase-active-PSCQUBE@supabase.co",
    sheetId: "PSCQUBE_SUPABASE_DATABASE",
    diagnostics: {
      connectionOk: true,
      message: "pscqube is fully operational on Supabase database cloud persistence."
    }
  });
});

// GET Catalogos (returns all master directories in one single call)
router.get("/api/catalogos", async (req, res) => {
  logTraceRequest(req, "GET /api/catalogos", "ALL_CATALOGUES_BULK");
  const bypassCache = req.query.bypassCache === "true";
  const catalogTables = [
    "TURNOSV2",
    "PALETIZADORAV2",
    "ENSACADORAV2",
    "HACSV2",
    "CAUSASV2",
    "MATERIALESV2",
    "CAPACIDADESV2",
    "USUARIOSV2",
    "EMPRESASV2",
    "PUNTOS_CARGAV2",
    "PROVEEDORES_BOLSAV2",
    "VEHICULOSV2"
  ];

  if (bypassCache) {
    setNoCacheHeader(res);
    catalogTables.forEach(t => invalidateCache(t));
  } else {
    setCdnCacheHeader(res, 60, 300);
  }

  try {
    const resultsArray = await Promise.all(
      catalogTables.map(async (table) => {
        const data = await GenericRepository.findAll(table);
        return [table, data] as const;
      })
    );
    const results: Record<string, any[]> = Object.fromEntries(resultsArray);
    return res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("GET /api/catalogos Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al leer catálogos" });
  }
});

// Helper to safely compare dates regardless of format (YYYY-MM-DD, DD/MM/YYYY, ISO Timestamps)
function matchesDateFilter(itemDate: any, targetDate?: string, dateFrom?: string, dateTo?: string): boolean {
  if (!targetDate && !dateFrom && !dateTo) return true;
  if (!itemDate) return false;
  
  const normItem = String(itemDate).trim();
  let itemIso = "";
  if (/^\d{4}-\d{2}-\d{2}/.test(normItem)) {
    itemIso = normItem.substring(0, 10);
  } else {
    const match = normItem.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      itemIso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    } else {
      itemIso = normItem;
    }
  }

  if (targetDate) {
    let targetIso = targetDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(targetIso)) {
      targetIso = targetIso.substring(0, 10);
    } else {
      const match = targetIso.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (match) {
        targetIso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }
    return itemIso === targetIso;
  }

  if (dateFrom && dateTo) {
    return itemIso >= dateFrom && itemIso <= dateTo;
  }

  return true;
}

// GET Produccion Endpoint
router.get("/api/produccion", async (req, res) => {
  logTraceRequest(req, "GET /api/produccion", "PRODUCCIONV2");
  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    setNoCacheHeader(res);
    invalidateCache("PRODUCCIONV2");
  } else {
    setCdnCacheHeader(res, 30, 120);
  }
  try {
    const { date, dateFrom, dateTo } = req.query as Record<string, string>;
    let list = await GenericRepository.findAll("PRODUCCIONV2", { date, dateFrom, dateTo });

    await ProductionService.enrichProductionReportsWithNozzleNews(list);
    await ProductionService.enrichProductionReportsWithDetails(list);
    await ProductionService.enrichProductionRecords(list, { date, dateFrom, dateTo });
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/produccion Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al leer producción" });
  }
});

// POST Endpoint to force recalculation and committing indicators (disponibilidad, rendimiento, oee) to Supabase
router.post("/api/produccion/recalculate", async (req, res) => {
  try {
    await ProductionService.autoRecalculateProductionMetrics();
    return res.json({ success: true, message: "Indicadores recalculados y actualizados en Supabase con éxito" });
  } catch (error: any) {
    console.error("POST /api/produccion/recalculate Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al recalcular indicadores" });
  }
});

// GET Paros Endpoint
router.get("/api/paros", async (req, res) => {
  logTraceRequest(req, "GET /api/paros", "PAROSV2");
  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    setNoCacheHeader(res);
    invalidateCache("PAROSV2");
  } else {
    setCdnCacheHeader(res, 30, 120);
  }
  try {
    const { date, dateFrom, dateTo } = req.query as Record<string, string>;
    let list = await GenericRepository.findAll("PAROSV2", { date, dateFrom, dateTo });

    await ParosService.enrichParosOnRead(list);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/paros Error:", error);
    return res.status(500).json({ success: false, error: error.message || "Error al leer paros" });
  }
});

// GET Endpoint to read tables generically
router.get("/api/sheets", async (req, res) => {
  const table = req.query.table as string;
  logTraceRequest(req, "GET /api/sheets", table || "unspecified");
  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  const bypassCache = req.query.bypassCache === "true";
  if (bypassCache) {
    setNoCacheHeader(res);
    invalidateCache(table);
  } else {
    const isMaster = MASTER_TABLES.includes(table.toUpperCase());
    if (isMaster) {
      setCdnCacheHeader(res, 60, 300);
    } else {
      setCdnCacheHeader(res, 30, 120);
    }
  }

  try {
    const upperTable = table.toUpperCase();

    // List of transactional/filterable tables
    const filterableTables = [
      "PAROSV2",
      "PRODUCCIONV2",
      "CONTROL_FECHADORV2",
      "CONTROL_BALANZAV2",
      "INVENTARIO_FISICOV2",
      "CLASISFICACION_PALLETSV2",
      "CAMBIO_PRODUCTOV2",
      "DESPACHOSV2",
      "ESTADO_CALLESV2",
      "CARGA_COMBUSTIBLEV2"
    ];

    const { date, dateFrom, dateTo } = req.query as Record<string, string>;
    let list = [];
    if (filterableTables.includes(upperTable)) {
      list = await GenericRepository.findAll(table, { date, dateFrom, dateTo });
    } else {
      list = await GenericRepository.findAll(table);
    }

    if (upperTable === "PRODUCCIONV2") {
      await ProductionService.enrichProductionReportsWithNozzleNews(list);
      await ProductionService.enrichProductionReportsWithDetails(list);
      await ProductionService.enrichProductionRecords(list, { date, dateFrom, dateTo });
    } else if (upperTable === "PAROSV2") {
      await ParosService.enrichParosOnRead(list);
    }

    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error("GET /api/sheets Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Error al leer datos de " + table
    });
  }
});

// POST Endpoint to read/write/create/update/delete tables
router.post("/api/sheets", async (req, res) => {
  setNoCacheHeader(res);
  const { action, table, data } = req.body;
  logTraceRequest(req, `POST /api/sheets (action: ${action || 'n/a'})`, table || "unspecified");

  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  const upperTable = table.toUpperCase();

  try {
    // 1. READ action
    if (action === "read") {
      const list = await GenericRepository.findAll(table);
      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.enrichProductionReportsWithNozzleNews(list);
        await ProductionService.enrichProductionReportsWithDetails(list);
      } else if (upperTable === "PAROSV2") {
        await ParosService.enrichParosOnRead(list);
      }
      return res.json({ success: true, data: list });
    }

    // 2. WRITE action (reconciliation)
    if (action === "write") {
      if (!data) {
        return res.status(400).json({ success: false, error: "Faltan los datos para la acción write" });
      }
      let allowDeleteMissing = req.body.allowDeleteMissing === true;
      
      const transactionalTables = [
        "PAROSV2",
        "PRODUCCIONV2",
        "DESPACHOSV2",
        "CONTROL_FECHADORV2",
        "CONTROL_BALANZAV2",
        "INVENTARIO_FISICOV2",
        "CLASISFICACION_PALLETSV2",
        "CAMBIO_PRODUCTOV2",
        "ESTADO_CALLESV2",
        "CARGA_COMBUSTIBLEV2"
      ];
      if (transactionalTables.includes(upperTable)) {
        allowDeleteMissing = false;
      }

      await reconcileTableData(table, data, allowDeleteMissing);
      
      invalidateCache(table);

      if (upperTable === "PAROSV2" || upperTable === "PRODUCCIONV2") {
        ProductionService.autoRecalculateProductionMetrics().catch(err =>
          console.error("[Background Recalculate Error]", err)
        );
      }
      return res.json({ success: true, count: data.length });
    }

    // 3. CREATE action
    if (action === "create") {
      const { item } = req.body;
      if (!item) {
        return res.status(400).json({ success: false, error: "Falta el parámetro 'item' para crear" });
      }

      await MaestrosService.enrichDataIfNeeded(table, [item]);

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.enrichProductionRecords([item]);
      }

      await GenericRepository.create(table, item);

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }

      invalidateCache(table);

      if (upperTable === "PAROSV2" || upperTable === "PRODUCCIONV2") {
        ProductionService.autoRecalculateProductionMetrics().catch(err =>
          console.error("[Background Recalculate Error]", err)
        );
      }
      return res.json({ success: true, message: "Registro guardado con éxito" });
    }

    // 4. UPDATE action
    if (action === "update") {
      const { id, item } = req.body;
      if (id === undefined || !item) {
        return res.status(400).json({ success: false, error: "Faltan 'id' o 'item' para actualizar" });
      }

      await MaestrosService.enrichDataIfNeeded(table, [item]);

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.enrichProductionRecords([item]);
      }

      await GenericRepository.update(table, id, item);

      if (upperTable === "PRODUCCIONV2") {
        await ProductionService.syncProductionChildren(item);
      }

      invalidateCache(table);

      if (upperTable === "PAROSV2" || upperTable === "PRODUCCIONV2") {
        ProductionService.autoRecalculateProductionMetrics().catch(err =>
          console.error("[Background Recalculate Error]", err)
        );
      }
      return res.json({ success: true, message: "Registro actualizado con éxito" });
    }

    // 5. DELETE action
    if (action === "delete") {
      const { id } = req.body;
      if (id === undefined) {
        return res.status(400).json({ success: false, error: "Falta el parámetro 'id' para eliminar" });
      }

      if (upperTable === "PRODUCCIONV2") {
        console.log(`[Delete Action] Cascade deleting children for production report: ${id}`);
        await ProductionService.deleteProductionChildren(id);
      }

      // Supabase cascade handled directly inside the repository and service delete calls
      const isDeleted = await GenericRepository.delete(table, id);
      invalidateCache(table);

      if ((upperTable === "PAROSV2" || upperTable === "PRODUCCIONV2") && isDeleted) {
        ProductionService.autoRecalculateProductionMetrics().catch(err =>
          console.error("[Background Recalculate Error]", err)
        );
      }
      return res.json({ success: true, message: isDeleted ? "Registro eliminado con éxito" : "Registro no encontrado para eliminar" });
    }

    return res.status(400).json({ success: false, error: "Acción no reconocida" });

  } catch (error: any) {
    console.error(`POST /api/sheets Error action:${action} table:${table}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || `Error al procesar acción ${action} en tabla ${table}`
    });
  }
});

export default router;
