export const BOOLEAN_COLUMNS = new Set([
  "es_punto_de_muestreo",
  "es_fechador",
  "es_balanza",
  "es_pallet",
  "es_productivo",
  "es_insumo",
  "es_bigbag",
  "es_despacho",
  "es_granel",
  "is_pallet",
  "is_productive",
  "is_supply",
  "is_big_bag",
  "is_dispatch",
  "is_bulk",
  "todo_el_turno",
  "purga",
  "valvula_silo_cerrada",
  "circuito_vaciado",
  "maquina_limpia",
  "tolva_vaciada",
  "silo_cambiado",
  "fechador_actualizado",
  "envase_correcto",
  "dos_big_bags_pal",
  "muestreo_color",
  "muestra_enviada_lab",
  "producto_liberado",
  "habilitada"
]);

export function sanitizeColumnName(col: string): string {
  // convert camelCase to snake_case first (e.g., durationHours -> duration_hours)
  const withUnder = col.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const result = withUnder
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9_]/g, "_")    // replace spaces, ?, symbols with _
    .replace(/__+/g, "_")           // deduplicate underscores
    .replace(/^_+|_+$/g, "");       // trim leading/trailing underscores
  if (result === "rendimineto") {
    return "rendimiento";
  }
  return result;
}

export function normalizeDateToISO(val: any): string | any {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim();
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.substring(0, 10);
  }
  return trimmed;
}

export function sanitizeValue(val: any): any {
  if (val === undefined || val === null) return val;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // Match percentage value, e.g., "99.3%" or "99.3 %" or "-15.2%"
    const matchPercent = trimmed.match(/^(-?\d+(?:[\.,]\d+)?)\s*%$/);
    if (matchPercent) {
      const num = parseFloat(matchPercent[1].replace(',', '.'));
      if (!isNaN(num)) {
        return num;
      }
    }
    // Safe numeric parsing for decimal strings with dot or comma, e.g., "50.01" or "50,01"
    if (/^-?\d+(?:[\.,]\d+)?$/.test(trimmed)) {
      const num = parseFloat(trimmed.replace(',', '.'));
      if (!isNaN(num)) return num;
    }
    return trimmed;
  }
  return val;
}

export function toBoolean(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase().trim();
  return str === 'si' || str === 'sí' || str === 'yes' || str === 'true' || str === '1' || str === 't' || str === 's';
}

export function getProcessedValue(colName: string, originalKey: string, val: any): any {
  const cleanCol = sanitizeColumnName(colName);
  const cleanOrig = sanitizeColumnName(originalKey);
  if (cleanCol === 'purga' || cleanOrig === 'purge') {
    return toBoolean(val) ? 'SI' : 'NO';
  }
  if (BOOLEAN_COLUMNS.has(cleanCol) || BOOLEAN_COLUMNS.has(cleanOrig) || colName.endsWith('?') || originalKey.endsWith('?')) {
    return toBoolean(val);
  }
  if (cleanCol === 'fecha' || cleanCol === 'date' || cleanOrig === 'fecha' || cleanOrig === 'date') {
    return normalizeDateToISO(val);
  }
  if (cleanCol === 'historial_modificacion' || cleanOrig === 'historial_modificacion' || cleanOrig === 'modificationhistory' || cleanOrig === 'modification_history') {
    if (typeof val === 'string' && val.trim() !== '') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }
  const sanitized = sanitizeValue(val);
  return typeof sanitized === "object" ? JSON.stringify(sanitized) : sanitized;
}

export const formatTimeHHMMSS = (timeStr: string | undefined): string => {
  if (!timeStr) return "00:00:00";
  const trimmed = timeStr.trim();
  if (trimmed.length === 5) {
    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }
  }
  if (trimmed.length === 8) {
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return trimmed;
};
