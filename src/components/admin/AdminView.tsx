import React, { useRef, useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Settings, Search, Plus, Pencil, Trash2, X, Save, FileUp,
  ChevronLeft, ChevronRight, ChevronDown, User as UserIcon,
  Shield, LogIn, AlertTriangle, MapPin,
} from "lucide-react";
import { MasterData, Shift, HAC, Cause, AppUser, UserPermission } from "../../types";
import * as XLSX from "xlsx";
import { cn } from "../../lib/utils";
import { DataTable, Column, TableActions } from "../ui/DataTable";
import { ConfirmModal, GlassButton, GlassInput, GlassSelect, GlassSearchableSelect } from "../ui/GlassUI";
import { SYSTEM_VIEWS } from "../../lib/mockData";
import { AdminSubTab } from "./AdminSubTab";
import { MasterFormModal } from "./MasterFormModal";
import { safeHacMatch, normalizeSearchText, buildCauseSearchIndex } from "./utils/adminUtils";

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  activeTab: "SHIFTS" | "MACHINES" | "HACS" | "CAUSES" | "CAPACITIES" | any;
  onTabChange: (tab: any) => void;
  onUpdateMasters: (type: string, data: any[]) => void;
  onUserSwitch?: (dni: string) => void;
  addToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function AdminView({
  masters,
  currentUser,
  activeTab,
  onTabChange,
  onUpdateMasters,
  onUserSwitch,
  addToast,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [expandedHacs, setExpandedHacs] = useState<Record<string, boolean>>({});

  const toggleHac = (hacCode: string) => {
    setExpandedHacs((prev) => ({
      ...prev,
      [hacCode]: !prev[hacCode],
    }));
  };


  const canView = (viewId: string) => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find((p) => p.viewId === viewId);
    return perm ? perm.level !== "NONE" : false;
  };

  const tabMapping: Record<string, string> = {
    SHIFTS: "TURNOS",
    MACHINES: "PALETIZADORAS",
    BAGGERS: "EMBOLSADORAS",
    EQUIPOS: "EQUIPOS",
    HACS: "EQUIPOS",
    CAUSES: "CAUSAS",
     MATERIALS: "MATERIALES",
    CAPACITIES: "CAPACIDADES",
    USERS: "USUARIOS",
    COMPANIES: "EMPRESAS",
    LOADING_POINTS: "PUNTOS_CARGA",
    PUNTOS_CARGA: "PUNTOS_CARGA",
    PROVEEDORES_BOLSA: "PROVEEDORES_BOLSA",
    VEHICULOS: "VEHICULOS",
    CONTROLES_BALANZAS: "CONTROLES_BALANZAS",
    PARAMETROS_BALANZA: "CONTROLES_BALANZAS",
  };

  const isVisible = (tab: string) => {
    return canView(tabMapping[tab] || tab);
  };

  const isEditable = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const sectionId = tabMapping[activeTab] || activeTab;
    const perm = currentUser?.permissions?.find((p) => p.viewId === sectionId);
    return perm ? perm.level === "EDIT" : false;
  }, [currentUser, activeTab]);

  const sectionsList = useMemo(() => {
    return [
      { key: "CAPACITIES", label: "Capacidades" },
      { key: "CAUSES", label: "Causas" },
      { key: "COMPANIES", label: "Empresas" },
      { key: "BAGGERS", label: "Ensacadoras" },
      { key: "HACS", label: "Equipos" },
      { key: "MACHINES", label: "Maquinas" },
      { key: "MATERIALS", label: "Materiales" },
      { key: "PROVEEDORES_BOLSA", label: "Proveedores Bolsa" },
      { key: "PUNTOS_CARGA", label: "Calles de Carga" },
      { key: "SHIFTS", label: "Turnos" },
      { key: "USERS", label: "Usuarios" },
      { key: "VEHICULOS", label: "Vehículos" },
      { key: "CONTROLES_BALANZAS", label: "Controles Balanzas" },
    ].sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
  }, []);

  useEffect(() => {
    if (!isVisible(activeTab)) {
      const firstVisible = sectionsList
        .map((s) => s.key)
        .find((t) => isVisible(t));
      if (firstVisible) onTabChange(firstVisible);
    }
  }, [currentUser, activeTab, sectionsList]);

  useEffect(() => {
    if (scrollRef.current) {
      const activeBtn = scrollRef.current.querySelector(
        '[data-active="true"]',
      ) as HTMLElement;
      if (activeBtn) {
        const container = scrollRef.current;
        const scrollLeft =
          activeBtn.offsetLeft -
          container.offsetWidth / 2 +
          activeBtn.offsetWidth / 2;
        container.scrollTo({ left: scrollLeft, behavior: "smooth" });
      }
    }
  }, [activeTab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const getCurrentList = () => {
    if (activeTab === "SHIFTS") return masters.shifts;
    if (activeTab === "MACHINES") return masters.palletizers;
    if (activeTab === "BAGGERS") return masters.baggers;
    if (activeTab === "HACS") return masters.hacs;
    if (activeTab === "CAUSES") return masters.causes;
    if (activeTab === "MATERIALS") return masters.materials;
    if (activeTab === "CAPACITIES") return masters.capacities;
    if (activeTab === "USERS") return masters.users;
    if (activeTab === "COMPANIES") return masters.companies;
    if (activeTab === "PUNTOS_CARGA" || activeTab === "LOADING_POINTS")
      return masters.loadingPoints;
    if (activeTab === "PROVEEDORES_BOLSA") return masters.bagSuppliers || [];
    if (activeTab === "VEHICULOS") return masters.vehicles || [];
    if (activeTab === "CONTROLES_BALANZAS" || activeTab === "PARAMETROS_BALANZA") return masters.scaleParameters || [];
    return [];
  };

  const filteredData = useMemo(() => {
    const list = getCurrentList();
    let result = [...list];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      if (term !== "") {
        if (activeTab === "CAUSES") {
          const queryNorm = normalizeSearchText(term);
          result = result.filter((cause) => {
            const indexParts = buildCauseSearchIndex(cause, masters);
            return indexParts.some((part) => {
              const partNorm = normalizeSearchText(part);
              return partNorm.includes(queryNorm);
            });
          });
        } else {
          const cleanTerm = term.replace(/[^a-z0-9]/g, "");
          result = result.filter((item) => {
            // 1. If item has a HAC identifier, use the highly optimized bi-directional alphanumeric matcher
            const targetHac = (item as any).hac || (item as any).hacId || (item as any).hac_id;
            if (targetHac) {
              const cleanTarget = String(targetHac).toLowerCase().replace(/[^a-z0-9]/g, "");
              
              // Standard inclusion of clean strings
              if (cleanTarget.includes(cleanTerm) || cleanTerm.includes(cleanTarget)) {
                return true;
              }
              
              // Loose comparison removing standard "mg" prefix if any
              const looseTarget = cleanTarget.startsWith("mg") ? cleanTarget.substring(2) : cleanTarget;
              const looseQuery = cleanTerm.startsWith("mg") ? cleanTerm.substring(2) : cleanTerm;
              if (looseTarget && looseQuery && (looseTarget.includes(looseQuery) || looseQuery.includes(looseTarget))) {
                return true;
              }
            }

            // 2. Generic fallback search across all entries
            return Object.entries(item).some(([key, val]) => {
              if (val === undefined || val === null) return false;
              const strVal = String(val).toLowerCase();
              
              // Standard inclusion
              if (strVal.includes(term)) return true;
              
              // Loose alphanumeric inclusion on any string
              const cleanVal = strVal.replace(/[^a-z0-9]/g, "");
              if (cleanTerm && cleanVal.includes(cleanTerm)) return true;

              // Handled explicitly above, but keep as third fallback
              if (key === "hac" && safeHacMatch(val, term)) {
                return true;
              }
              
              return false;
            });
          });
        }
      }
    }

    // Apply sorting based on activeTab
    if (activeTab === "SHIFTS") {
      result.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "MATERIALS") {
      result.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "USERS") {
      result.sort((a: any, b: any) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "PROVEEDORES_BOLSA") {
      result.sort((a: any, b: any) => {
        const nameA = a.nombre || "";
        const nameB = b.nombre || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "VEHICULOS") {
      result.sort((a: any, b: any) => {
        const nameA = a.identificación || "";
        const nameB = b.identificación || "";
        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "CAPACITIES") {
      result.sort((a: any, b: any) => {
        const pNameA =
          masters.palletizers.find((p) => p.id === a.palletizerId)?.name || "";
        const pNameB =
          masters.palletizers.find((p) => p.id === b.palletizerId)?.name || "";
        const pCompare = pNameA.localeCompare(pNameB, "es", {
          sensitivity: "base",
        });
        if (pCompare !== 0) return pCompare;

        const bNameA =
          masters.baggers.find((bg) => bg.id === a.baggerId)?.name || "";
        const bNameB =
          masters.baggers.find((bg) => bg.id === b.baggerId)?.name || "";
        const bCompare = bNameA.localeCompare(bNameB, "es", {
          sensitivity: "base",
        });
        if (bCompare !== 0) return bCompare;

        const mNameA =
          masters.materials.find((m) => m.id === a.materialId)?.name || "";
        const mNameB =
          masters.materials.find((m) => m.id === b.materialId)?.name || "";
        return mNameA.localeCompare(mNameB, "es", { sensitivity: "base" });
      });
    } else if (activeTab === "CAUSES") {
      result.sort((a: any, b: any) => {
        const hacA = String(a.hac || "").trim();
        const hacB = String(b.hac || "").trim();
        const hacCompare = hacA.localeCompare(hacB, "es", {
          sensitivity: "base",
          numeric: true,
        });
        if (hacCompare !== 0) return hacCompare;

        const textA = String(a.text || "").trim();
        const textB = String(b.text || "").trim();
        return textA.localeCompare(textB, "es", {
          sensitivity: "base",
          numeric: true,
        });
      });
    }

    return result;
  }, [masters, activeTab, searchTerm]);

  const groupedCapacities = useMemo(() => {
    if (activeTab !== "CAPACITIES") return [];

    // Group filteredData capacities by palletizerId
    const palletizerIds = Array.from(
      new Set(filteredData.map((c: any) => c.palletizerId)),
    );

    const groups = palletizerIds.map((pId) => {
      const palletizerObj = masters.palletizers.find((p) => p.id === pId) || {
        id: pId,
        name: `Paletizadora Desconocida (${pId})`,
      };
      const items = filteredData.filter((c: any) => c.palletizerId === pId);
      return {
        palletizer: palletizerObj,
        capacities: items,
      };
    });

    // Sort the groups by palletizer name alphabetically
    groups.sort((a, b) =>
      a.palletizer.name.localeCompare(b.palletizer.name, "es", {
        sensitivity: "base",
      }),
    );

    return groups;
  }, [filteredData, activeTab, masters.palletizers]);

  const groupedCauses = useMemo(() => {
    if (activeTab !== "CAUSES") return [];

    const groups: Record<string, Cause[]> = {};
    filteredData.forEach((cause: any) => {
      const key = cause.hac || "SIN_HAC";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(cause);
    });

    return Object.entries(groups)
      .map(([hacKey, items]) => {
        const hacObj = (masters.hacs || []).find(
          (h) => h.hac === hacKey || safeHacMatch(h.hac, hacKey)
        );
        return {
          hac: hacKey,
          hacDetail: hacObj ? hacObj.detail : "",
          causes: items.sort((a, b) =>
            String(a.text || "").localeCompare(String(b.text || ""), "es", {
              sensitivity: "base",
              numeric: true,
            })
          ),
        };
      })
      .sort((a, b) => a.hac.localeCompare(b.hac, "es", { sensitivity: "base" }));
  }, [filteredData, activeTab, masters.hacs]);

  const groupedLoadingPoints = useMemo(() => {
    if (activeTab !== "PUNTOS_CARGA" && activeTab !== "LOADING_POINTS") return [];

    const types = Array.from(
      new Set(filteredData.filter(Boolean).map((lp: any) => String(lp.type || "BOLSA").toUpperCase().trim()))
    );

    const groups = types.map((t) => {
      const items = filteredData.filter((lp: any) => String(lp.type || "BOLSA").toUpperCase().trim() === t);
      // Sort alphabetically by name
      items.sort((a, b) => {
        const nameA = String(a.name || "").trim();
        const nameB = String(b.name || "").trim();
        return nameA.localeCompare(nameB, "es", { sensitivity: "base", numeric: true });
      });
      return {
        type: t,
        loadingPoints: items,
      };
    });

    // Sort groups alphabetically by type name
    groups.sort((a: any, b: any) =>
      a.type.localeCompare(b.type, "es", { sensitivity: "base" })
    );

    return groups;
  }, [filteredData, activeTab]);

  const handleDelete = () => {
    if (!deletingId) return;
    const list = getCurrentList() as any[];
    let newList;
    if (activeTab === "CAPACITIES") {
      newList = list.filter(
        (i) => {
          const combo = `${i.palletizerId}-${i.baggerId}-${i.materialId}`.trim().toLowerCase();
          const target = String(deletingId).trim().toLowerCase();
          const itemId = String(i.id || i.ID || "").trim().toLowerCase();
          return combo !== target && itemId !== target;
        }
      );
    } else if (activeTab === "USERS") {
      newList = list.filter((i) => String(i.dni).trim() !== String(deletingId).trim());
    } else {
      newList = list.filter((i) => String(i.id || i.ID || "").trim() !== String(deletingId).trim());
    }
    onUpdateMasters(activeTab, newList);
    setDeletingId(null);
  };

  const handleSave = (item: any) => {
    const list = getCurrentList() as any[];
    let newList;
    const isEdit =
      activeTab === "CAPACITIES"
        ? list.some(
            (i) =>
              (i.id && item.id && String(i.id).trim().toUpperCase() === String(item.id).trim().toUpperCase()) ||
              `${i.palletizerId}-${i.baggerId}-${i.materialId}`.trim().toLowerCase() ===
              `${item.palletizerId}-${item.baggerId}-${item.materialId}`.trim().toLowerCase(),
          )
        : activeTab === "USERS"
          ? list.some((i) => String(i.dni).trim() === String(item.dni).trim())
          : list.some(
              (i) => {
                const iId = String(i.id || i.ID || "").trim().toUpperCase();
                const itemId = String(item.id || item.ID || "").trim().toUpperCase();
                return iId !== "" && iId === itemId;
              }
            );

    if (isEdit) {
      if (activeTab === "CAPACITIES") {
        newList = list.map((i) => {
          const isSameId = i.id && item.id && String(i.id).trim().toUpperCase() === String(item.id).trim().toUpperCase();
          const isSameCombo = `${i.palletizerId}-${i.baggerId}-${i.materialId}`.trim().toLowerCase() === `${item.palletizerId}-${item.baggerId}-${item.materialId}`.trim().toLowerCase();
          if (isSameId || isSameCombo) {
            return { ...i, ...item, id: i.id || item.id };
          }
          return i;
        });
      } else if (activeTab === "USERS") {
        newList = list.map((i) => (String(i.dni).trim() === String(item.dni).trim() ? item : i));
      } else {
        newList = list.map((i) => {
          const iId = String(i.id || i.ID || "").trim().toUpperCase();
          const itemId = String(item.id || item.ID || "").trim().toUpperCase();
          return iId === itemId ? item : i;
        });
      }
    } else {
      newList = [item, ...list];
    }
    onUpdateMasters(activeTab, newList);
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const actionsColumn = (row?: any): Column<any> => ({
    header: "Acciones",
    align: "right",
    accessor: (r) =>
      isEditable ? (
        <TableActions
          onEdit={() => {
            setEditingItem(r);
            setIsFormOpen(true);
          }}
          onDelete={() => {
            let id = r.id || `${r.palletizerId}-${r.baggerId}-${r.materialId}`;
            if (activeTab === "USERS") id = r.dni;
            setDeletingId(id);
          }}
        />
      ) : (
        <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">
          Lectura
        </span>
      ),
  });

  const shiftColumns: Column<any>[] = [
    {
      header: "Nombre",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "Inicio", accessor: "startTime" },
    { header: "Fin", accessor: "endTime" },
    {
      header: "Hs",
      accessor: (row) => (
        <span className="font-bold text-primary">{row.durationHours}H</span>
      ),
    },
    actionsColumn(),
  ];

  const machineColumns: Column<any>[] = [
    {
      header: "Descripción",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "HAC ID", accessor: "hacId" },
    actionsColumn(),
  ];

  const baggerColumns: Column<any>[] = [
    {
      header: "Descripción",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "HAC", accessor: "hacId" },
    {
      header: "Boquillas",
      accessor: (row) => (
        <span className="font-bold text-primary">{row.nozzles}</span>
      ),
    },
    {
      header: "P. MUESTREO",
      align: "center",
      accessor: (row) =>
        row.isSamplingPoint ? (
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)] mx-auto" />
        ) : null,
    },
    actionsColumn(),
  ];

  const hacColumns: Column<any>[] = [
    {
      header: "HAC",
      accessor: (row) => (
        <span className="font-bold text-primary">{row.hac}</span>
      ),
    },
    {
      header: "Detalle",
      accessor: (row) => (
        <span className="font-bold text-text-main uppercase">{row.detail}</span>
      ),
    },
    { header: "GPO Cód. Objeto", accessor: "gpoCodObjeto" },
    { header: "Equipo", accessor: "equipment" },
    {
      header: "Ctrl F/B",
      align: "center",
      accessor: (row) => (
        <div className="flex justify-center gap-1.5">
          {row.isDater && (
            <div
              className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"
              title="Fechador"
            />
          )}
          {row.isScale && (
            <div
              className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse"
              title="Balanza"
            />
          )}
        </div>
      ),
    },
    actionsColumn(),
  ];

  const causeColumns: Column<any>[] = [
    {
      header: "HAC",
      accessor: (row) => (
        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
          {row.hac}
        </span>
      ),
    },
    {
      header: "Texto de Causa",
      accessor: (row) => (
        <span className="font-bold text-text-main uppercase leading-tight block max-w-[200px] truncate">
          {row.text}
        </span>
      ),
    },
    {
      header: "Tipo",
      accessor: (row) => {
        const type = String(row.stopType || row.tipo_paro || row.tipoParo || row["TIPO PARO"] || row["tipo paro"] || "").trim().toUpperCase();
        return (
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold border uppercase",
              type === "INTERNO"
                ? "border-primary/20 text-primary bg-primary/5"
                : "border-emerald-500/20 text-emerald-500 bg-emerald-500/5",
            )}
          >
            {type || "INTERNO"}
          </span>
        );
      },
    },
    {
      header: "PARTE/CAUSA SAP",
      accessor: (row) => (
        <span className="text-[9px] font-mono opacity-70">
          P: {row.partObject} / C: {row.causeCode}
        </span>
      ),
    },
    actionsColumn(),
  ];

  const materialColumns: Column<any>[] = [
    {
      header: "Descripción",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "Código SAP", accessor: "code" },
    {
      header: "P. Embalaje",
      accessor: (row) => (
        <span className="font-mono text-[10px]">{row.packingWeight}kg</span>
      ),
    },
    {
      header: "P. Bolsa",
      accessor: (row) => (
        <span className="font-mono text-[10px]">{row.bagWeight}kg</span>
      ),
    },
    {
      header: "Atributos",
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.isPallet && (
            <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              PALLET
            </span>
          )}
          {row.isProductive && (
            <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              PROD
            </span>
          )}
          {row.isSupply && (
            <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              INSUMO
            </span>
          )}
          {row.isBigBag && (
            <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              BIGBAG
            </span>
          )}
          {row.isDispatch && (
            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              DESPACHO
            </span>
          )}
          {row.isBulk && (
            <span className="bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 px-1 py-0.5 rounded text-[8px] font-bold">
              GRANEL
            </span>
          )}
        </div>
      ),
    },
    actionsColumn(),
  ];

  const capacityColumns: Column<any>[] = [
    {
      header: "Paletizadora",
      accessor: (row) =>
        masters.palletizers.find((p) => p.id === row.palletizerId)?.name ||
        "N/A",
    },
    {
      header: "Ensacadora",
      accessor: (row) =>
        masters.baggers.find((b) => b.id === row.baggerId)?.name || "N/A",
    },
    {
      header: "Material",
      accessor: (row) =>
        masters.materials.find((m) => m.id === row.materialId)?.name || "N/A",
    },
    {
      header: "BDP",
      accessor: (row) => (
        <span className="font-black text-text-main">{row.bdp} TN/H</span>
      ),
    },
    actionsColumn(),
  ];

  const companyColumns: Column<any>[] = [
    {
      header: "Empresa",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "CUIT", accessor: "taxId" },
    {
      header: "Dirección",
      accessor: (row) => (
        <span className="text-[10px] opacity-70">{row.address}</span>
      ),
    },
    actionsColumn(),
  ];

  const loadingPointColumns: Column<any>[] = [
    {
      header: "Punto de Carga",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    {
      header: "Tipo",
      accessor: (row) => (
        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold border uppercase",
            row.type === "BOLSA"
              ? "border-blue-500/20 text-blue-500 bg-blue-500/5"
              : "border-amber-500/20 text-amber-500 bg-amber-500/5",
          )}
        >
          {row.type}
        </span>
      ),
    },
    {
      header: "Materiales Habilitados",
      accessor: (row) => {
        const materialNames = (row.materialIds || [])
          .map((id: string) => masters.materials.find((m: any) => m.id === id)?.name)
          .filter(Boolean);
        return (
          <span className="text-[10px] text-text-muted font-bold block max-w-xs truncate uppercase">
            {materialNames.length > 0 ? materialNames.join(", ") : "Todos"}
          </span>
        );
      },
    },
    actionsColumn(),
  ];

  const bagSupplierColumns: Column<any>[] = [
    {
      header: "Nombre",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.nombre}</span>
      ),
    },
    { header: "Dirección", accessor: "direccion" },
    { header: "Teléfono", accessor: "telefono" },
    { header: "Email", accessor: "email" },
    actionsColumn(),
  ];

  const vehicleColumns: Column<any>[] = [
    {
      header: "Identificación",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.identificación}</span>
      ),
    },
    { header: "Marca", accessor: "marca" },
    { header: "Tipo", accessor: "tipo" },
    { header: "Carga Máxima", accessor: "carga_maxima" },
    actionsColumn(),
  ];

  const scaleParameterColumns: Column<any>[] = [
    {
      header: "Tolerancia Positiva BIAS",
      accessor: (row) => (
        <span className="font-mono font-bold text-emerald-500">
          +{Number(Math.abs(row.positiveBiasTolerance ?? row.tolerancia_positiva_bias ?? 0.02)).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Tolerancia Negativa BIAS",
      accessor: (row) => (
        <span className="font-mono font-bold text-red-500">
          -{Number(Math.abs(row.negativeBiasTolerance ?? row.tolerancia_negativa_bias ?? 0.02)).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Tolerancia Positiva Rango",
      accessor: (row) => (
        <span className="font-mono font-bold text-emerald-500">
          +{Number(Math.abs(row.positiveRangeTolerance ?? row.tolerancia_positiva_rango ?? 0.01)).toFixed(2)}
        </span>
      ),
    },
    {
      header: "Tolerancia Negativa Rango",
      accessor: (row) => (
        <span className="font-mono font-bold text-red-500">
          -{Number(Math.abs(row.negativeRangeTolerance ?? row.tolerancia_negativa_rango ?? 0.01)).toFixed(2)}
        </span>
      ),
    },
    actionsColumn(),
  ];

  const userColumns: Column<AppUser>[] = [
    { header: "DNI / Legajo", accessor: "dni" },
    {
      header: "Nombre",
      accessor: (row) => (
        <span className="font-bold text-text-main">{row.name}</span>
      ),
    },
    { header: "Usuario RED / SAP", accessor: "sapUser" },
    {
      header: "Email",
      accessor: (row) => (
        <span className="text-[10px] opacity-70">{row.email}</span>
      ),
    },
    {
      header: "Acciones",
      align: "right",
      accessor: (row) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => onUserSwitch?.(row.dni)}
            title="Simular Login"
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
              currentUser.dni === row.dni
                ? "bg-primary text-white"
                : "bg-surface text-text-muted hover:text-primary border border-border",
            )}
          >
            <LogIn size={14} />
          </button>
          <TableActions
            onEdit={() => {
              setEditingItem(row);
              setIsFormOpen(true);
            }}
            onDelete={() => setDeletingId(row.dni)}
          />
        </div>
      ),
    },
  ];

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      processImportedData(data);
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; // Reset input
  };

  const processImportedData = (data: any[]) => {
    const list = getCurrentList() as any[];
    const newList = [...list];

    data.forEach((row) => {
      let item: any = {};

      if (activeTab === "HACS") {
        item = {
          id: `HAC-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          hac: String(row.HAC || row.hac || ""),
          detail: String(row["Detalle HAC"] || row.detail || ""),
          gpoCodObjeto: String(
            row["GPO.CÓD. OBJETO"] || row.gpoCodObjeto || "",
          ),
          equipment: String(row.EQUIPO || row.equipment || ""),
          isDater: !!(row["Control Fechador?"] || row.isDater),
          isScale: !!(row["Control Balanza?"] || row.isScale),
        };
      } else if (activeTab === "CAUSES") {
        item = {
          id: `PARO-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          hac: String(row.HAC || row.hac || ""),
          text: String(row["TEXTO DE CAUSA"] || row.text || ""),
          partObject: String(row["PARTE OBJETO"] || row.partObject || ""),
          symptomGroup: String(
            row["GPO.CÓD. SINTOMA"] || row.symptomGroup || "",
          ),
          symptomCode: String(row["CÓD. SINTOMA"] || row.symptomCode || ""),
          sapCause: String(row["CAUSA SAP"] || row.sapCause || ""),
          causeGroup: String(row["GPO.COD. CAUSA"] || row.causeGroup || ""),
          causeCode: String(row["CÓDIGO CAUSA"] || row.causeCode || ""),
          stopType:
            String(row["TIPO PARO"] || row.stopType || "").toUpperCase() ===
            "EXTERNO"
              ? "EXTERNO"
              : "INTERNO",
        };
      } else {
        // Basic generic mapping for other tabs if they want to try
        item = { ...row };
        if (!item.id)
          item.id = Math.random().toString(36).substr(2, 6).toUpperCase();
      }

      if (item.id) newList.push(item);
    });

    onUpdateMasters(activeTab, newList);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="layout-container py-8 relative"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="text-primary" size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-text-main tracking-tight uppercase">
              Gestión de Maestros
            </h3>
            <p className="text-xs text-text-muted font-medium">
              Configuración centralizada de catálogos y sistemas.
            </p>
          </div>
        </div>

        {(() => {
          const visibleSections = sectionsList.filter(s => isVisible(s.key));

          // Una sola opción — mostrar como label sin contenedor
          if (visibleSections.length === 1) {
            return (
              <div className="flex items-center gap-2.5 px-2 py-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-primary">
                  {visibleSections[0].label}
                </span>
              </div>
            );
          }

          // 2 a 4 opciones — contenedor centrado que se achica al contenido
          if (visibleSections.length <= 4) {
            return (
              <div className="flex justify-center md:justify-end">
                <div className="bg-bg-input/50 p-1.5 rounded-2xl border border-border shadow-sm inline-flex gap-1">
                  {visibleSections.map(sec => (
                    <AdminSubTab
                      key={sec.key}
                      active={activeTab === sec.key}
                      onClick={() => onTabChange(sec.key)}
                      label={sec.label}
                      icon={(sec as any).icon}
                    />
                  ))}
                </div>
              </div>
            );
          }

          // 5 o más opciones — carrusel completo con scroll y flechas (comportamiento actual)
          return (
            <div className="relative group overflow-hidden">
              <div className="absolute inset-y-0 left-0 items-center pl-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollBy({
                        left: -150,
                        behavior: "smooth",
                      });
                    }
                  }}
                  className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              <div className="absolute inset-y-0 right-0 items-center pr-1 z-20 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollBy({ left: 150, behavior: "smooth" });
                    }
                  }}
                  className="w-6 h-6 rounded-full bg-surface shadow-md border border-border flex items-center justify-center text-text-muted hover:text-primary transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Carousel edge masks */}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg to-transparent z-10 pointer-events-none" />

              <div
                ref={scrollRef}
                className="flex bg-bg-input/50 p-1.5 rounded-2xl border border-border overflow-x-auto gap-1 no-scrollbar select-none min-w-0 shadow-sm scroll-smooth px-6"
              >
                {visibleSections.map((sec) => (
                  <AdminSubTab
                    key={sec.key}
                    active={activeTab === sec.key}
                    onClick={() => onTabChange(sec.key)}
                    label={sec.label}
                    icon={(sec as any).icon}
                  />
                ))}
              </div>
            </div>
          );
        })()}
      </div>

        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                size={16}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en maestros..."
                className="w-full h-10 bg-bg-input border border-border rounded-lg pl-10 pr-4 text-sm text-text-main focus:border-primary/50 outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleExcelImport}
              />
              {isEditable && (
                <>
                  {(activeTab === "HACS" || activeTab === "CAUSES") && (
                    <GlassButton
                      variant="secondary"
                      className="h-10 px-4"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileUp size={16} /> Importar Excel
                    </GlassButton>
                  )}
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setIsFormOpen(true);
                    }}
                    className="h-10 px-4 bg-primary text-white rounded-lg font-semibold text-xs flex items-center gap-2 hover:bg-primary/90 transition-colors active:scale-95 shadow-sm"
                  >
                    <Plus size={16} /> Nuevo Registro
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-[600px] overflow-auto no-scrollbar">
            {activeTab === "SHIFTS" && (
              <DataTable
                title="Listado de Turnos"
                countLabel="turnos"
                columns={shiftColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "MACHINES" && (
              <DataTable
                title="Listado de Maquinas"
                countLabel="equipos"
                columns={machineColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "BAGGERS" && (
              <DataTable
                title="Listado de Ensacadoras"
                countLabel="ensacadoras"
                columns={baggerColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "HACS" && (
              <DataTable
                title="Listado de Equipos (HAC)"
                countLabel="items"
                columns={hacColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "CAUSES" && (
              <div className="space-y-4">
                {groupedCauses.map((group) => {
                  const isExpanded = !!expandedHacs[group.hac];
                  return (
                    <div
                      key={group.hac}
                      className="border border-border rounded-xl bg-surface/10 overflow-hidden shadow-sm"
                    >
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleHac(group.hac)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-surface/80 hover:bg-surface/90 border-b border-border transition-all text-left"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded font-black tracking-wide">
                            {group.hac}
                          </span>
                          {group.hacDetail && (
                            <span className="text-xs font-black text-text-main uppercase tracking-wider">
                              {group.hacDetail}
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted font-bold font-mono uppercase bg-bg px-2 py-0.5 rounded border border-border">
                            {group.causes.length} {group.causes.length === 1 ? 'causa' : 'causas'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            size={16}
                            className={cn(
                              "text-text-muted transition-transform duration-200",
                              isExpanded ? "rotate-180" : ""
                            )}
                          />
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-4 bg-bg-input/10 animate-fade-in">
                          <DataTable
                            columns={causeColumns.filter((col) => col.header !== "HAC")}
                            data={group.causes}
                            keyExtractor={(r) => r.id}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedCauses.length === 0 && (
                  <div className="p-12 text-center text-xs font-medium text-text-muted bg-surface rounded-xl border border-border">
                    No se encontraron causas coincidentes.
                  </div>
                )}
              </div>
            )}
            {activeTab === "MATERIALS" && (
              <DataTable
                title="Listado de Materiales"
                countLabel="materiales"
                columns={materialColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "CAPACITIES" && (
              <div className="space-y-6">
                {groupedCapacities.map((group) => (
                  <div
                    key={group.palletizer.id}
                    className="border border-border rounded-xl bg-surface/10 overflow-hidden shadow-sm"
                  >
                    <div className="bg-surface/80 border-b border-border px-5 py-3 flex justify-between items-center bg-gradient-to-r from-bg to-transparent">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-text-main uppercase tracking-wider">
                          Paletizadora: {group.palletizer.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-text-muted font-bold font-mono uppercase bg-bg px-2.5 py-0.5 rounded border border-border">
                        {group.capacities.length} {group.capacities.length === 1 ? 'Combinación' : 'Combinaciones'}
                      </span>
                    </div>
                    <div className="p-4 bg-bg-input/20">
                      <DataTable
                        columns={capacityColumns.filter((col) => col.header !== "Paletizadora")}
                        data={group.capacities}
                        keyExtractor={(r) =>
                          `${r.palletizerId}-${r.baggerId}-${r.materialId}`
                        }
                      />
                    </div>
                  </div>
                ))}
                {groupedCapacities.length === 0 && (
                  <div className="p-8 text-center text-xs text-text-muted bg-surface rounded-xl border border-border">
                    No se encontraron combinaciones de capacidades.
                  </div>
                )}
              </div>
            )}
            {activeTab === "USERS" && (
              <DataTable
                title="Base de Usuarios"
                countLabel="usuarios"
                columns={userColumns}
                data={filteredData}
                keyExtractor={(r) => r.dni}
              />
            )}
            {activeTab === "COMPANIES" && (
              <DataTable
                title="Datos de Empresa"
                countLabel="sedes"
                columns={companyColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {(activeTab === "PUNTOS_CARGA" ||
              activeTab === "LOADING_POINTS") && (
              <div className="space-y-6 animate-fade-in">
                {groupedLoadingPoints.map((group) => (
                  <div
                    key={group.type}
                    className="border border-border rounded-xl bg-surface/15 overflow-hidden shadow-sm"
                  >
                    <div className="bg-surface/80 border-b border-border px-5 py-3 flex justify-between items-center bg-gradient-to-r from-bg to-transparent">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest border uppercase",
                            group.type === "GRANEL"
                              ? "border-amber-500/30 text-amber-500 bg-amber-500/5"
                              : "border-blue-500/30 text-blue-500 bg-blue-500/5",
                          )}
                        >
                          {group.type}
                        </span>
                        <h4 className="text-xs font-black text-text-main uppercase tracking-wider">
                          Calles de Carga ({group.loadingPoints.length})
                        </h4>
                      </div>
                    </div>
                    <div className="p-4 bg-bg-input/10">
                      <DataTable
                        columns={loadingPointColumns.filter((col) => col.header !== "Tipo")}
                        data={group.loadingPoints}
                        keyExtractor={(r) => r.id}
                      />
                    </div>
                  </div>
                ))}
                {groupedLoadingPoints.length === 0 && (
                  <div className="p-8 text-center text-xs text-text-muted bg-surface rounded-xl border border-border">
                    No se encontraron calles de carga.
                  </div>
                )}
              </div>
            )}
            {activeTab === "PROVEEDORES_BOLSA" && (
              <DataTable
                title="Proveedores de Bolsa"
                countLabel="proveedores"
                columns={bagSupplierColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {activeTab === "VEHICULOS" && (
              <DataTable
                title="Vehículos"
                countLabel="vehículos"
                columns={vehicleColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
            {(activeTab === "CONTROLES_BALANZAS" || activeTab === "PARAMETROS_BALANZA") && (
              <DataTable
                title="Parámetros y Tolerancias de Balanzas"
                countLabel="parámetros"
                columns={scaleParameterColumns}
                data={filteredData}
                keyExtractor={(r) => r.id}
              />
            )}
          </div>
        </div>

      <ConfirmModal
        isOpen={!!deletingId}
        title="Confirmar eliminación"
        message="¿Querés eliminar este registro? Esta acción no se puede deshacer."
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
      />

      {isFormOpen && (
        <MasterFormModal
          type={activeTab}
          item={editingItem}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          onSave={handleSave}
          masters={masters}
          currentUser={currentUser}
        />
      )}
    </motion.div>
  );
}

