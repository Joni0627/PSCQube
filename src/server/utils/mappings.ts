import { TABLE_SCHEMAS } from "../schemas/tableSchemas.js";
import { sanitizeColumnName, getProcessedValue, toBoolean, BOOLEAN_COLUMNS } from "./sanitizers.js";

export const TABLE_ALIASES: Record<string, string[]> = {
  "carga_combustiblev2": ["carga_combustible", "carga_combustibles", "cargas_combustibles", "cargas_combustible"],
  "turnosv2": ["turnos", "turno"],
  "usuariosv2": ["usuarios", "usuario"],
  "cambio_productov2": ["cambio_producto", "cambios_producto", "cambio_productos", "cambios_productos"],
  "parosv2": ["paros", "paro"],
  "produccionv2": ["produccion", "producciones"],
  "punto_cargav2": ["punto_carga", "puntos_carga", "puntos_cargav2"],
  "puntos_cargav2": ["puntos_carga", "punto_carga"],
  "empresasv2": ["empresas", "empresa"],
  "proveedores_bolsav2": ["proveedores_bolsa", "proveedor_bolsa"],
  "vehiculosv2": ["vehiculos", "vehiculo"],
  "capacidadesv2": ["capacidades", "capacidad"],
  "detalles_produccionv2": ["detalles_produccion", "detalle_produccionv2", "detalle_produccion"],
  "clasisficacion_palletsv2": ["clasisficacion_pallets", "clasificacion_pallets", "clasificacion_palletsv2", "clasisficacion_pallet"],
  "clasificacion_palletsv2": ["clasisficacion_pallets", "clasificacion_pallets", "clasisficacion_palletsv2"],
  "estado_callesv2": ["estado_calles", "estados_calles", "estado_calle"],
  "inventario_fisicov2": ["inventario_fisico", "inventarios_fisicos"],
  "parametros_balanzav2": ["parametros_balanza", "parametro_balanza", "parametro_balanzav2", "parametros_balanzas", "controles_balanzasv2"]
};

export function getIdColumnAndKey(tableName: string): { sheetCol: string; clientKey: string } {
  const upper = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upper];
  if (!schema) {
    return { sheetCol: "id", clientKey: "id" };
  }
  const idFields = ["id", "idparo", "idctrlfechador", "idctrlbalanza", "dni"];
  const sheetCol = schema.sheetHeaders.find(h => idFields.includes(h.toLowerCase())) || schema.sheetHeaders[0];
  const clientKey = schema.sheetToClient[sheetCol] || sheetCol;
  return { sheetCol, clientKey };
}

export function mapItemForSupabase(tableName: string, item: any): Record<string, any> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];

  if (!item) return {};

  // For PAROSV2, strictly construct the payload with the exact 26 column headers of the Supabase PostgreSQL table
  if (schema && upperTable === "PAROSV2") {
    const tempPayload: Record<string, any> = {};

    // 1. Process schema.sheetToClient and schema.clientToSheet mappings
    for (const [header, clientKey] of Object.entries(schema.sheetToClient)) {
      const cleanCol = sanitizeColumnName(header);
      let val = item[clientKey];
      if (val === undefined) val = item[header];
      if (val === undefined) val = item[cleanCol];

      if (val !== undefined && val !== null) {
        tempPayload[header] = getProcessedValue(header, clientKey, val);
      }
    }

    for (const [clientKey, header] of Object.entries(schema.clientToSheet)) {
      const cleanCol = sanitizeColumnName(header);
      let val = item[clientKey];
      if (val === undefined) val = item[header];
      if (val === undefined) val = item[cleanCol];

      if (val !== undefined && val !== null) {
        tempPayload[header] = getProcessedValue(header, clientKey, val);
      }
    }

    // 2. Direct copy for any keys matching exact schema headers
    for (const [key, val] of Object.entries(item)) {
      if (val !== undefined && val !== null && schema.sheetHeaders.includes(key)) {
        tempPayload[key] = getProcessedValue(key, key, val);
      }
    }

    // 3. Ensure durationTime ("HH:mm:ss") in "duración"
    if (item.durationMinutes !== undefined && item.durationMinutes !== null && !tempPayload["duración"]) {
      const mins = Number(item.durationMinutes) || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      tempPayload["duración"] = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    } else if (typeof tempPayload["duración"] === "number") {
      const mins = Number(tempPayload["duración"]) || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      tempPayload["duración"] = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    }

    // 4. Ensure machine affected ("máquina afectada")
    const macVal = item.machineHacText || item.machineName || item.machineId || tempPayload["máquina afectada"];
    if (macVal) {
      tempPayload["máquina afectada"] = macVal;
    }

    // 5. Ensure shift name ("turno")
    const shiftVal = item.shiftName || item.turno || item.shiftId || tempPayload["turno"];
    if (shiftVal) {
      tempPayload["turno"] = shiftVal;
    }

    // 6. Ensure ID ("idparo")
    const idVal = item.id || item.idparo || tempPayload["idparo"];
    if (idVal) {
      tempPayload["idparo"] = idVal;
    }

    // 7. Ensure date ("fecha", "fechafin")
    const dateVal = item.date || item.fecha || tempPayload["fecha"];
    if (dateVal) {
      const cleanDate = typeof dateVal === "string" ? dateVal.substring(0, 10) : dateVal;
      tempPayload["fecha"] = cleanDate;
      tempPayload["fechafin"] = item.finishDate || item.fechafin || cleanDate;
    }

    // 8. Default mandatory fields
    if (!tempPayload["centro"]) tempPayload["centro"] = item.center || "AMG0";
    if (!tempPayload["puesto de trabajo"]) tempPayload["puesto de trabajo"] = item.workCenter || "OPEREXP";
    if (!tempPayload["tipo paro"]) tempPayload["tipo paro"] = item.stopType || "Interno";

    // 9. Return strictly allowed columns matching PostgreSQL table
    const strictPayload: Record<string, any> = {};
    for (const header of schema.sheetHeaders) {
      if (tempPayload[header] !== undefined) {
        strictPayload[header] = tempPayload[header];
      }
    }
    return strictPayload;
  }

  // If a schema exists to enforce database alignment, strictly construct the payload
  // containing only valid database columns (preserving exact sheetHeaders column names).
  if (schema) {
    const allowedColumns = new Set<string>();
    const headerMap = new Map<string, string>(); // sanitized -> exact header

    for (const header of schema.sheetHeaders) {
      allowedColumns.add(header);
      const clean = sanitizeColumnName(header);
      allowedColumns.add(clean);
      headerMap.set(clean, header);
      headerMap.set(header, header);
    }

    const tempPayload: Record<string, any> = {};

    // 1. Copy original keys that map directly
    for (const [key, val] of Object.entries(item)) {
      if (val !== undefined && val !== null) {
        const cleanKey = sanitizeColumnName(key);
        let targetCol: string | undefined;
        if (allowedColumns.has(key)) {
          targetCol = key;
        } else if (allowedColumns.has(cleanKey)) {
          targetCol = headerMap.get(cleanKey) || cleanKey;
        }
        if (targetCol) {
          tempPayload[targetCol] = getProcessedValue(targetCol, key, val);
        }
      }
    }

    // 2. Process schema.clientToSheet mappings
    for (const [clientKey, header] of Object.entries(schema.clientToSheet)) {
      const cleanCol = sanitizeColumnName(header);
      const targetHeader = headerMap.get(header) || headerMap.get(cleanCol) || header;

      let val = item[clientKey];
      if (val === undefined) {
        val = item[header];
      }
      if (val === undefined) {
        val = item[targetHeader];
      }
      if (val === undefined) {
        val = item[cleanCol];
      }

      if (val !== undefined && val !== null) {
        tempPayload[targetHeader] = getProcessedValue(targetHeader, clientKey, val);
      }
    }

    // 3. Keep only columns present in sheetHeaders (using exact header names)
    const strictMapped: Record<string, any> = {};
    for (const header of schema.sheetHeaders) {
      if (tempPayload[header] !== undefined) {
        strictMapped[header] = tempPayload[header];
      } else {
        const clean = sanitizeColumnName(header);
        if (tempPayload[clean] !== undefined) {
          strictMapped[header] = tempPayload[clean];
        }
      }
    }

    // Explicit override for PAROS_BOQUILLASV2 so it maps production ID to id_produccion for Supabase
    if (upperTable === "PAROS_BOQUILLASV2") {
      const prodIdVal = item.productionId || item.produccion_id || item.id_produccion || tempPayload["produccion_id"];
      if (prodIdVal !== undefined && prodIdVal !== null) {
        strictMapped["id_produccion"] = prodIdVal;
        strictMapped["produccion_id"] = prodIdVal;
      }
    }

    if (upperTable === "PRODUCCIONV2") {
      const mId = item.machinistId || item.id_maquinista || item.maquinista_id || item.userId || item.usuario_id;
      const mName = item.machinistName || item.descripcion_maquinista || item.maquinista_nombre || item.userName || item.usuario_nombre;
      if (mId !== undefined && mId !== null) {
        strictMapped["id_maquinista"] = mId;
      }
      if (mName !== undefined && mName !== null) {
        strictMapped["descripcion_maquinista"] = mName;
      }
      
      // Cleanup columns that do not exist in the Supabase schema to prevent Self-Heal delays (PGRST204)
      delete strictMapped["maquinista_id"];
      delete strictMapped["maquinista_nombre"];
    }

    if (upperTable === "DETALLES_PRODUCCIONV2") {
      // Cleanup columns that do not exist in the Supabase schema to prevent Self-Heal delays (PGRST204)
      delete strictMapped["boquillas_turno"];
    }

    if (upperTable === "PUNTOS_CARGAV2") {
      const matIds = item.materialIds !== undefined ? item.materialIds : (item.material_ids !== undefined ? item.material_ids : tempPayload["material_ids"]);
      if (Array.isArray(matIds)) {
        strictMapped["material_ids"] = JSON.stringify(matIds);
      } else if (typeof matIds === "string") {
        strictMapped["material_ids"] = matIds;
      } else if (matIds === null || matIds === undefined) {
        strictMapped["material_ids"] = "[]";
      }
    }

    if (upperTable === "USUARIOSV2") {
      const perms = item.permissions !== undefined ? item.permissions : (item.permisos !== undefined ? item.permisos : tempPayload["permisos"]);
      if (typeof perms === "object" && perms !== null) {
        strictMapped["permisos"] = JSON.stringify(perms);
      } else if (typeof perms === "string") {
        strictMapped["permisos"] = perms;
      }
    }

    if (upperTable === "ESTADO_CALLESV2") {
      const matIds = item.materialIds !== undefined ? item.materialIds : (item.materiales_permitidos !== undefined ? item.materiales_permitidos : tempPayload["materiales_permitidos"]);
      if (Array.isArray(matIds)) {
        strictMapped["materiales_permitidos"] = JSON.stringify(matIds);
      } else if (typeof matIds === "string") {
        strictMapped["materiales_permitidos"] = matIds;
      } else if (matIds === null || matIds === undefined) {
        strictMapped["materiales_permitidos"] = "[]";
      }
    }

    return strictMapped;
  }

  // If no schema exists, fall back to best-effort key sanitization of original item attributes
  const mapped: Record<string, any> = {};
  for (const [key, val] of Object.entries(item)) {
    if (val !== undefined && val !== null) {
      const cleanKey = sanitizeColumnName(key);
      mapped[cleanKey] = getProcessedValue(cleanKey, key, val);
    }
  }

  return mapped;
}

export function mapSupabaseRowToClient(tableName: string, dbRow: any): any {
  if (!dbRow) return {};
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  const clientObj: any = {};

  const processValue = (val: any) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          return JSON.parse(trimmed);
        } catch (e) {
          return trimmed;
        }
      }
      return trimmed;
    }
    return val;
  };

  // 1. Iterate over the schema to prioritize mapping to clientKeys (camelCase keys)
  if (schema) {
    for (const [header, clientKey] of Object.entries(schema.sheetToClient)) {
      const cleanHeader = sanitizeColumnName(header);
      
      // Look up in dbRow with priority:
      // a) clientKey (camelCase)
      // b) header (Sheets literal name)
      // c) cleanHeader (sanitized snake_case)
      let val = dbRow[clientKey];
      if (val === undefined) {
        val = dbRow[header];
      }
      if (val === undefined) {
        val = dbRow[cleanHeader];
      }

      if (val !== undefined && val !== null) {
        const cleanClientKey = sanitizeColumnName(clientKey);
        if (BOOLEAN_COLUMNS.has(cleanHeader) || BOOLEAN_COLUMNS.has(cleanClientKey) || header.endsWith("?")) {
          clientObj[clientKey] = toBoolean(val);
        } else if (cleanClientKey === "date" || cleanClientKey === "finish_date" || cleanHeader === "fecha" || cleanHeader === "fechafin") {
          const processed = processValue(val);
          if (typeof processed === "string" && (/^\d{4}-\d{2}-\d{2}/.test(processed) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(processed))) {
            const dStr = processed.substring(0, 10);
            const dmy = dStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (dmy) {
              clientObj[clientKey] = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
            } else {
              clientObj[clientKey] = dStr;
            }
          } else {
            clientObj[clientKey] = processed;
          }
        } else {
          clientObj[clientKey] = processValue(val);
        }
      }
    }
  }

  // 2. Plus copy any other keys that are in the database row but weren't identified by sheetToClient
  for (const [key, val] of Object.entries(dbRow)) {
    if (val !== undefined && val !== null) {
      const existsInSchema = schema && Object.values(schema.sheetToClient).includes(key);
      if (!existsInSchema && clientObj[key] === undefined) {
        const cleanKey = sanitizeColumnName(key);
        if (cleanKey === "fecha" || cleanKey === "fechafin" || cleanKey === "date") {
          const processed = processValue(val);
          if (typeof processed === "string" && /^\d{4}-\d{2}-\d{2}/.test(processed)) {
            clientObj[key] = processed.substring(0, 10);
          } else {
            clientObj[key] = processed;
          }
        } else {
          clientObj[key] = processValue(val);
        }
      }
    }
  }

  // Special validations (from parseRowToClientObject)
  if (upperTable === "PAROSV2") {
    // 1. Ensure ID is mapped
    clientObj.id = processValue(dbRow.idparo || dbRow.id || clientObj.id);

    // 2. Ensure Dates are mapped
    const dVal = dbRow.fecha || dbRow.date || clientObj.date;
    if (dVal) {
      const cleanDate = typeof dVal === "string" ? dVal.substring(0, 10) : dVal;
      clientObj.date = cleanDate;
      clientObj.finishDate = dbRow.fechafin || dbRow.finishDate || clientObj.finishDate || cleanDate;
    }

    // 3. Ensure Machine fields are mapped
    const macVal = dbRow.maquina_afectada || dbRow["máquina afectada"] || dbRow.maquina_id || dbRow.machineId || dbRow.machineHacText || clientObj.machineHacText;
    if (macVal) {
      const processedMac = processValue(macVal);
      clientObj.machineHacText = processedMac;
      if (!clientObj.machineId) clientObj.machineId = processedMac;
      if (!clientObj.machineName) clientObj.machineName = processedMac;
    }

    // 4. Ensure Shift fields are mapped
    const shiftVal = dbRow.turno || dbRow.shiftName || dbRow.turno_id || dbRow.shiftId || clientObj.shiftName;
    if (shiftVal) {
      const processedShift = processValue(shiftVal);
      clientObj.shiftName = processedShift;
      if (!clientObj.shiftId) clientObj.shiftId = processedShift;
    }

    // 5. Ensure Material fields are mapped
    const matVal = dbRow.material || dbRow.materialDescription || dbRow.material_id || dbRow.materialId || clientObj.materialDescription;
    if (matVal) {
      const processedMat = processValue(matVal);
      clientObj.materialDescription = processedMat;
      if (!clientObj.materialId) clientObj.materialId = processedMat;
    }

    // 6. Ensure Times and durationMinutes
    const sTime = dbRow.inicio || dbRow.startTime || clientObj.startTime;
    const eTime = dbRow.fin || dbRow.endTime || clientObj.endTime;
    if (sTime) clientObj.startTime = typeof sTime === "string" && sTime.length === 8 ? sTime.slice(0, 5) : sTime;
    if (eTime) clientObj.endTime = typeof eTime === "string" && eTime.length === 8 ? eTime.slice(0, 5) : eTime;

    const durVal = dbRow.duracion || dbRow["duración"] || dbRow.durationTime || clientObj.durationTime;
    if (durVal) clientObj.durationTime = durVal;

    // Convert duration to numeric minutes
    if (durVal && typeof durVal === "string" && durVal.includes(":")) {
      const parts = durVal.split(":").map(Number);
      clientObj.durationMinutes = (parts[0] || 0) * 60 + (parts[1] || 0);
    } else if (dbRow.duration_minutes !== undefined) {
      clientObj.durationMinutes = Number(dbRow.duration_minutes) || 0;
    } else if (dbRow.durationMinutes !== undefined) {
      clientObj.durationMinutes = Number(dbRow.durationMinutes) || 0;
    } else if (clientObj.durationMinutes === undefined && clientObj.startTime && clientObj.endTime) {
      const [sh, sm] = String(clientObj.startTime).split(":").map(Number);
      const [eh, em] = String(clientObj.endTime).split(":").map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff < 0) diff += 24 * 60;
      clientObj.durationMinutes = diff;
    }

    // 7. Ensure other string fields
    if (!clientObj.causeText) clientObj.causeText = processValue(dbRow.texto_de_causa || dbRow["texto de causa"] || dbRow.causeText || "");
    if (!clientObj.noticeText) clientObj.noticeText = processValue(dbRow.texto_aviso || dbRow["texto aviso"] || dbRow.noticeText || clientObj.causeText || "");
    if (!clientObj.symptomText) clientObj.symptomText = processValue(dbRow.texto_sintoma || dbRow["texto síntoma"] || dbRow.symptomText || "");
    if (!clientObj.hacName) clientObj.hacName = processValue(dbRow.hac || dbRow.hacName || "");
    if (!clientObj.hacDetail) clientObj.hacDetail = processValue(dbRow.detalle_hac || dbRow["detalle hac"] || dbRow.hacDetail || "");
    if (!clientObj.equipment) clientObj.equipment = processValue(dbRow.equipo || dbRow.equipment || "");
    if (!clientObj.sapCause) clientObj.sapCause = processValue(dbRow.causa_sap || dbRow["causa sap"] || dbRow.sapCause || "");
    if (!clientObj.causeGroup) clientObj.causeGroup = processValue(dbRow.gpo_cod_causa || dbRow["gpo.cod. causa"] || dbRow.causeGroup || "");
    if (!clientObj.causeCode) clientObj.causeCode = processValue(dbRow.codigo_causa || dbRow["código causa"] || dbRow.causeCode || "");
    if (!clientObj.stopType) clientObj.stopType = processValue(dbRow.tipo_paro || dbRow["tipo paro"] || dbRow.stopType || "INTERNO");
    if (!clientObj.gpoCodObjeto) clientObj.gpoCodObjeto = processValue(dbRow.gpo_cod_objeto || dbRow["gpo.cód. objeto"] || dbRow.gpoCodObjeto || "");
    if (!clientObj.partObject) clientObj.partObject = processValue(dbRow.parte_objeto || dbRow["parte objeto"] || dbRow.partObject || "");
    if (!clientObj.symptomGroup) clientObj.symptomGroup = processValue(dbRow.gpo_cod_sintoma || dbRow["gpo.cód. sintoma"] || dbRow.symptomGroup || "");
    if (!clientObj.symptomCode) clientObj.symptomCode = processValue(dbRow.codigo_sintoma || dbRow["cód. sintoma"] || dbRow.symptomCode || "");
    if (!clientObj.user) clientObj.user = processValue(dbRow.usuario || dbRow.user || "");
    if (!clientObj.workCenter) clientObj.workCenter = processValue(dbRow.puesto_de_trabajo || dbRow["puesto de trabajo"] || dbRow.workCenter || "OPEREXP");
    if (!clientObj.center) clientObj.center = processValue(dbRow.centro || dbRow.center || "AMG0");
  }

  if (upperTable === "PRODUCCIONV2") {
    const mId = dbRow.id_maquinista || dbRow.maquinista_id || dbRow.usuario_id || dbRow.userId || dbRow.machinistId;
    const mName = dbRow.descripcion_maquinista || dbRow.maquinista_nombre || dbRow.usuario_nombre || dbRow.userName || dbRow.machinistName;
    if (mId !== undefined && mId !== null && (clientObj.machinistId === undefined || clientObj.machinistId === "")) {
      clientObj.machinistId = processValue(mId);
    }
    if (mName !== undefined && mName !== null && (clientObj.machinistName === undefined || clientObj.machinistName === "")) {
      clientObj.machinistName = processValue(mName);
    }
  }

  if (upperTable === "PAROS_BOQUILLASV2") {
    if (clientObj.isAllShift !== undefined) {
      clientObj.isAllShift = (clientObj.isAllShift === true || clientObj.isAllShift === "true" || clientObj.isAllShift === "SI" || clientObj.isAllShift === "TRUE" || clientObj.isAllShift === 1 || clientObj.isAllShift === "yes");
    }
    if (clientObj.nozzleNumber !== undefined) {
      clientObj.nozzleNumber = Number(clientObj.nozzleNumber) || 0;
    }
    // Correctly reconstruct productionId from whichever database column fields contain it
    if (clientObj.productionId === undefined) {
      const pId = dbRow.id_produccion || dbRow.produccion_id;
      if (pId !== undefined && pId !== null) {
        clientObj.productionId = processValue(pId);
      }
    }
  }

  if (upperTable === "CONTROL_FECHADORV2") {
    const numericFields = ["inkStock", "solventStock", "headsStock"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined) clientObj[f] = Number(clientObj[f]) || 0;
    });
    const p = clientObj.purge;
    clientObj.purge = (p === true || p === "true" || p === "SI" || p === "SÍ" || p === "TRUE" || p === 1) ? "SI" : "NO";
  }

  if (upperTable === "CONTROL_BALANZAV2") {
    const numericFields = ["weight1", "weight2", "weight3", "patternWeight", "average", "bias", "range"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined) clientObj[f] = Number(clientObj[f]) || 0;
    });
  }

  if (upperTable === "CLASISFICACION_PALLETSV2") {
    if (clientObj.quantity !== undefined) clientObj.quantity = Number(clientObj.quantity) || 0;
  }

  if (upperTable === "CAMBIO_PRODUCTOV2") {
    const booleanFields = [
      "siloValveClosed", "circuitEmptied", "machineCleaned", "hopperEmptied", "siloChanged",
      "setupChanged", "packagingChanged", "twoBigBagsPalletized", "colorSampling", "sampleSentToLab",
      "productReleased"
    ];
    booleanFields.forEach(f => {
      if (clientObj[f] !== undefined) {
        const val = clientObj[f];
        clientObj[f] = (val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1 || val === "CUMPLIDO");
      }
    });

    const numericFields = ["calcinationLoss", "incorporatedAir", "ckPercentageByDrx"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined && clientObj[f] !== "") {
        clientObj[f] = Number(clientObj[f]) || 0;
      }
    });
  }

  if (upperTable === "INVENTARIO_FISICOV2") {
    const numericFields = ["quantity", "weightTn"];
    numericFields.forEach(f => {
      if (clientObj[f] !== undefined) clientObj[f] = Number(clientObj[f]) || 0;
    });
  }

  if (upperTable === "ESTADO_CALLESV2") {
    if (clientObj.isEnabled !== undefined) {
      const val = clientObj.isEnabled;
      clientObj.isEnabled = (val === true || val === "true" || val === "SI" || val === "SÍ" || val === "Habilitada" || val === "Habilitado" || val === "TRUE" || val === 1);
    }
    const rawMatIds = clientObj.materialIds !== undefined ? clientObj.materialIds : dbRow.materiales_permitidos;
    if (typeof rawMatIds === "string") {
      const trimmed = rawMatIds.trim();
      if (trimmed.startsWith("[")) {
        try { clientObj.materialIds = JSON.parse(trimmed); } catch { clientObj.materialIds = []; }
      } else if (trimmed !== "") {
        clientObj.materialIds = trimmed.split(",").map((s: string) => s.trim()).filter(Boolean);
      } else {
        clientObj.materialIds = [];
      }
    } else if (Array.isArray(rawMatIds)) {
      clientObj.materialIds = rawMatIds;
    } else {
      clientObj.materialIds = [];
    }
  }

  if (upperTable === "PUNTOS_CARGAV2") {
    const rawMatIds = clientObj.materialIds !== undefined ? clientObj.materialIds : dbRow.material_ids;
    if (typeof rawMatIds === "string") {
      const trimmed = rawMatIds.trim();
      if (trimmed.startsWith("[")) {
        try { clientObj.materialIds = JSON.parse(trimmed); } catch { clientObj.materialIds = []; }
      } else if (trimmed !== "") {
        clientObj.materialIds = trimmed.split(",").map((s: string) => s.trim()).filter(Boolean);
      } else {
        clientObj.materialIds = [];
      }
    } else if (Array.isArray(rawMatIds)) {
      clientObj.materialIds = rawMatIds;
    } else {
      clientObj.materialIds = [];
    }
  }

  if (upperTable === "USUARIOSV2") {
    const rawPerms = clientObj.permissions !== undefined ? clientObj.permissions : dbRow.permisos;
    if (typeof rawPerms === "string") {
      try { clientObj.permissions = JSON.parse(rawPerms); } catch { clientObj.permissions = []; }
    } else if (Array.isArray(rawPerms)) {
      clientObj.permissions = rawPerms;
    }
  }

  return clientObj;
}

export function normalizeUniqueIds(tableName: string, list: any[]): any[] {
  if (!list || !Array.isArray(list)) return [];
  const { clientKey } = getIdColumnAndKey(tableName);
  const seenIds = new Set<string>();
  
  return list.map((item: any, idx: number) => {
    if (!item) return item;
    let idVal = item[clientKey];
    if (idVal === undefined || idVal === null || String(idVal).trim() === "") {
      idVal = `auto-${tableName.toLowerCase()}-${idx}-${Date.now().toString(36)}`;
      item[clientKey] = idVal;
    } else {
      const idStr = String(idVal).trim();
      if (seenIds.has(idStr)) {
        idVal = `${idStr}-dup-${idx}`;
        item[clientKey] = idVal;
      }
    }
    seenIds.add(String(idVal).trim());
    return item;
  });
}
