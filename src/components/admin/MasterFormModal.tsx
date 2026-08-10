import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import { X, Save, Search, Check, ChevronDown, ChevronRight } from "lucide-react";
import { MasterData } from "../../types";
import { cn } from "../../lib/utils";
import {
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassSearchableSelect,
} from "../ui/GlassUI";
import { SYSTEM_VIEWS } from "../../lib/mockData";

const calculateShiftDuration = (start: string, end: string): number => {
  if (!start || !end) return 8;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 8;
  
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  
  if (endMins <= startMins) {
    endMins += 24 * 60; // cross midnight
  }
  
  const diffMins = endMins - startMins;
  return Math.round((diffMins / 60) * 100) / 100;
};

export function MasterFormModal({ type, item, onClose, onSave, masters, currentUser }: any) {
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(() => {
    if (item) return item;
    if (type === "CONTROLES_BALANZAS" || type === "PARAMETROS_BALANZA") {
      return {
        positiveBiasTolerance: 0.02,
        negativeBiasTolerance: -0.02,
        positiveRangeTolerance: 0.01,
        negativeRangeTolerance: -0.01,
        tolerancia_positiva_bias: 0.02,
        tolerancia_negativa_bias: -0.02,
        tolerancia_positiva_rango: 0.01,
        tolerancia_negativa_rango: -0.01
      };
    }
    return {
      permissions: SYSTEM_VIEWS.map((v) => ({
        viewId: v.id,
        label: v.label,
        section: v.section,
        level: "NONE",
      })),
    };
  });

  const handleMaterialToggle = (materialId: string) => {
    const currentList = formData.materialIds || [];
    const newList = currentList.includes(materialId)
      ? currentList.filter((id: string) => id !== materialId)
      : [...currentList, materialId];
    setFormData({ ...formData, materialIds: newList });
  };

  const [productivityExpanded, setProductivityExpanded] = useState(true);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  const filteredMaterials = useMemo(() => {
    return masters.materials.filter((m: any) =>
      String(m.name || "").toLowerCase().includes(materialSearch.toLowerCase())
    );
  }, [masters.materials, materialSearch]);

  const typeNames: Record<string, { name: string; female?: boolean }> = {
    SHIFTS: { name: "Turno", female: false },
    MACHINES: { name: "Maquina", female: true },
    BAGGERS: { name: "Ensacadora", female: true },
    HACS: { name: "Equipo", female: false },
    CAUSES: { name: "Causa", female: true },
    MATERIALS: { name: "Material", female: false },
    CAPACITIES: { name: "Capacidad", female: true },
    USERS: { name: "Usuario", female: false },
    COMPANIES: { name: "Empresa", female: true },
    PUNTOS_CARGA: { name: "Punto de Carga", female: false },
    LOADING_POINTS: { name: "Punto de Carga", female: false },
    PROVEEDORES_BOLSA: { name: "Proveedor de Bolsa", female: false },
    VEHICULOS: { name: "Vehículo", female: false },
    CONTROLES_BALANZAS: { name: "Parámetro de Balanza", female: false },
    PARAMETROS_BALANZA: { name: "Parámetro de Balanza", female: false },
  };

  const config = typeNames[type] || { name: type, female: false };
  const title = item
    ? `Editar ${config.name}`
    : `Nuev${config.female ? "a" : "o"} ${config.name}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    let finalData = { ...formData };

    // Auto-generate ID if missing for all types
    if (!finalData.id && !finalData.ID && type !== "USERS") {
      const prefix =
        type === "CAPACITIES" ? "CAP" : 
        type === "CONTROLES_BALANZAS" || type === "PARAMETROS_BALANZA" ? "PARAM-BAL" :
        type.substring(0, 3).toUpperCase();
      finalData.id =
        `${prefix}-` + Math.random().toString(36).substr(2, 4).toUpperCase();
      if (type === "BAGGERS") finalData.type = "ENSACADORA";
    }

    if (type === "CONTROLES_BALANZAS" || type === "PARAMETROS_BALANZA") {
      const parseNum = (val: any, def: number) => {
        if (typeof val === 'number') return isNaN(val) ? def : val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val.replace(',', '.').trim());
          return isNaN(parsed) ? def : parsed;
        }
        return def;
      };

      const ensurePositive = (num: number) => Math.abs(num);
      const ensureNegative = (num: number) => -Math.abs(num);

      finalData.positiveBiasTolerance = ensurePositive(parseNum(finalData.positiveBiasTolerance ?? finalData.tolerancia_positiva_bias, 0.02));
      finalData.negativeBiasTolerance = ensureNegative(parseNum(finalData.negativeBiasTolerance ?? finalData.tolerancia_negativa_bias, -0.02));
      finalData.positiveRangeTolerance = ensurePositive(parseNum(finalData.positiveRangeTolerance ?? finalData.tolerancia_positiva_rango, 0.01));
      finalData.negativeRangeTolerance = ensureNegative(parseNum(finalData.negativeRangeTolerance ?? finalData.tolerancia_negativa_rango, -0.01));

      finalData.tolerancia_positiva_bias = finalData.positiveBiasTolerance;
      finalData.tolerancia_negativa_bias = finalData.negativeBiasTolerance;
      finalData.tolerancia_positiva_rango = finalData.positiveRangeTolerance;
      finalData.tolerancia_negativa_rango = finalData.negativeRangeTolerance;

      // Register modification audit log
      let prevHistory: any[] = [];
      const rawHist = item?.modificationHistory ?? item?.historial_modificacion ?? formData.modificationHistory ?? formData.historial_modificacion;
      if (Array.isArray(rawHist)) {
        prevHistory = rawHist;
      } else if (typeof rawHist === 'string' && rawHist.trim() !== '' && rawHist.trim() !== '{}') {
        try {
          const parsed = JSON.parse(rawHist);
          if (Array.isArray(parsed)) prevHistory = parsed;
        } catch {}
      }

      const activeUser = currentUser || masters?.currentUser || {};
      const newAuditLog = {
        fecha: new Date().toISOString(),
        usuario_dni: activeUser.dni || 'ADMIN',
        usuario_nombre: activeUser.name || 'Administrador',
        valores_anteriores: {
          tolerancia_positiva_bias: item?.positiveBiasTolerance ?? item?.tolerancia_positiva_bias ?? 0.02,
          tolerancia_negativa_bias: item?.negativeBiasTolerance ?? item?.tolerancia_negativa_bias ?? -0.02,
          tolerancia_positiva_rango: item?.positiveRangeTolerance ?? item?.tolerancia_positiva_rango ?? 0.01,
          tolerancia_negativa_rango: item?.negativeRangeTolerance ?? item?.tolerancia_negativa_rango ?? -0.01
        },
        valores_nuevos: {
          tolerancia_positiva_bias: finalData.positiveBiasTolerance,
          tolerancia_negativa_bias: finalData.negativeBiasTolerance,
          tolerancia_positiva_rango: finalData.positiveRangeTolerance,
          tolerancia_negativa_rango: finalData.negativeRangeTolerance
        }
      };

      finalData.modificationHistory = [...prevHistory, newAuditLog];
      finalData.historial_modificacion = finalData.modificationHistory;
    }

    // For users, we use DNI as ID if needed but essentially DNI is the key
    if (type === "USERS") {
      const cleanDni = String(finalData.dni || "").replace(/\D/g, "");
      if (!cleanDni) {
        setError("El DNI / LEGAJO es requerido y debe contener solo números.");
        return;
      }
      finalData.dni = cleanDni;

      if (finalData.profile === "Administrador") {
        finalData.permissions = SYSTEM_VIEWS.map((v: any) => ({
          viewId: v.id,
          label: v.label,
          section: v.section,
          level: "EDIT",
        }));
      }
    }

    onSave(finalData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "w-full bg-surface-elevated border border-border rounded-2xl shadow-2xl overflow-hidden z-[201]",
          type === "USERS"
            ? "max-w-4xl max-h-[90vh] overflow-y-auto"
            : type === "PUNTOS_CARGA" || type === "LOADING_POINTS"
            ? "max-w-2xl max-h-[90vh] overflow-y-auto"
            : "max-w-lg",
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-text-main uppercase tracking-tight">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-text-main transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-xl uppercase tracking-wider">
                ⚠️ {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {type === "SHIFTS" && (
                <>
                  <GlassInput
                    label="Nombre"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Inicio"
                    type="time"
                    value={formData.startTime || ""}
                    onChange={(e: any) => {
                      const startVal = e.target.value;
                      setFormData({
                        ...formData,
                        startTime: startVal,
                        durationHours: calculateShiftDuration(startVal, formData.endTime || "")
                      });
                    }}
                  />
                  <GlassInput
                    label="Fin"
                    type="time"
                    value={formData.endTime || ""}
                    onChange={(e: any) => {
                      const endVal = e.target.value;
                      setFormData({
                        ...formData,
                        endTime: endVal,
                        durationHours: calculateShiftDuration(formData.startTime || "", endVal)
                      });
                    }}
                  />
                  <GlassInput
                    label="Horas"
                    type="number"
                    value={formData.durationHours || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        durationHours: parseFloat(e.target.value),
                      })
                    }
                  />
                </>
              )}

              {type === "MACHINES" && (
                <>
                  <GlassInput
                    label="Descripción"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="HAC ID"
                    value={formData.hacId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hacId: e.target.value })
                    }
                  />
                </>
              )}

              {type === "BAGGERS" && (
                <>
                  <GlassInput
                    label="Descripción"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="HAC ID"
                    value={formData.hacId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hacId: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Boquillas"
                    type="number"
                    value={formData.nozzles || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        nozzles: parseInt(e.target.value),
                      })
                    }
                  />
                  <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <input
                      type="checkbox"
                      id="isSamplingPoint"
                      checked={formData.isSamplingPoint || false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isSamplingPoint: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-border text-primary cursor-pointer"
                    />
                    <label
                      htmlFor="isSamplingPoint"
                      className="text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Es Punto de Muestreo?
                    </label>
                  </div>
                </>
              )}

              {type === "HACS" && (
                <>
                  <GlassInput
                    label="HAC"
                    value={formData.hac || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hac: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Detalle HAC"
                    value={formData.detail || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, detail: e.target.value })
                    }
                  />
                  <GlassInput
                    label="GPO.CÓD. OBJETO (SAP)"
                    value={formData.gpoCodObjeto || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, gpoCodObjeto: e.target.value })
                    }
                  />
                  <GlassInput
                    label="EQUIPO (SAP)"
                    value={formData.equipment || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, equipment: e.target.value })
                    }
                  />
                  <div className="flex gap-6 p-4 bg-primary/5 rounded-xl border border-primary/10 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isDater || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isDater: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/50"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">
                        Control Fechador?
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.isScale || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isScale: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/50"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">
                        Control Balanza?
                      </span>
                    </label>
                  </div>
                </>
              )}

              {type === "CAUSES" && (
                <>
                  <GlassSearchableSelect
                    label="HAC"
                    options={(masters.hacs || []).map((h: any) => ({
                      label: h.hac,
                      value: h.hac,
                      searchTags: [h.hac, h.detail]
                    }))}
                    value={formData.hac || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, hac: e.target.value })
                    }
                    placeholder="Buscar y seleccionar HAC..."
                  />
                  <GlassInput
                    label="Texto de Causa"
                    value={formData.text || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, text: e.target.value })
                    }
                  />
                  <GlassSelect
                    label="Tipo de Paro"
                    options={[
                      { label: "INTERNO", value: "INTERNO" },
                      { label: "EXTERNO", value: "EXTERNO" },
                    ]}
                    value={String(formData.stopType || formData.tipo_paro || formData.tipoParo || formData["TIPO PARO"] || formData["tipo paro"] || "").trim().toUpperCase()}
                    onChange={(e: any) => {
                      const val = e.target.value;
                      setFormData({ 
                        ...formData, 
                        stopType: val,
                        tipo_paro: val,
                        tipoParo: val,
                        "TIPO PARO": val,
                        "tipo paro": val
                      });
                    }}
                  />
                  <GlassInput
                    label="Parte Objeto (SAP)"
                    value={formData.partObject || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, partObject: e.target.value })
                    }
                  />
                  <GlassInput
                    label="GPO.CÓD. SÍNTOMA (SAP)"
                    value={formData.symptomGroup || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, symptomGroup: e.target.value })
                    }
                  />
                  <GlassInput
                    label="CÓD. SÍNTOMA (SAP)"
                    value={formData.symptomCode || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, symptomCode: e.target.value })
                    }
                  />
                  <GlassInput
                    label="CAUSA SAP (SAP)"
                    value={formData.sapCause || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, sapCause: e.target.value })
                    }
                  />
                  <GlassInput
                    label="GPO.COD. CAUSA (SAP)"
                    value={formData.causeGroup || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, causeGroup: e.target.value })
                    }
                  />
                  <GlassInput
                    label="CÓDIGO CAUSA (SAP)"
                    value={formData.causeCode || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, causeCode: e.target.value })
                    }
                  />
                </>
              )}

              {type === "MATERIALS" && (
                <>
                  <GlassInput
                    label="Descripción"
                    value={formData.name || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Código SAP"
                    value={formData.code || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                  />
                  <GlassInput
                    label="P. Embalaje (kg)"
                    type="number"
                    value={formData.packingWeight || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        packingWeight: parseFloat(e.target.value),
                      })
                    }
                  />
                  <GlassInput
                    label="P. Bolsa (kg)"
                    type="number"
                    value={formData.bagWeight || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        bagWeight: parseFloat(e.target.value),
                      })
                    }
                  />

                  <div className="md:col-span-2 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isPallet"
                        checked={formData.isPallet || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isPallet: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isPallet"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Tarima
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isProductive"
                        checked={formData.isProductive || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isProductive: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isProductive"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Productivo
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isSupply"
                        checked={formData.isSupply || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isSupply: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isSupply"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Insumo
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isBigBag"
                        checked={formData.isBigBag || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isBigBag: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isBigBag"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es BigBag
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isDispatch"
                        checked={formData.isDispatch || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isDispatch: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isDispatch"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Despacho
                      </label>
                    </div>
                    <div className="flex items-center gap-3 bg-bg-input p-3 rounded-lg border border-border">
                      <input
                        type="checkbox"
                        id="isBulk"
                        checked={formData.isBulk || false}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isBulk: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <label
                        htmlFor="isBulk"
                        className="text-xs font-bold text-text-main uppercase"
                      >
                        Es Granel
                      </label>
                    </div>
                  </div>
                </>
              )}

              {type === "CAPACITIES" && (
                <>
                  <GlassSelect
                    label="Paletizadora"
                    options={masters.palletizers.map((p: any) => ({
                      label: p.name,
                      value: p.id,
                    }))}
                    value={formData.palletizerId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, palletizerId: e.target.value })
                    }
                  />
                  <GlassSelect
                    label="Ensacadora"
                    options={masters.baggers.map((b: any) => ({
                      label: b.name,
                      value: b.id,
                    }))}
                    value={formData.baggerId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, baggerId: e.target.value })
                    }
                  />
                  <GlassSelect
                    label="Material (Productivo)"
                    options={masters.materials
                      .filter((m: any) => m.isProductive)
                      .map((m: any) => ({ label: m.name, value: m.id }))}
                    value={formData.materialId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, materialId: e.target.value })
                    }
                  />
                  <GlassInput
                    label="BDP (TN/H)"
                    type="number"
                    value={formData.bdp || ""}
                    onChange={(e: any) =>
                      setFormData({
                        ...formData,
                        bdp: parseFloat(e.target.value),
                      })
                    }
                  />
                </>
              )}

              {type === "USERS" && (
                <>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <GlassInput
                      label="DNI / LEGAJO"
                      value={formData.dni || ""}
                      onChange={(e: any) => {
                        const numericValue = e.target.value.replace(/\D/g, "");
                        setFormData({ ...formData, dni: numericValue });
                      }}
                    />
                    <GlassInput
                      label="NOMBRE / APELLIDO"
                      value={formData.name || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                    <GlassInput
                      label="USUARIO RED / SAP"
                      value={formData.sapUser || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, sapUser: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassInput
                      label="EMAIL"
                      value={formData.email || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                    <GlassInput
                      label="EMAIL 2 (Opcional)"
                      value={formData.email2 || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email2: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <GlassSearchableSelect
                      label="PUESTO"
                      options={[
                        { label: "Analista", value: "Analista" },
                        { label: "Coordinador", value: "Coordinador" },
                        { label: "Gerente", value: "Gerente" },
                        { label: "Jefe de Área", value: "Jefe de Área" },
                        { label: "Laboratorista", value: "Laboratorista" },
                        { label: "Operario Autoelevador", value: "Operario Autoelevador" },
                        { label: "Operario Granel", value: "Operario Granel" },
                        { label: "Operario Líbero", value: "Operario Líbero" },
                        { label: "Operario Maquinista", value: "Operario Maquinista" },
                        { label: "Operario Supervisor", value: "Operario Supervisor" },
                        { label: "Operario Técnico", value: "Operario Técnico" },
                        { label: "Pasante", value: "Pasante" },
                      ]}
                      value={formData.position || ""}
                      onChange={(e: any) => {
                        setFormData({ ...formData, position: e.target.value });
                      }}
                      placeholder="Seleccionar puesto..."
                    />
                    <GlassSearchableSelect
                      label="PERFIL"
                      options={[
                        { label: "Administrador", value: "Administrador" },
                        { label: "Administrativo", value: "Administrativo" },
                        { label: "Laboratorio", value: "Laboratorio" },
                        { label: "Operario", value: "Operario" },
                        { label: "Supervisor", value: "Supervisor" },
                        { label: "Técnico", value: "Técnico" },
                      ]}
                      value={formData.profile || ""}
                      onChange={(e: any) => {
                        setFormData({ ...formData, profile: e.target.value });
                      }}
                      placeholder="Seleccionar perfil..."
                    />
                  </div>

                  {formData.profile === "Administrador" ? (
                    <div className="md:col-span-2 mt-4 p-4 rounded-xl border border-primary/20 bg-primary/10 text-xs text-text-main flex flex-col gap-1.5 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                      <div className="flex items-center gap-2 font-black text-primary dark:text-blue-400 uppercase tracking-wider text-[11px]">
                        🔑 Acceso Total Automatizado
                      </div>
                      <p className="opacity-90 leading-relaxed text-[11px]">
                        El perfil de <strong>Administrador</strong> tiene habilitados por defecto todos los accesos de visualización y edición en todo el sistema de manera automática. No requiere configurar visualizaciones manuales.
                      </p>
                    </div>
                  ) : (
                    <div className="md:col-span-2 mt-4">
                      <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-4">
                        Visualizaciones Habilitadas
                      </h4>
                      <div className="border border-border rounded-xl overflow-hidden bg-bg/30">
                        <table className="w-full text-left text-[10px]">
                          <thead className="bg-bg/50 border-b border-border">
                            <tr>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider">
                                Sección / Vista
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">
                                Nivel de Acceso
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {/* PRODUCTIVITY SECTION */}
                            <tr 
                              className="bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors select-none"
                              onClick={() => setProductivityExpanded(!productivityExpanded)}
                            >
                              <td colSpan={2} className="px-4 py-2.5 text-[9px] font-black text-primary tracking-widest uppercase bg-bg/20">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    ⚡ Funcionalidades de Productividad
                                  </span>
                                  {productivityExpanded ? <ChevronDown size={14} className="text-primary/70" /> : <ChevronRight size={14} className="text-primary/70" />}
                                </div>
                              </td>
                            </tr>
                            {productivityExpanded && SYSTEM_VIEWS.filter((v) => v.section === "PRODUCTIVITY").map((view) => {
                              const p = formData.permissions.find(
                                (perm: any) => perm.viewId === view.id,
                              ) || { level: "NONE" };
                              return (
                                <tr
                                  key={view.id}
                                  className="hover:bg-white/5 transition-colors"
                                >
                                  <td className="px-4 py-3 pl-6">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-text-main">
                                        {view.label}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                      {["NONE", "VIEW", "EDIT"].map((lvl) => (
                                        <button
                                          key={lvl}
                                          type="button"
                                          onClick={() => {
                                            const newPerms = [
                                              ...formData.permissions,
                                            ];
                                            const idx = newPerms.findIndex(
                                              (perm: any) =>
                                                perm.viewId === view.id,
                                            );
                                            if (idx >= 0) {
                                              newPerms[idx] = {
                                                ...newPerms[idx],
                                                level: lvl,
                                              };
                                            } else {
                                              newPerms.push({
                                                viewId: view.id,
                                                label: view.label,
                                                section: view.section,
                                                level: lvl,
                                              });
                                            }
                                            setFormData({
                                              ...formData,
                                              permissions: newPerms,
                                            });
                                          }}
                                          className={cn(
                                            "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                                            p.level === lvl
                                              ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                              : "bg-surface text-text-muted border-border hover:border-text-muted",
                                          )}
                                        >
                                          {lvl === "NONE"
                                            ? "BLOQUEADO"
                                            : lvl === "VIEW"
                                              ? "SOLO VER"
                                              : "EDITAR"}
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* ADMIN SECTION */}
                            <tr 
                              className="bg-[#005596]/5 dark:bg-primary/5 cursor-pointer hover:bg-[#005596]/10 dark:hover:bg-primary/10 transition-colors select-none"
                              onClick={() => setAdminExpanded(!adminExpanded)}
                            >
                              <td colSpan={2} className="px-4 py-2.5 text-[9px] font-black text-[#005596] dark:text-primary tracking-widest uppercase bg-bg/20 border-t border-border">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    ⚙️ Catálogos y Maestros del Sistema (Admin)
                                  </span>
                                  {adminExpanded ? <ChevronDown size={14} className="text-[#005596]/70 dark:text-primary/70" /> : <ChevronRight size={14} className="text-[#005596]/70 dark:text-primary/70" />}
                                </div>
                              </td>
                            </tr>
                            {adminExpanded && SYSTEM_VIEWS.filter((v) => v.section === "ADMIN").map((view) => {
                              const p = formData.permissions.find(
                                (perm: any) => perm.viewId === view.id,
                              ) || { level: "NONE" };
                              return (
                                <tr
                                  key={view.id}
                                  className="hover:bg-white/5 transition-colors"
                                >
                                  <td className="px-4 py-3 pl-6">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-text-main">
                                        {view.label}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                      {["NONE", "VIEW", "EDIT"].map((lvl) => (
                                        <button
                                          key={lvl}
                                          type="button"
                                          onClick={() => {
                                            const newPerms = [
                                              ...formData.permissions,
                                            ];
                                            const idx = newPerms.findIndex(
                                              (perm: any) =>
                                                perm.viewId === view.id,
                                            );
                                            if (idx >= 0) {
                                              newPerms[idx] = {
                                                ...newPerms[idx],
                                                level: lvl,
                                              };
                                            } else {
                                              newPerms.push({
                                                viewId: view.id,
                                                label: view.label,
                                                section: view.section,
                                                level: lvl,
                                              });
                                            }
                                            setFormData({
                                              ...formData,
                                              permissions: newPerms,
                                            });
                                          }}
                                          className={cn(
                                            "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                                            p.level === lvl
                                              ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                              : "bg-surface text-text-muted border-border hover:border-text-muted",
                                          )}
                                        >
                                          {lvl === "NONE"
                                            ? "BLOQUEADO"
                                            : lvl === "VIEW"
                                              ? "SOLO VER"
                                              : "EDITAR"}
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {type === "COMPANIES" && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Nombre / Razón Social"
                      value={formData.name || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <GlassInput
                    label="CUIT"
                    value={formData.taxId || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, taxId: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Teléfono"
                    value={formData.phone || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                  <div className="md:col-span-2">
                    <GlassInput
                      label="URL de Logo (PNG/JPG)"
                      value={formData.logo || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, logo: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Dirección"
                      value={formData.address || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Email Institucional"
                      value={formData.email || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {(type === "PUNTOS_CARGA" || type === "LOADING_POINTS") && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Nombre de Calle / Punto"
                      value={formData.name || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassSelect
                      label="Tipo de Carga"
                      options={[
                        { label: "BOLSA", value: "BOLSA" },
                        { label: "GRANEL", value: "GRANEL" },
                      ]}
                      value={formData.type || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, type: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2 pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] text-text-muted uppercase tracking-wider font-extrabold block select-none">
                        Materiales Habilitados para este Punto de Carga
                      </label>
                      <div className="relative w-44">
                        <input
                          type="text"
                          placeholder="Buscar material..."
                          value={materialSearch}
                          onChange={(e) => setMaterialSearch(e.target.value)}
                          className="w-full bg-bg-input/20 border border-border/40 hover:border-border/60 focus:border-primary/50 text-[10px] rounded-lg px-2 py-1 pr-6 outline-none transition-colors text-text-main placeholder-text-muted font-bold"
                        />
                        <Search size={10} className="absolute right-2 top-2 text-text-muted/70 pointer-events-none" />
                      </div>
                    </div>
                    <div className="p-3 border border-border/40 bg-bg-input/30 rounded-xl max-h-48 overflow-y-auto space-y-1.5 no-scrollbar">
                      {filteredMaterials.map((m: any) => {
                        const isChecked = (formData.materialIds || []).includes(m.id);
                        return (
                          <div 
                            key={m.id} 
                            onClick={() => handleMaterialToggle(m.id)}
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border text-left",
                              isChecked
                                ? "bg-primary/10 border-primary text-text-main"
                                : "bg-bg/25 border-transparent text-text-muted hover:border-border hover:text-text-main"
                            )}
                          >
                            <span className="text-xs font-bold uppercase">{m.name}</span>
                            <div className={cn(
                              "w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0",
                              isChecked ? "bg-primary border-primary text-white" : "border-border"
                            )}>
                              {isChecked && <Check size={10} strokeWidth={4} />}
                            </div>
                          </div>
                        );
                      })}
                      {filteredMaterials.length === 0 && (
                        <div className="text-center py-4 text-[10px] text-text-muted italic">
                          No se encontraron materiales.
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-text-muted italic block leading-relaxed">
                      * Nota: Si no seleccionas ningún material, se considerarán habilitados TODOS los materiales tradicionales en el panel operativo.
                    </span>
                  </div>
                </>
              )}

              {type === "PROVEEDORES_BOLSA" && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Nombre"
                      value={formData.nombre || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Dirección"
                      value={formData.direccion || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, direccion: e.target.value })
                      }
                    />
                  </div>
                  <GlassInput
                    label="Teléfono"
                    value={formData.telefono || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                  />
                  <GlassInput
                    label="Email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e: any) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </>
              )}

              {type === "VEHICULOS" && (
                <>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Identificación"
                      value={formData.identificación || formData.identificacion || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, identificación: e.target.value, identificacion: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <GlassInput
                      label="Marca"
                      value={formData.marca || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, marca: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassSelect
                      label="Tipo"
                      options={[
                        { label: "Autoelevador", value: "Autoelevador" },
                        { label: "Camión", value: "Camión" },
                        { label: "Camioneta", value: "Camioneta" },
                        { label: "Vehículo utilitario", value: "Vehículo utilitario" }
                      ]}
                      value={formData.tipo || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, tipo: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassInput
                      label="Carga Máxima"
                      value={formData.carga_maxima || ""}
                      onChange={(e: any) =>
                        setFormData({ ...formData, carga_maxima: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {(type === "CONTROLES_BALANZAS" || type === "PARAMETROS_BALANZA") && (
                <>
                  <div className="md:col-span-1">
                    <GlassInput
                      type="text"
                      inputMode="decimal"
                      label="Tolerancia Positiva BIAS"
                      value={formData.positiveBiasTolerance ?? formData.tolerancia_positiva_bias ?? 0.02}
                      onChange={(e: any) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setFormData({ ...formData, positiveBiasTolerance: val, tolerancia_positiva_bias: val });
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassInput
                      type="text"
                      inputMode="decimal"
                      label="Tolerancia Negativa BIAS"
                      value={formData.negativeBiasTolerance ?? formData.tolerancia_negativa_bias ?? -0.02}
                      onChange={(e: any) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                          setFormData({ ...formData, negativeBiasTolerance: val, tolerancia_negativa_bias: val });
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassInput
                      type="text"
                      inputMode="decimal"
                      label="Tolerancia Positiva Rango"
                      value={formData.positiveRangeTolerance ?? formData.tolerancia_positiva_rango ?? 0.01}
                      onChange={(e: any) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                          setFormData({ ...formData, positiveRangeTolerance: val, tolerancia_positiva_rango: val });
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="md:col-span-1">
                    <GlassInput
                      type="text"
                      inputMode="decimal"
                      label="Tolerancia Negativa Rango"
                      value={formData.negativeRangeTolerance ?? formData.tolerancia_negativa_rango ?? -0.01}
                      onChange={(e: any) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
                          setFormData({ ...formData, negativeRangeTolerance: val, tolerancia_negativa_rango: val });
                        }
                      }}
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <GlassButton
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                type="button"
              >
                Cancelar
              </GlassButton>
              <GlassButton className="flex-1" type="submit">
                <Save size={18} /> Guardar
              </GlassButton>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
