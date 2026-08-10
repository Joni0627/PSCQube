/**
 * Data Service
 * Handles reading and writing data via the Express backend, which uses Supabase internally.
 */

export interface SyncResult {
  success: boolean;
  error?: string;
}

export interface FetchResult {
  success: boolean;
  data?: any[];
  error?: string;
}

const CACHE_PREFIX = "app_table_cache_v2_";

export const MASTER_TABLES = [
  "TURNOSV2", "PALETIZADORAV2", "ENSACADORAV2", "HACSV2",
  "CAUSASV2", "MATERIALESV2", "CAPACIDADESV2", "USUARIOSV2",
  "EMPRESASV2", "PUNTOS_CARGAV2", "PROVEEDORES_BOLSAV2", "VEHICULOSV2",
  "PARAMETROS_BALANZAV2"
];

import { safeCache } from './safeCache';

async function getBrowserCache(
  tableName: string,
  filters?: { date?: string; shiftId?: string; palletizerId?: string; dateFrom?: string; dateTo?: string }
): Promise<any[] | null> {
  let key = `app_cache_v2_${tableName.toUpperCase()}`;
  if (filters?.date) key += `_${filters.date}`;
  if (filters?.dateFrom) key += `_from_${filters.dateFrom}`;
  if (filters?.dateTo) key += `_to_${filters.dateTo}`;
  return await safeCache.get<any[]>(key);
}

async function setBrowserCache(
  tableName: string,
  data: any[],
  filters?: { date?: string; shiftId?: string; palletizerId?: string; dateFrom?: string; dateTo?: string }
): Promise<void> {
  let key = `app_cache_v2_${tableName.toUpperCase()}`;
  if (filters?.date) key += `_${filters.date}`;
  if (filters?.dateFrom) key += `_from_${filters.dateFrom}`;
  if (filters?.dateTo) key += `_to_${filters.dateTo}`;
  const isMaster = MASTER_TABLES.includes(tableName.toUpperCase());
  const ttl = isMaster ? 30 * 60 * 1000 : 12 * 60 * 60 * 1000;
  await safeCache.set(key, data, ttl);
}

export async function clearClientCache(tableName?: string): Promise<void> {
  try {
    if (tableName) {
      const sheetName = tableName.toUpperCase();
      const keysToClear = [sheetName, sheetName.endsWith('V2') ? sheetName : `${sheetName}V2`];
      for (const k of keysToClear) {
        await safeCache.remove(`app_cache_v2_${k}`);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CACHE_PREFIX + k);
      }
      if (sheetName.includes("PARO") || sheetName.includes("PRODUC")) {
        await safeCache.remove(`app_cache_v2_PAROSV2`);
        await safeCache.remove(`app_cache_v2_PRODUCCIONV2`);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(CACHE_PREFIX + "PAROSV2");
          sessionStorage.removeItem(CACHE_PREFIX + "PRODUCCIONV2");
        }
      }
    } else {
      await safeCache.clearByPrefix("app_cache_v2_");
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    }
  } catch (err) {
    console.warn("[Client Cache Clear Error]", err);
  }
}

export async function fetchTable(
  tableName: string,
  forceBypass = false,
  filters?: { date?: string; shiftId?: string; palletizerId?: string; dateFrom?: string; dateTo?: string },
  source = "unspecified"
): Promise<FetchResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) sheetName = `${sheetName}V2`;

  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    const cached = await getBrowserCache(sheetName, filters);
    if (cached) return { success: true, data: cached };
    return { success: false, error: "Query skipped: Tab is backgrounded and cache is absent" };
  }

  if (!forceBypass) {
    const cached = await getBrowserCache(sheetName, filters);
    if (cached) return { success: true, data: cached };
  }

  try {
    let queryParams = "";
    if (forceBypass) queryParams += "bypassCache=true&";
    if (filters) {
      if (filters.date) queryParams += `date=${encodeURIComponent(filters.date)}&`;
      if (filters.shiftId) queryParams += `shiftId=${encodeURIComponent(filters.shiftId)}&`;
      if (filters.palletizerId) queryParams += `palletizerId=${encodeURIComponent(filters.palletizerId)}&`;
      if (filters.dateFrom) queryParams += `dateFrom=${encodeURIComponent(filters.dateFrom)}&`;
      if (filters.dateTo) queryParams += `dateTo=${encodeURIComponent(filters.dateTo)}&`;
    }
    queryParams += `source=${encodeURIComponent(source)}`;

    let url = `/api/sheets?table=${sheetName}&${queryParams}`;
    if (sheetName === "PRODUCCIONV2") url = `/api/produccion?${queryParams}`;
    else if (sheetName === "PAROSV2") url = `/api/paros?${queryParams}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorResponse = await response.json().catch(() => ({}));
      return { success: false, error: errorResponse.error || `Error HTTP ${response.status}` };
    }
    const result = await response.json();
    if (result.success && Array.isArray(result.data)) {
      await setBrowserCache(sheetName, result.data, filters);
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error || "Formato de respuesta inválido" };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

export async function createRecord(tableName: string, item: any): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) sheetName = `${sheetName}V2`;
  clearClientCache(sheetName);
  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', table: sheetName, item })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error || `Error HTTP ${response.status}` };
    }
    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

export async function updateRecord(tableName: string, id: string, item: any): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) sheetName = `${sheetName}V2`;
  clearClientCache(sheetName);
  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', table: sheetName, id, item })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error || `Error HTTP ${response.status}` };
    }
    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

export async function deleteRecord(tableName: string, id: string): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) sheetName = `${sheetName}V2`;
  clearClientCache(sheetName);
  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', table: sheetName, id })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error || `Error HTTP ${response.status}` };
    }
    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

export async function syncTableToSheets(tableName: string, incomingData: any[]): Promise<SyncResult> {
  let sheetName = tableName.toUpperCase();
  if (!sheetName.endsWith('V2')) sheetName = `${sheetName}V2`;
  clearClientCache(sheetName);
  try {
    const response = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'write', table: sheetName, data: incomingData, allowDeleteMissing: true })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error || `Error HTTP ${response.status}` };
    }
    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}
