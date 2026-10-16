import { GenericRepository } from "../repositories/generic.repository.js";
import { getSupabaseClient } from "./supabase.service.js";
import { safeMatch, safeHacMatch } from "../utils/helpers.js";
import { invalidateCache } from "../cache/cache.service.js";
import { ParosService } from "./paros.service.js";

function isStopForMachine(stop: any, machineId: string | any, dbPalletizers: any[], dbBaggers: any[]) {
  if (!stop || !machineId) return false;
  
  let targetId = "";
  if (typeof machineId === 'object' && machineId !== null) {
    targetId = String(machineId.id || machineId.hacId || machineId.hac_id || machineId.name || machineId.nombre || "").trim().toUpperCase();
  } else {
    targetId = String(machineId).trim().toUpperCase();
  }
  
  if (!targetId) return false;

  const selectedMac = dbPalletizers.find((p: any) => p && (
    String(p.id).trim().toUpperCase() === targetId ||
    String(p.hacId || p.hac_id || "").trim().toUpperCase() === targetId ||
    String(p.name || p.nombre || "").trim().toUpperCase() === targetId
  )) || dbBaggers.find((b: any) => b && (
    String(b.id).trim().toUpperCase() === targetId ||
    String(b.hacId || b.hac_id || "").trim().toUpperCase() === targetId ||
    String(b.name || b.nombre || "").trim().toUpperCase() === targetId
  ));

  const stopMachineId = String(stop.machineId || stop.maquina_id || "").trim().toUpperCase();
  const stopMachineName = String(stop.machineName || stop.nombre_maquina || "").trim().toUpperCase();
  const stopMachineHacText = String(stop.machineHacText || stop.maquina_hac || "").trim().toUpperCase();

  if (!selectedMac) {
    return stopMachineId === targetId || stopMachineHacText === targetId || stopMachineName === targetId;
  }

  const macId = String(selectedMac.id).trim().toUpperCase();
  const macName = String(selectedMac.name || selectedMac.nombre || "").trim().toUpperCase();
  const macHacId = String(selectedMac.hacId || selectedMac.hac_id || "").trim().toUpperCase();

  const stopFields = [stopMachineId, stopMachineName, stopMachineHacText].filter(Boolean);
  const macFields = [macId, macName, macHacId].filter(Boolean);

  for (let i = 0; i < stopFields.length; i++) {
    for (let j = 0; j < macFields.length; j++) {
      if (stopFields[i] === macFields[j]) return true;
    }
  }

  const cleanStr = (val: string) => val.replace(/[^A-Z0-9]/g, '');
  const cleanStopFields = stopFields.map(cleanStr).filter(Boolean);
  const cleanMacFields = macFields.map(cleanStr).filter(Boolean);

  for (let i = 0; i < cleanStopFields.length; i++) {
    for (let j = 0; j < cleanMacFields.length; j++) {
      if (cleanStopFields[i] === cleanMacFields[j]) return true;
    }
  }

  if (macHacId && (stopMachineHacText.includes(macHacId) || macHacId.includes(stopMachineHacText))) return true;

  return false;
}

function isStopForShift(stop: any, shiftId: string | null | undefined, dbShifts: any[]) {
  if (!stop || !shiftId) return false;
  const targetId = String(shiftId).trim().toUpperCase();
  
  const selectedS = dbShifts.find((s: any) => s && String(s.id).trim().toUpperCase() === targetId);
  if (!selectedS) {
    const stopShiftId = String(stop.shiftId || '').trim().toUpperCase();
    return stopShiftId === targetId;
  }
  
  const sId = String(selectedS.id).trim().toUpperCase();
  const sName = String(selectedS.name || selectedS.nombre || "").trim().toUpperCase();
  
  const stopShiftId = String(stop.shiftId || "").trim().toUpperCase();
  const stopShiftName = String(stop.shiftName || stop.turno || "").trim().toUpperCase();
  
  if (stopShiftId === sId) return true;
  if (stopShiftName === sName) return true;
  if (stopShiftId === sName) return true;
  if (stopShiftName === sId) return true;
  
  const cleanSName = sName.replace("TURNO", "").trim();
  const cleanStopShiftName = stopShiftName.replace("TURNO", "").trim();
  if (cleanSName && cleanStopShiftName && cleanSName === cleanStopShiftName) return true;

  return false;
}

export class ProductionService {
  static async enrichProductionRecords(data: any[], dateOptions?: { date?: string; dateFrom?: string; dateTo?: string }): Promise<void> {
    if (!data || data.length === 0) return;
    try {
      // Determine targeted date filter for PAROSV2 so we do not download the entire historical table
      let parosFilter: { date?: string; dateFrom?: string; dateTo?: string } | undefined = undefined;
      if (dateOptions?.date) {
        parosFilter = { date: dateOptions.date };
      } else if (dateOptions?.dateFrom && dateOptions?.dateTo) {
        parosFilter = { dateFrom: dateOptions.dateFrom, dateTo: dateOptions.dateTo };
      } else {
        const uniqueDates = Array.from(new Set(data.map(item => String(item.date || item.fecha || "").substring(0, 10)).filter(Boolean)));
        if (uniqueDates.length === 1) {
          parosFilter = { date: uniqueDates[0] };
        } else if (uniqueDates.length > 1) {
          uniqueDates.sort();
          parosFilter = { dateFrom: uniqueDates[0], dateTo: uniqueDates[uniqueDates.length - 1] };
        }
      }

      // Collect specific production IDs in this batch to only query details for these reports
      const prodIds = data.map((item: any) => String(item.id || item.ID || "")).filter(Boolean);

      const [dbShifts, dbPalletizers, dbBaggers, dbMaterials, dbHacs, dbParos, dbCauses, dbCapacities, dbDetails, dbUsers] = await Promise.all([
        GenericRepository.findAll("TURNOSV2").catch(() => []),
        GenericRepository.findAll("PALETIZADORAV2").catch(() => []),
        GenericRepository.findAll("ENSACADORAV2").catch(() => []),
        GenericRepository.findAll("MATERIALESV2").catch(() => []),
        GenericRepository.findAll("HACSV2").catch(() => []),
        GenericRepository.findAll("PAROSV2", parosFilter).catch(() => []),
        GenericRepository.findAll("CAUSASV2").catch(() => []),
        GenericRepository.findAll("CAPACIDADESV2").catch(() => []),
        (prodIds.length > 0 ? GenericRepository.findAll("DETALLES_PRODUCCIONV2", { productionIds: prodIds }) : Promise.resolve([])).catch(() => []),
        GenericRepository.findAll("USUARIOSV2").catch(() => []),
      ]);

      await ParosService.enrichParosOnRead(dbParos);

      // Fast Lookup Map for Users by DNI, id, or SAP user
      const userMap = new Map<string, any>();
      for (let i = 0; i < dbUsers.length; i++) {
        const u = dbUsers[i];
        if (!u) continue;
        if (u.dni) userMap.set(String(u.dni).trim().toUpperCase(), u);
        if (u.id) userMap.set(String(u.id).trim().toUpperCase(), u);
        if (u.sapUser) userMap.set(String(u.sapUser).trim().toUpperCase(), u);
        if (u.name) userMap.set(String(u.name).trim().toUpperCase(), u);
      }

      // Fast Lookup Map for DETALLES_PRODUCCIONV2 grouped by productionId
      const detailsByProdId = new Map<string, any[]>();
      for (let i = 0; i < dbDetails.length; i++) {
        const d = dbDetails[i];
        if (!d) continue;
        const pId = String(d.productionId || d.produccion_id || d.id_produccion || "").trim();
        if (pId) {
          if (!detailsByProdId.has(pId)) detailsByProdId.set(pId, []);
          detailsByProdId.get(pId)!.push(d);
        }
      }

      // Fast Lookup Map for PAROSV2 grouped by Date string YYYY-MM-DD
      const parosByDate = new Map<string, any[]>();
      for (let i = 0; i < dbParos.length; i++) {
        const s = dbParos[i];
        if (!s) continue;
        const dateStr = String(s.date || "").substring(0, 10);
        if (dateStr) {
          if (!parosByDate.has(dateStr)) parosByDate.set(dateStr, []);
          parosByDate.get(dateStr)!.push(s);
        }
      }

      // Fast Lookup Map for CAUSASV2 indexed by ID and Text
      const causeMap = new Map<string, any>();
      for (let i = 0; i < dbCauses.length; i++) {
        const c = dbCauses[i];
        if (!c) continue;
        if (c.id) causeMap.set(String(c.id).trim(), c);
        if (c.text) causeMap.set(String(c.text).trim(), c);
        if (c.descripcion) causeMap.set(String(c.descripcion).trim(), c);
      }

      // Fast Lookup Map for Context Reports grouped by Date|ShiftId|PalletizerId
      const reportsByContextKey = new Map<string, any[]>();
      for (let i = 0; i < data.length; i++) {
        const r = data[i];
        if (!r) continue;
        const dStr = String(r.date || "").substring(0, 10);
        const sId = String(r.shiftId || r.turno_id || "").trim();
        const pId = String(r.palletizerId || r.palletizadora_id || "").trim();
        const key = `${dStr}|${sId}|${pId}`;
        
        if (!reportsByContextKey.has(key)) reportsByContextKey.set(key, []);
        reportsByContextKey.get(key)!.push(r);
      }

      data.forEach((item: any) => {
        const itemProdId = String(item.id || "").trim();
        const shiftId = item.shiftId || item.turno_id;
        const shift = dbShifts.find((s: any) => s && (safeMatch(s.id, shiftId) || safeMatch(s.id, item.shiftId)));
        const shiftName = shift ? (shift.name || shift.nombre || "") : "";
        item.shiftDescription = shiftName;
        item["descripción_turno"] = shiftName;
        item["descripcion_turno"] = shiftName;

        const palId = item.palletizerId || item.palletizadora_id;
        const pal = dbPalletizers.find((p: any) => p && safeMatch(p.id, palId));
        const palHacId = pal ? (pal.hacId || pal.hac_id) : "";
        const hacPal = dbHacs.find((h: any) => h && (safeMatch(h.id, palHacId) || safeMatch(h.hac, palHacId)));
        const palHacVal = hacPal ? (hacPal.hac || "") : (palHacId || "");
        item.palletizerHac = palHacVal;
        item["hac_paletizadora"] = palHacVal;

        const bagId = item.baggerId || item.ensacadora_id;
        const bag = dbBaggers.find((b: any) => b && safeMatch(b.id, bagId));
        const bagHacId = bag ? (bag.hacId || bag.hac_id) : "";
        const hacBag = dbHacs.find((h: any) => h && (safeMatch(h.id, bagHacId) || safeMatch(h.hac, bagHacId)));
        const bagHacVal = hacBag ? (hacBag.hac || "") : (bagHacId || "");
        item.baggerHac = bagHacVal;
        item["hac_ensacadora"] = bagHacVal;

        // O(1) lookup for details on item
        const rDetailsOnItem = detailsByProdId.get(itemProdId) || [];
        const matId = item.materialId || item.material_id || (rDetailsOnItem[0] ? (rDetailsOnItem[0].materialId || rDetailsOnItem[0].material_id) : "");
        const mat = dbMaterials.find((m: any) => m && safeMatch(m.id, matId));
        const matName = mat ? (mat.nombre || mat.name || "") : "";
        item.materialDescription = matName;
        item["decripcion_material"] = matName;
        item["descripcion_material"] = matName;

        const shiftDurationHours = shift ? Number(shift.durationHours || 8) : 8;

        const itemDateStr = String(item.date || "").substring(0, 10);
        const candidatesForDate = parosByDate.get(itemDateStr) || [];
        
        const stops = candidatesForDate.filter((s: any) => 
          s &&
          isStopForShift(s, shiftId, dbShifts) &&
          isStopForMachine(s, palId, dbPalletizers, dbBaggers)
        );
        
        const stopMins = stops.reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
        let hsMarcha = Math.max(0, shiftDurationHours - (stopMins / 60));

        const tisVal = item.hsMarchaTis !== undefined && item.hsMarchaTis !== null ? Number(item.hsMarchaTis) : 0;
        if (tisVal > 0) {
          hsMarcha = tisVal;
        }

        const externalStopMinutes = stops
          .filter((s: any) => {
            const causeKey = String(s.causeId || s.causeText || "").trim();
            const c = causeMap.get(causeKey);
            return (c && c.stopType === 'EXTERNO') || s.stopType === 'EXTERNO';
          })
          .reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
        const externalStopHours = externalStopMinutes / 60;

        let availabilityPercent = 100;
        if (shiftDurationHours > 0) {
          availabilityPercent = ((externalStopHours + hsMarcha) / shiftDurationHours) * 100;
        }
        const availStr = `${Math.min(100, Math.round(availabilityPercent))}%`;
        item.availability = availStr;
        item.disponibilidad = availStr;

        // Context report lookup using indexed context keys
        const contextKey = `${itemDateStr}|${String(shiftId || "").trim()}|${String(palId || "").trim()}`;
        const contextReports = reportsByContextKey.get(contextKey) || [];

        let yieldPercent = 100;
        if (contextReports.length > 0 && hsMarcha > 0) {
          let totalTons = 0;
          let sumTonsOverBDP = 0;

          contextReports.forEach((r: any) => {
            const rId = String(r.id || "").trim();
            const rDetails = detailsByProdId.get(rId) || [];

            if (rDetails.length > 0) {
              rDetails.forEach((det: any) => {
                const detTons = Number(det.tonsProduced || det.tn_producidas) || 0;
                totalTons += detTons;

                const detMatId = det.materialId || det.material_id;
                const cap = dbCapacities.find((c: any) => 
                  String(c.palletizerId || "").trim().toUpperCase() === String(r.palletizerId || "").trim().toUpperCase() &&
                  String(c.baggerId || "").trim().toUpperCase() === String(r.baggerId || "").trim().toUpperCase() &&
                  String(c.materialId || "").trim().toUpperCase() === String(detMatId || "").trim().toUpperCase()
                );

                const bdpVal = cap ? Number(cap.bdp) : (Number(det.bdp || det.bdp_teorico) || 100);
                if (bdpVal > 0) {
                  sumTonsOverBDP += detTons / bdpVal;
                } else {
                  sumTonsOverBDP += detTons / 100;
                }
              });
            } else {
              const tons = Number(r.tonsProduced) || 0;
              totalTons += tons;

              const matId = r.materialId || r.material_id;
              const cap = dbCapacities.find((c: any) => 
                String(c.palletizerId || "").trim().toUpperCase() === String(r.palletizerId || "").trim().toUpperCase() &&
                String(c.baggerId || "").trim().toUpperCase() === String(r.baggerId || "").trim().toUpperCase() &&
                String(c.materialId || "").trim().toUpperCase() === String(matId || "").trim().toUpperCase()
              );

              const bdpVal = cap ? Number(cap.bdp) : (Number(r.bdp) || 100);
              if (bdpVal > 0) {
                sumTonsOverBDP += tons / bdpVal;
              } else {
                sumTonsOverBDP += tons / 100;
              }
            }
          });

          if (totalTons > 0 && sumTonsOverBDP > 0) {
            const rate = totalTons / hsMarcha;
            const bdpPonderado = totalTons / sumTonsOverBDP;
            yieldPercent = (rate / bdpPonderado) * 100;
          } else {
            yieldPercent = 0;
          }
        } else {
          yieldPercent = 0;
        }
        
        const yieldStr = `${Math.round(yieldPercent)}%`;
        item.yield = yieldStr;
        item.rendimiento = yieldStr;

        const oeePercent = (availabilityPercent / 100) * (yieldPercent / 100) * 100;
        const oeeStr = `${Math.round(oeePercent)}%`;
        item.oee = oeeStr;

        // Machinist Enrichment
        const machId = String(item.machinistId || item.id_maquinista || item.maquinista_id || item.userId || item.usuario_id || "").trim();
        let machName = String(item.machinistName || item.descripcion_maquinista || item.maquinista_nombre || item.userName || item.usuario_nombre || "").trim();
        if (!machName && machId) {
          const u = userMap.get(machId.toUpperCase());
          if (u) machName = u.name || u.nombre || "";
        }
        item.machinistId = machId;
        item.machinistName = machName;
        item["id_maquinista"] = machId;
        item["maquinista_id"] = machId;
        item["descripcion_maquinista"] = machName;
        item["maquinista_nombre"] = machName;
      });
    } catch (enrichError) {
      console.error("Error enriching production data:", enrichError);
    }
  }

  static async autoRecalculateProductionMetrics(): Promise<void> {
    // TEMPORARILY DISABLED: Prevent massive background updates to all records on every single edit.
    // The metrics are already calculated on-the-fly during GET requests.
    return;
  }

  static async deleteNozzlesForProduction(productionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const cleanProdId = String(productionId || "").trim();
      if (!cleanProdId) return;
      await supabase.from("paros_boquillasv2").delete().eq("produccion_id", cleanProdId);
      invalidateCache("PAROS_BOQUILLASV2");
    } catch (err) {
      console.error("Error deleting old nozzles for productionId " + productionId + ":", err);
    }
  }

  static async syncProductionNozzles(item: any): Promise<void> {
    if (!item.nozzleNews || !Array.isArray(item.nozzleNews)) return;
    try {
      const nozzleNewsEntries = item.nozzleNews.map((news: any) => ({
        id: news.id,
        productionId: item.id,
        nozzleNumber: news.nozzleNumber,
        startTime: news.startTime,
        endTime: news.endTime,
        isAllShift: news.isAllShift === true || news.isAllShift === "true" || news.isAllShift === "SI" ? "SI" : "NO",
        observation: news.observation || ""
      }));

      await ProductionService.deleteNozzlesForProduction(item.id);

      for (let i = 0; i < nozzleNewsEntries.length; i++) {
        await GenericRepository.create("PAROS_BOQUILLASV2", nozzleNewsEntries[i]);
      }
    } catch (err) {
      console.error("Error syncing production nozzles:", err);
    }
  }

  static async deleteDetailsForProduction(productionId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const cleanProdId = String(productionId || "").trim();
      if (!cleanProdId) return;
      await supabase.from("detalles_produccionv2").delete().eq("produccion_id", cleanProdId);
      invalidateCache("DETALLES_PRODUCCIONV2");
    } catch (err) {
      console.error("Error deleting old details for productionId " + productionId + ":", err);
    }
  }

  static async syncProductionDetails(item: any): Promise<void> {
    if (!item.materialsDetails || !Array.isArray(item.materialsDetails)) return;
    try {
      const detailEntries = item.materialsDetails.map((det: any) => ({
        id: det.id || Math.random().toString(36).substr(2, 9),
        productionId: item.id,
        materialId: det.materialId,
        materialDescription: det.materialDescription || det.materialName || "",
        bagsProduced: Number(det.bagsProduced || det.bags || 0),
        tonsProduced: Number(det.tonsProduced || det.tons || 0),
        bdp: Number(det.bdp || det.bdp_teorico || 0),
        availableNozzlesShift: Number(det.availableNozzlesShift || 0),
        bagProvider: det.bagProvider || "",
        discardedBagsBagger: Number(det.discardedBagsBagger || 0),
        notNozzledBags: Number(det.notNozzledBags || 0),
        discardedBagsVentocheck: Number(det.discardedBagsVentocheck || 0),
        discardedBagsTransport: Number(det.discardedBagsTransport || 0),
        observacion: det.observacion || ""
      }));

      await ProductionService.deleteDetailsForProduction(item.id);

      for (let i = 0; i < detailEntries.length; i++) {
        await GenericRepository.create("DETALLES_PRODUCCIONV2", detailEntries[i]);
      }
    } catch (err) {
      console.error("Error syncing production details:", err);
    }
  }

  static async syncProductionChildren(item: any): Promise<void> {
    await ProductionService.syncProductionNozzles(item);
    await ProductionService.syncProductionDetails(item);
  }

  static async deleteProductionChildren(productionId: string): Promise<void> {
    await ProductionService.deleteNozzlesForProduction(productionId);
    await ProductionService.deleteDetailsForProduction(productionId);
  }

  static async enrichProductionReportsWithNozzleNews(list: any[]): Promise<void> {
    if (!list || list.length === 0) return;
    try {
      const prodIds = list.map((item: any) => String(item.id || item.ID || "")).filter(Boolean);
      const nozzleList = prodIds.length > 0
        ? await GenericRepository.findAll("PAROS_BOQUILLASV2", { productionIds: prodIds })
        : [];
      const nozzleMap = new Map<string, any[]>();

      for (let i = 0; i < nozzleList.length; i++) {
        const n = nozzleList[i];
        if (!n) continue;
        const pId = String(n.productionId || n.produccion_id || n.id_produccion || "").trim();
        if (pId) {
          if (!nozzleMap.has(pId)) nozzleMap.set(pId, []);
          nozzleMap.get(pId)!.push(n);
        }
      }

      list.forEach((item: any) => {
        const pId = String(item.id || "").trim();
        item.nozzleNews = nozzleMap.get(pId) || [];
      });
    } catch (err) {
      console.error("Error fetching PAROS_BOQUILLASV2 on read:", err);
      list.forEach((item: any) => {
        item.nozzleNews = [];
      });
    }
  }

  static async enrichProductionReportsWithDetails(list: any[]): Promise<void> {
    if (!list || list.length === 0) return;
    try {
      const prodIds = list.map((item: any) => String(item.id || item.ID || "")).filter(Boolean);
      const detailsList = prodIds.length > 0
        ? await GenericRepository.findAll("DETALLES_PRODUCCIONV2", { productionIds: prodIds })
        : [];
      const detailsMap = new Map<string, any[]>();

      for (let i = 0; i < detailsList.length; i++) {
        const d = detailsList[i];
        if (!d) continue;
        const pId = String(d.productionId || d.produccion_id || d.id_produccion || "").trim();
        if (pId) {
          if (!detailsMap.has(pId)) detailsMap.set(pId, []);
          detailsMap.get(pId)!.push(d);
        }
      }

      list.forEach((item: any) => {
        const pId = String(item.id || "").trim();
        item.materialsDetails = detailsMap.get(pId) || [];
      });
    } catch (err) {
      console.warn("Error fetching DETALLES_PRODUCCIONV2 on read:", err);
      list.forEach((item: any) => {
        item.materialsDetails = [];
      });
    }
  }
}