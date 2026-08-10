/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { 
  AlertTriangle, Package, ClipboardList, Fuel, Wrench,
  Activity, PlusCircle, ShieldCheck, Settings, Bot,
  ChevronLeft, ChevronRight, Truck, Droplet, Layers, MapPin,
  RefreshCw, FileSpreadsheet, ChevronDown, LayoutGrid, X, Check
} from 'lucide-react';

// Modules
import { Header, BottomNav } from './components/layout/LayoutComponents';
import { ConfirmModal } from './components/ui/GlassUI';
import { DashboardView } from './components/productivity/dashboard';
import { StopsView } from './components/productivity/stops';
import { ProductionView } from './components/productivity/production';
import { LoadingLanesView } from './components/productivity/loading-lanes';
import { DaterControlView } from './components/productivity/dater-control';
import { ProductChangeView } from './components/productivity/product-change';
import { ScaleControlView } from './components/productivity/scale-control';
import { InventoryView } from './components/productivity/inventory';
import { PalletClassificationView } from './components/productivity/pallet-classification';
import { DespachosView } from './components/productivity/despachos';
import { FuelView } from './components/productivity/fuel';
import ReportsView from './components/productivity/reports/ReportsView';
import AdminView from './components/admin/AdminView';
import PlaceholderView from './components/PlaceholderView';
import WelcomeScreen from './components/auth/WelcomeScreen';
import { getSupabaseClient } from './lib/supabaseClient';

// Lib & Types
import { cn } from './lib/utils';
import { Shift, MachineStop, ProductionReport, DaterControl, ScaleControl, InventoryEntry, PalletClassification, UserContext, MasterData, AppUser, ProductChange, Company, FuelLoad, AlertNotification } from './types';
import { SYSTEM_VIEWS } from './lib/mockData';
import { fetchTable, createRecord as rawCreateRecord, updateRecord as rawUpdateRecord, deleteRecord as rawDeleteRecord, clearClientCache, syncTableToSheets } from './lib/dataService';
import { safeCache } from './lib/safeCache';
import { ToastContainer, ToastMessage } from './components/ui/Toast';

// --- Utilities ---
const saveToLocalStorageSafe = (
  key: string, 
  value: string
): boolean => {
  try {
    const parsed = JSON.parse(value);
    safeCache.set(key, parsed, 12 * 60 * 60 * 1000);
  } catch {
    safeCache.set(key, value, 12 * 60 * 60 * 1000);
  }
  return true;
};

const getCurrentShift = (shifts: Shift[]): Shift | null => {
  const now = new Date();
  const timeStr = format(now, 'HH:mm');
  return shifts.find(shift => {
    if (shift.startTime < shift.endTime) {
      return timeStr >= shift.startTime && timeStr < shift.endTime;
    } else {
      return timeStr >= shift.startTime || timeStr < shift.endTime;
    }
  }) || null;
};

const isStopForMachine = (stop: any, machineId: string | any | null | undefined, mastersAvailable: MasterData) => {
  if (!stop || !machineId) return false;
  
  // 1. Get the targetId helper
  let targetId = "";
  if (typeof machineId === 'object' && machineId !== null) {
    targetId = String(machineId.id || machineId.hacId || machineId.hac_id || machineId.name || machineId.nombre || "").trim().toUpperCase();
  } else {
    targetId = String(machineId).trim().toUpperCase();
  }
  
  if (!targetId) return false;

  // 1.5 Direct robust match to prevent master lookup failures
  const stopMacId = String(stop.machineId || stop.palletizerId || "").trim().toUpperCase();
  if (stopMacId && targetId && (stopMacId === targetId || targetId.includes(stopMacId) || stopMacId.includes(targetId))) {
    return true;
  }

  // 2. Find the selected machine object in palletizers or baggers
  const selectedMac: any = (mastersAvailable.palletizers || []).find((p: any) => p && (
    String(p.id).trim().toUpperCase() === targetId ||
    String(p.hacId || p.hac_id || "").trim().toUpperCase() === targetId ||
    String(p.name || p.nombre || "").trim().toUpperCase() === targetId
  )) || (mastersAvailable.baggers || []).find((b: any) => b && (
    String(b.id).trim().toUpperCase() === targetId ||
    String(b.hacId || b.hac_id || "").trim().toUpperCase() === targetId ||
    String(b.name || b.nombre || "").trim().toUpperCase() === targetId
  ));

  // Stop's fields
  const stopMachineId = String(stop.machineId || "").trim().toUpperCase();
  const stopMachineName = String(stop.machineName || "").trim().toUpperCase();
  const stopMachineHacText = String(stop.machineHacText || "").trim().toUpperCase();

  if (!selectedMac) {
    // If we can't find reference in master tables, check if stop's fields strictly equal targetId
    return stopMachineId === targetId || stopMachineHacText === targetId || stopMachineName === targetId;
  }

  // Machine's fields
  const macId = String(selectedMac.id).trim().toUpperCase();
  const macName = String(selectedMac.name || selectedMac.nombre || "").trim().toUpperCase();
  const macHacId = String(selectedMac.hacId || selectedMac.hac_id || "").trim().toUpperCase();

  // Strict match among any of the stop and mac fields
  const stopFields = [stopMachineId, stopMachineName, stopMachineHacText].filter(Boolean);
  const macFields = [macId, macName, macHacId].filter(Boolean);

  for (const sField of stopFields) {
    for (const mField of macFields) {
      if (sField === mField) return true;
    }
  }

  // Double check loose comparison (ignoring punctuation / space / special characters)
  const cleanStr = (val: string) => val.replace(/[^A-Z0-9]/g, '');
  const cleanStopFields = stopFields.map(cleanStr).filter(Boolean);
  const cleanMacFields = macFields.map(cleanStr).filter(Boolean);

  for (const sClean of cleanStopFields) {
    for (const mClean of cleanMacFields) {
      if (sClean === mClean) return true;
    }
  }

  // Special inclusion match if they contain HAC ID (e.g. "MG.673-PZ1")
  if (macHacId && (stopMachineHacText.includes(macHacId) || macHacId.includes(stopMachineHacText))) return true;

  return false;
};

const isStopForShift = (stop: any, shiftId: string | null | undefined, mastersAvailable: MasterData) => {
  if (!stop || !shiftId) return false;
  const targetId = String(shiftId).trim().toUpperCase();
  
  const selectedS: any = (mastersAvailable.shifts || []).find((s: any) => s && String(s.id).trim().toUpperCase() === targetId);
  if (!selectedS) {
    return String(stop.shiftId || '').trim().toUpperCase() === targetId;
  }
  
  const sId = String(selectedS.id).trim().toUpperCase();
  const sName = String(selectedS.name || selectedS.nombre || "").trim().toUpperCase();
  
  const stopShiftId = String(stop.shiftId || "").trim().toUpperCase();
  const stopShiftName = String(stop.shiftName || stop.turno || "").trim().toUpperCase();
  
  if (stopShiftId === sId) return true;
  if (stopShiftName === sName) return true;
  if (stopShiftId === sName) return true;
  if (stopShiftName === sId) return true;
  
  return false;
};

type AppSection = 'PRODUCTIVITY' | 'SAFETY' | 'ENVIRONMENT' | 'HR' | 'ADMIN';
type ProductivityTab = 'DASHBOARD' | 'PAROS' | 'PRODUCCION' | 'DATER' | 'SCALE' | 'STOCK' | 'PALLET_CLASS' | 'GASOIL' | 'MANTENIMIENTO' | 'CHANGE' | 'LOADING_LANES' | 'DESPACHOS' | 'REPORTS';

const productivityTabs = [
  { id: 'LOADING_LANES', label: 'Calles Carga', icon: <MapPin size={14} /> },
  { id: 'CHANGE', label: 'Cambio Producto', icon: <Bot size={14} /> },
  { id: 'PALLET_CLASS', label: 'Clasificación Pallets', icon: <Layers size={14} /> },
  { id: 'GASOIL', label: 'Combustible', icon: <Droplet size={14} /> },
  { id: 'SCALE', label: 'Control Balanzas', icon: <Activity size={14} /> },
  { id: 'DATER', label: 'Control Fechadores', icon: <ClipboardList size={14} /> },
  { id: 'DASHBOARD', label: 'Dashboard', icon: <Activity size={14} /> },
  { id: 'DESPACHOS', label: 'Despachos', icon: <Truck size={14} /> },
  { id: 'REPORTS', label: 'Informes', icon: <FileSpreadsheet size={14} /> },
  { id: 'STOCK', label: 'Insumos', icon: <PlusCircle size={14} /> },
  { id: 'MANTENIMIENTO', label: 'Mantenimiento', icon: <Settings size={14} /> },
  { id: 'PAROS', label: 'Paros', icon: <AlertTriangle size={14} /> },
  { id: 'PRODUCCION', label: 'Producción', icon: <Package size={14} /> },
] as const;

export default function App() {
  // Toast notifications State (Moved to top for visibility in all functions)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const [loadedVersion, setLoadedVersion] = useState<string | null>(null);
  const [showVersionAlert, setShowVersionAlert] = useState(false);

  // New Version Control & Operation Flags
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingVersionUpdate, setPendingVersionUpdate] = useState(false);
  // User interaction tracking state removed to prevent performance bottlenecks and selection click issues

  // Wrappers around dataService mutation API functions to track isSaving and hasUnsavedChanges dynamically
  const createRecordInSheets = async (tableName: string, record: any) => {
    setIsSaving(true);
    try {
      const res = await rawCreateRecord(tableName, record);
      if (res.success) setHasUnsavedChanges(false);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const updateRecordInSheets = async (tableName: string, id: string, record: any) => {
    setIsSaving(true);
    try {
      const res = await rawUpdateRecord(tableName, id, record);
      if (res.success) setHasUnsavedChanges(false);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRecordInSheets = async (tableName: string, id: string) => {
    setIsSaving(true);
    try {
      const res = await rawDeleteRecord(tableName, id);
      if (res.success) setHasUnsavedChanges(false);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to dynamically check if the DOM has active forms, open dialogs, or focused input fields
  const checkHasUnsavedChanges = (): boolean => {
    const activeEl = document.activeElement;
    if (activeEl) {
      const tag = activeEl.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return true;
      }
    }
    const modalOrForm = document.querySelector('[role="dialog"], .modal, .form-container');
    if (modalOrForm) {
      return true;
    }
    return false;
  };

  // Track Form edits to set hasUnsavedChanges (using state-free real-time DOM queries to prevent aggressive re-renders and selection interference)

  const handleVersionMismatch = (serverVer: string) => {
    const activeUnsaved = hasUnsavedChanges || checkHasUnsavedChanges();
    if (activeUnsaved || isSaving) {
      if (!pendingVersionUpdate) {
        setPendingVersionUpdate(true);
        addToast("Hay una nueva versión disponible. Se actualizará automáticamente al finalizar la operación.", "info");
      }
    } else {
      if (document.visibilityState === 'visible') {
        console.log("[Version Control] Tab visible and idle. Executing silent background reload.");
        try {
          clearClientCache();
          localStorage.removeItem("pscqube_app_version");
        } catch (e) {}
        window.location.reload();
      } else {
        setPendingVersionUpdate(true);
      }
    }
  };

  const checkAppVersion = async (isStartup = false) => {
    try {
      const res = await fetch('/api/version');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.version) {
        const serverVer = data.version;
        if (isStartup) {
          console.log(`[Version Control] App initialized server version: ${serverVer}`);
          setLoadedVersion(serverVer);
          localStorage.setItem("pscqube_app_version", serverVer);
        } else {
          const localVer = localStorage.getItem("pscqube_app_version") || loadedVersion;
          if (localVer && localVer !== serverVer) {
            console.warn(`[Version Control] Version mismatch! Browser: ${localVer} vs Server: ${serverVer}`);
            handleVersionMismatch(serverVer);
          }
        }
      }
    } catch (err) {
      console.warn("[Version Control] Error checking version:", err);
    }
  };

  // Perform a silent reload immediately once active save/edit operations finish and no unsaved changes remain
  useEffect(() => {
    if (!isSaving && pendingVersionUpdate) {
      const activeUnsaved = hasUnsavedChanges || checkHasUnsavedChanges();
      if (!activeUnsaved) {
        console.log("[Version Control] Active operations completed, no unsaved changes. Performing silent reload.");
        try {
          clearClientCache();
          localStorage.removeItem("pscqube_app_version");
        } catch (e) {}
        window.location.reload();
      }
    }
  }, [isSaving, pendingVersionUpdate, hasUnsavedChanges]);

  useEffect(() => {
    checkAppVersion(true);

    let lastCheckTime = Date.now();
    const tenMinutes = 10 * 60 * 1000;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Si hay una actualización pendiente y no hay cambios sin guardar, recargar
        if (pendingVersionUpdate) {
          const activeUnsaved = hasUnsavedChanges || checkHasUnsavedChanges();
          if (!activeUnsaved && !isSaving) {
            try {
              clearClientCache();
              localStorage.removeItem("pscqube_app_version");
            } catch (e) {}
            window.location.reload();
            return;
          }
        }

        // Chequear versión solo si pasaron más de 10 minutos desde el último chequeo
        const timeElapsed = Date.now() - lastCheckTime;
        if (timeElapsed > tenMinutes) {
          console.log("[Version Control] Visibility check. Checking for updates...");
          checkAppVersion(false);
          lastCheckTime = Date.now();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadedVersion, pendingVersionUpdate, hasUnsavedChanges, isSaving]);

  const [activeSection, setActiveSection] = useState<AppSection>('PRODUCTIVITY');
  const [prodTab, setProdTab] = useState<ProductivityTab>('DASHBOARD');
  const [isProdMenuOpen, setIsProdMenuOpen] = useState(false);
  const [adminTab, setAdminTab] = useState('SHIFTS');
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const subNavRef = useRef<HTMLDivElement>(null);

  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const handleBackgroundUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { tableName, data } = customEvent.detail;
      if (!data || !Array.isArray(data)) return;

      console.log(`[Background Revalidation Sync] Received fresh data for ${tableName}. updating React state.`);
      const upper = tableName.toUpperCase();
      if (upper === "PAROSV2" || upper === "PAROS") {
        setStops(data);
      } else if (upper === "PRODUCCIONV2" || upper === "PRODUCCION") {
        setProductionReports(data);
      } else if (upper === "CONTROL_FECHADORV2" || upper === "CONTROL_FECHADOR") {
        setDaterControls(data);
      } else if (upper === "CONTROL_BALANZAV2" || upper === "CONTROL_BALANZA") {
        setScaleControls(data);
      } else if (upper === "INVENTARIO_FISICOV2" || upper === "INVENTARIO_FISICO") {
        setInventoryEntries(data);
      } else if (upper === "CLASISFICACION_PALLETSV2" || upper === "CLASISFICACION_PALLETS") {
        setPalletClassifications(data);
      } else if (upper === "CAMBIO_PRODUCTOV2" || upper === "CAMBIO_PRODUCTO") {
        setProductChanges(data);
      } else if (upper === "DESPACHOSV2" || upper === "DESPACHOS") {
        setDispatchEntries(data);
      } else if (upper === "ESTADO_CALLESV2" || upper === "ESTADO_CALLES") {
        setLaneStatuses(data);
      } else if (upper === "TURNOSV2" || upper === "TURNOS") {
        setShifts(data);
      } else if (upper === "PALETIZADORAV2" || upper === "PALETIZADORA") {
        setPalletizers(data);
      } else if (upper === "ENSACADORAV2" || upper === "ENSACADORA") {
        setBaggers(data);
      } else if (upper === "HACSV2" || upper === "HACS") {
        setHacs(data);
      } else if (upper === "CAUSASV2" || upper === "CAUSAS") {
        setCauses(data);
      } else if (upper === "MATERIALESV2" || upper === "MATERIALES") {
        setMaterials(data);
      } else if (upper === "CAPACIDADESV2" || upper === "CAPACIDADES") {
        setCapacities(data);
      } else if (upper === "USUARIOSV2" || upper === "USUARIOS") {
        const sorted = [...data].sort((a, b) => 
          String(a.name || a.nombre || "").localeCompare(String(b.name || b.nombre || ""), "es", { sensitivity: "base" })
        );
        setUsers(sorted);
      } else if (upper === "EMPRESASV2" || upper === "EMPRESAS") {
        setCompanies(data);
      } else if (upper === "PUNTOS_CARGAV2" || upper === "PUNTOS_CARGA") {
        setLoadingPoints(data);
      } else if (upper === "PROVEEDORES_BOLSAV2" || upper === "PROVEEDORES_BOLSA") {
        setBagSuppliers(data);
      } else if (upper === "VEHICULOSV2" || upper === "VEHICULOS") {
        setVehicles(data);
      } else if (upper === "CARGA_COMBUSTIBLEV2" || upper === "CARGA_COMBUSTIBLE") {
        setFuelLoads(data);
      } else if (upper === "PARAMETROS_BALANZAV2" || upper === "PARAMETROS_BALANZA" || upper === "CONTROLES_BALANZAS") {
        setScaleParameters(data);
      }
    };

    window.addEventListener('table-data-updated' as any, handleBackgroundUpdate);
    return () => {
      window.removeEventListener('table-data-updated' as any, handleBackgroundUpdate);
    };
  }, []);

  useEffect(() => {
    const el = subNavRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [activeSection, hasEnteredApp]);

  // Master States for CRUD - Completely clean, without mock or preloaded local seed data
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [palletizers, setPalletizers] = useState<any[]>([]);
  const [baggers, setBaggers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [hacs, setHacs] = useState<any[]>([]);
  const [causes, setCauses] = useState<any[]>([]);
  const [capacities, setCapacities] = useState<any[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingPoints, setLoadingPoints] = useState<any[]>([]);
  const [bagSuppliers, setBagSuppliers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fuelLoads, setFuelLoads] = useState<any[]>([]);
  const [scaleParameters, setScaleParameters] = useState<any[]>([]);

  const masters: MasterData = {
    palletizers,
    baggers,
    materials,
    hacs,
    causes,
    shifts,
    capacities,
    users,
    companies,
    loadingPoints,
    bagSuppliers,
    vehicles,
    scaleParameters
  };

  // Secure full fallback admin user context if Sheets is completely empty
  const DEFAULT_USER = useMemo<AppUser>(() => ({
    dni: 'ADMIN-SUP',
    name: 'Administrador Principal',
    sapUser: 'admin',
    email: 'admin@system.com',
    position: 'Supervisor General',
    profile: 'Administrador',
    permissions: SYSTEM_VIEWS.map(v => ({
      viewId: v.id,
      label: v.label,
      section: v.section,
      level: 'EDIT'
    }))
  }), []);

  const [userContext, setUserContext] = useState<UserContext>({
    role: 'ADMIN',
    selectedPalletizerId: '',
    selectedShiftId: '',
    selectedDate: format(new Date(), 'yyyy-MM-dd'),
    currentUserDni: ''
  });

  const currentUser = useMemo(() => {
    let found = masters.users.find(u => u.dni === userContext.currentUserDni) || masters.users[0] || DEFAULT_USER;
    
    // Auto-normalize permissions array for safety to prevent client crashes from empty/missing/string properties
    let normalized = { ...found };
    let perms = normalized.permissions || (normalized as any).permisos;
    if (typeof perms === 'string' && perms.trim() !== '') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = [];
      }
    }
    if (!Array.isArray(perms) || perms.length === 0) {
      const level = normalized.profile === 'Administrador' ? 'EDIT' : 'VIEW';
      perms = SYSTEM_VIEWS.map(v => ({
        viewId: v.id,
        label: v.label,
        section: v.section,
        level: level
      }));
    }
    normalized.permissions = perms;

    if (normalized && (normalized.email?.toLowerCase() === 'joni0627@gmail.com' || normalized.dni === '20-12345678-9')) {
      return {
        ...normalized,
        profile: 'Administrador' as const,
        permissions: SYSTEM_VIEWS.map(v => ({
          viewId: v.id,
          label: v.label,
          section: v.section,
          level: 'EDIT' as const
        }))
      };
    }
    return normalized;
  }, [masters.users, userContext.currentUserDni, DEFAULT_USER]);

  const canView = (viewId: string) => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === viewId);
    return perm ? perm.level !== 'NONE' : false;
  };

  const canEdit = (viewId: string) => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === viewId);
    return perm ? perm.level === 'EDIT' : false;
  };

  // Auto-selection observers as Google Sheets data loads
  useEffect(() => {
    if (palletizers.length > 0 && !userContext.selectedPalletizerId) {
      setUserContext(prev => ({ ...prev, selectedPalletizerId: palletizers[0].id }));
    }
  }, [palletizers, userContext.selectedPalletizerId]);

  useEffect(() => {
    if (shifts.length > 0 && !userContext.selectedShiftId) {
      setUserContext(prev => ({ ...prev, selectedShiftId: shifts[0].id }));
    }
  }, [shifts, userContext.selectedShiftId]);

  useEffect(() => {
    if (users.length > 0 && !userContext.currentUserDni) {
      setUserContext(prev => ({ ...prev, currentUserDni: users[0].dni }));
    }
  }, [users, userContext.currentUserDni]);

  // Purge legacy localStorage cache entries once on mount to reclaim quota space
  useEffect(() => {
    safeCache.purgeLegacyLocalStorage();
  }, []);

  // Redirect if current tab is hidden
  useEffect(() => {
    if (activeSection === 'PRODUCTIVITY' && !canView(prodTab)) {
        const firstVisible = SYSTEM_VIEWS
          .filter(v => v.section === 'PRODUCTIVITY')
          .find(v => canView(v.id));
        if (firstVisible) setProdTab(firstVisible.id as ProductivityTab);
    }
  }, [currentUser, prodTab, activeSection]);

  const [stops, setStops] = useState<MachineStop[]>([]);
  const deletedStopIdsRef = useRef<Set<string>>(new Set());
  const [productionReports, setProductionReports] = useState<ProductionReport[]>([]);
  const [dispatchEntries, setDispatchEntries] = useState<any[]>([]);
  const [daterControls, setDaterControls] = useState<DaterControl[]>([]);
  const [scaleControls, setScaleControls] = useState<ScaleControl[]>([]);
  const [inventoryEntries, setInventoryEntries] = useState<InventoryEntry[]>([]);
  const [palletClassifications, setPalletClassifications] = useState<PalletClassification[]>([]);
  const [productChanges, setProductChanges] = useState<ProductChange[]>([]);
  const [laneStatuses, setLaneStatuses] = useState<any[]>([]);

  // Alert Notifications State (derived + read key tracker mapped by user DNI)
  const [readNotificationKeys, setReadNotificationKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('read_notifications_v1') || '[]');
    } catch {
      return [];
    }
  });

  const handleMarkAsRead = (id: string) => {
    setReadNotificationKeys(prev => {
      const keysToAdd = [
        id,
        `${currentUser.dni}-${id}`,
        currentUser.email ? `${currentUser.email}-${id}` : "",
        currentUser.sapUser ? `${currentUser.sapUser}-${id}` : ""
      ].filter(Boolean);
      
      const updated = Array.from(new Set([...prev, ...keysToAdd]));
      localStorage.setItem('read_notifications_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const handleMarkAllAsRead = (ids: string[]) => {
    setReadNotificationKeys(prev => {
      const keysToAdd: string[] = [];
      ids.forEach(id => {
        keysToAdd.push(id);
        keysToAdd.push(`${currentUser.dni}-${id}`);
        if (currentUser.email) keysToAdd.push(`${currentUser.email}-${id}`);
        if (currentUser.sapUser) keysToAdd.push(`${currentUser.sapUser}-${id}`);
      });
      const updated = Array.from(new Set([...prev, ...keysToAdd]));
      localStorage.setItem('read_notifications_v1', JSON.stringify(updated));
      return updated;
    });
  };

  const notifications = useMemo<AlertNotification[]>(() => {
    const list: AlertNotification[] = [];
    
    productChanges.forEach(pc => {
      const prevMat = masters.materials.find(m => m.id === pc.previousMaterialId)?.name || 'Desconocido';
      const newMat = masters.materials.find(m => m.id === pc.newMaterialId)?.name || 'Desconocido';
      
      // Notification for Lab users when product change is pending
      if (pc.approvalStatus === 'PENDIENTE') {
        const id = `${pc.id}-PENDIENTE`;
        list.push({
          id,
          type: 'NEW_PRODUCT_CHANGE',
          date: pc.date,
          title: 'Nuevo Cambio de Producto Pendiente',
          message: `El operario ${pc.operatorName} registró un cambio pidiendo análisis para el nuevo material: ${newMat}.`,
          isReadByUsers: [],
          targetProfile: 'Laboratorio',
          createdAt: pc.date,
          relatedId: pc.id
        });
      }
      
      // Notification for operators when product change has been APPROVED or RECHAZADO
      if (pc.approvalStatus === 'APROBADO' || pc.approvalStatus === 'RECHAZADO') {
        const id = `${pc.id}-${pc.approvalStatus}`;
        list.push({
          id,
          type: 'LAB_ANALYSIS_COMPLETED',
          date: pc.date,
          title: `Cambio de Producto ${pc.approvalStatus === 'APROBADO' ? 'Aprobado' : 'Rechazado'}`,
          message: `El análisis para el cambio de producto de ${prevMat} a ${newMat} fue ${pc.approvalStatus === 'APROBADO' ? 'APROBADO' : 'RECHAZADO'}.${pc.rejectionObservation ? ' Obs: ' + pc.rejectionObservation : ''}`,
          isReadByUsers: [],
          targetProfile: 'Operario',
          createdAt: pc.date,
          relatedId: pc.id
        });
      }
    });

    // Sort newer first
    return [...list].reverse();
  }, [productChanges, masters.materials]);

  // --- Persistent Segmented Operational Cache ---
  // Define operational tables map for each view tab
  const OPERATIONAL_TABLES_MAP = useMemo<Record<ProductivityTab, string[]>>(() => ({
    DASHBOARD: ["PAROSV2", "PRODUCCIONV2", "INVENTARIO_FISICOV2", "DESPACHOSV2", "ESTADO_CALLESV2"],
    PAROS: ["PAROSV2", "PRODUCCIONV2"],
    PRODUCCION: ["PRODUCCIONV2", "PAROSV2"],
    CHANGE: ["CAMBIO_PRODUCTOV2"],
    DESPACHOS: ["DESPACHOSV2"],
    STOCK: ["INVENTARIO_FISICOV2"],
    LOADING_LANES: ["ESTADO_CALLESV2"],
    GASOIL: ["CARGA_COMBUSTIBLEV2"],
    DATER: ["CONTROL_FECHADORV2"],
    SCALE: ["CONTROL_BALANZAV2"],
    PALLET_CLASS: ["CLASISFICACION_PALLETSV2"],
    MANTENIMIENTO: []
  }), []);

  // Cooldown tracker per table-date-shift (60s)
  const tableCooldownsRef = useRef<Record<string, number>>({});

  // Active in-flight requests tracker to avoid parallel identical queries
  const inFlightFetchesRef = useRef<Record<string, Promise<any>>>({});

  // In-memory segmented cache by tableName_date_shiftId
  const operationalDataByKeyRef = useRef<Record<string, any[]>>({});

  const getCooldownKey = useCallback((tableName: string, date: string, shiftId: string) => {
    return `${tableName.toUpperCase()}_${date}_${shiftId}`;
  }, []);

  const updateTableState = useCallback((tableName: string, data: any[], targetDate?: string, targetShiftId?: string) => {
    const upper = tableName.toUpperCase();
    
    // Only update active React states if the incoming data corresponds to the currently active context view
    const isCurrentContext = (!targetDate || targetDate === userContext.selectedDate) &&
                             (!targetShiftId || targetShiftId === userContext.selectedShiftId);
    
    if (isCurrentContext) {
      if (upper === "PAROSV2") {
        setStops(data.filter(s => s && !deletedStopIdsRef.current.has(s.id)));
      } else if (upper === "PRODUCCIONV2") {
        setProductionReports(data);
      } else if (upper === "CONTROL_FECHADORV2") {
        setDaterControls(data);
      } else if (upper === "CONTROL_BALANZAV2") {
        setScaleControls(data);
      } else if (upper === "INVENTARIO_FISICOV2") {
        setInventoryEntries(data);
      } else if (upper === "CLASISFICACION_PALLETSV2") {
        setPalletClassifications(data);
      } else if (upper === "CAMBIO_PRODUCTOV2") {
        setProductChanges(data);
      } else if (upper === "DESPACHOSV2") {
        setDispatchEntries(data);
      } else if (upper === "ESTADO_CALLESV2") {
        setLaneStatuses(data);
      } else if (upper === "CARGA_COMBUSTIBLEV2") {
        setFuelLoads(data);
      }
    }

    // Always update cache and persist to localStorage
    const actualDate = targetDate || userContext.selectedDate;
    const actualShiftId = targetShiftId || userContext.selectedShiftId;
    const key = getCooldownKey(tableName, actualDate, actualShiftId);
    
    operationalDataByKeyRef.current[key] = data;
    safeCache.set('pscqube_op_cache_' + key, data, 12 * 60 * 60 * 1000);
  }, [userContext.selectedDate, userContext.selectedShiftId, getCooldownKey]);

  // --- On-demand database synchronization triggered by pressing "Ingresar"
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Sincronizando información...');

  const handleSyncOnEnter = async (targetDni?: string) => {
    setIsSyncing(true);
    setSyncMessage('Iniciando sincronización...');
    try {
      let maestrosData = await safeCache.get('pscqube_maestros_cache');

      if (!maestrosData) {
        setSyncMessage('Cargando catálogos maestros...');
        const maestrosRes = await fetch('/api/sync/maestros');
        maestrosData = await maestrosRes.json();
        if (maestrosData && maestrosData.success && maestrosData.data) {
          await safeCache.set('pscqube_maestros_cache', maestrosData, 30 * 60 * 1000);
        }
      }

      setSyncMessage('Sincronizando datos operativos...');

      const initialFilters = {
        date: userContext.selectedDate,
        shiftId: userContext.selectedShiftId,
        palletizerId: userContext.selectedPalletizerId
      };

      const [
        resStops, resProduction, resDater, resScale, resStock,
        resPalletClassifications, resChange, resDespachos,
        resLoadingLanes, resFuelLoads, resUsers, resScaleParams
      ] = await Promise.all([
        fetchTable("PAROSV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("PRODUCCIONV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("CONTROL_FECHADORV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("CONTROL_BALANZAV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("INVENTARIO_FISICOV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("CLASISFICACION_PALLETSV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("CAMBIO_PRODUCTOV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("DESPACHOSV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("ESTADO_CALLESV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("CARGA_COMBUSTIBLEV2", false, initialFilters, "App.handleSyncOnEnter"),
        fetchTable("USUARIOSV2", true, {}, "App.handleSyncOnEnter"),
        fetchTable("PARAMETROS_BALANZAV2", false, {}, "App.handleSyncOnEnter")
      ]);

      setSyncMessage('Preparando sistema...');

      const entDate = userContext.selectedDate;
      const entShift = userContext.selectedShiftId;

      // Setear maestros desde /api/sync/maestros
      if (maestrosData.success && maestrosData.data) {
        const d = maestrosData.data;
        if (d.turnos) setShifts(d.turnos);
        if (d.paletizadoras) setPalletizers(d.paletizadoras);
        if (d.ensacadoras) setBaggers(d.ensacadoras);
        if (d.hacs) setHacs(d.hacs);
        if (d.causas) setCauses(d.causas);
        if (d.materiales) setMaterials(d.materiales);
        if (d.capacidades) setCapacities(d.capacidades);
        if (d.empresas) setCompanies(d.empresas);
        if (d.puntoscarga) setLoadingPoints(d.puntoscarga);
        if (d.proveedoresbolsa) setBagSuppliers(d.proveedoresbolsa);
        if (d.vehiculos) setVehicles(d.vehiculos);
        if (d.parametrosbalanza || d.parametros_balanza) setScaleParameters(d.parametrosbalanza || d.parametros_balanza);
        
        // If direct fetch returned params, ensure they take effect
        if (resScaleParams && resScaleParams.success && Array.isArray(resScaleParams.data) && resScaleParams.data.length > 0) {
          setScaleParameters(resScaleParams.data);
        }
        
        // Get absolute latest users list (bypassing any server-side cache)
        const rawUsers = (resUsers && resUsers.success && Array.isArray(resUsers.data))
          ? resUsers.data
          : d.usuarios;

        if (rawUsers) {
          const normalized = (rawUsers as any[]).map(u => {
            let perms = u.permissions || u.permisos;
            if (typeof perms === 'string' && perms.trim() !== '') {
              try { perms = JSON.parse(perms); } catch { perms = []; }
            }
            if (!Array.isArray(perms) || perms.length === 0) {
              const level = u.profile === 'Administrador' ? 'EDIT' : 'VIEW';
              perms = SYSTEM_VIEWS.map(v => ({ viewId: v.id, label: v.label, section: v.section, level }));
            }
            return { ...u, permissions: perms };
          });
          const sorted = normalized.sort((a, b) => 
            String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" })
          );
          setUsers(sorted);
          const activeDni = targetDni || sessionStorage.getItem('pscqube_user_dni') || (sorted[0]?.dni || '');
          if (activeDni) setUserContext(prev => ({ ...prev, currentUserDni: activeDni }));
        }
      }

      // Setear operacionales
      if (resStops.success && resStops.data) updateTableState("PAROSV2", resStops.data, entDate, entShift);
      if (resProduction.success && resProduction.data) updateTableState("PRODUCCIONV2", resProduction.data, entDate, entShift);
      if (resDater.success && resDater.data) updateTableState("CONTROL_FECHADORV2", resDater.data, entDate, entShift);
      if (resScale.success && resScale.data) updateTableState("CONTROL_BALANZAV2", resScale.data, entDate, entShift);
      if (resStock.success && resStock.data) updateTableState("INVENTARIO_FISICOV2", resStock.data, entDate, entShift);
      if (resPalletClassifications.success && resPalletClassifications.data) updateTableState("CLASISFICACION_PALLETSV2", resPalletClassifications.data, entDate, entShift);
      if (resChange.success && resChange.data) updateTableState("CAMBIO_PRODUCTOV2", resChange.data, entDate, entShift);
      if (resDespachos.success && resDespachos.data) updateTableState("DESPACHOSV2", resDespachos.data, entDate, entShift);
      if (resLoadingLanes.success && resLoadingLanes.data) updateTableState("ESTADO_CALLESV2", resLoadingLanes.data, entDate, entShift);
      if (resFuelLoads.success && resFuelLoads.data) updateTableState("CARGA_COMBUSTIBLEV2", resFuelLoads.data, entDate, entShift);

      addToast("Sincronización completada exitosamente.", "success");
    } catch (err) {
      console.error("[SyncOnEnter] Error durante sincronización:", err);
      addToast("Error al sincronizar con base de datos.", "error");
    } finally {
      setIsSyncing(false);
      setHasEnteredApp(true);
    }
  };

  const handleRefreshCurrentFilters = async () => {
    addToast("Sincronizando datos operativos de la vista actual...", "info");
    try {
      const tables = OPERATIONAL_TABLES_MAP[prodTab] || [];
      const date = userContext.selectedDate;
      const shiftId = userContext.selectedShiftId;
      tables.forEach(tableName => {
        const key = getCooldownKey(tableName, date, shiftId);
        delete tableCooldownsRef.current[key];
      });

      await refreshOperationalDataForView(activeSection, prodTab, true, "ManualRefreshButton");
      addToast("¡Datos operativos actualizados con éxito!", "success");
    } catch (err) {
      console.error("Error refreshing current view:", err);
      addToast("Error al actualizar la vista actual", "error");
    }
  };

  // Automatically restore active user session elements on start
  useEffect(() => {
    const savedDni = sessionStorage.getItem('pscqube_user_dni');
    if (savedDni) {
      handleSyncOnEnter(savedDni);
    }
  }, []);

  // Keep refs for background comparison without closure stale-state issue
  const productChangesRef = useRef<ProductChange[]>(productChanges);
  useEffect(() => {
    productChangesRef.current = productChanges;
  }, [productChanges]);

  // Keep track of the last time operational transactions were fetched
  const lastOperationalFetchTimeRef = useRef<number>(Date.now());

  // Immediate Cache/Snapshot Restore on view or context change (instant UI responsiveness)
  useEffect(() => {
    if (!hasEnteredApp) return;
    
    const date = userContext.selectedDate;
    const shiftId = userContext.selectedShiftId;
    const tables = OPERATIONAL_TABLES_MAP[prodTab] || [];
    
    console.log(`[Immediate Restore] Context changed to Date: ${date}, Shift: ${shiftId}, Tab: ${prodTab}. Restoring snapshots.`);
    
    const restoreSnapshots = async () => {
      for (const tableName of tables) {
        const key = getCooldownKey(tableName, date, shiftId);
        
        // Try memory ref first
        let cachedData = operationalDataByKeyRef.current[key];
        
        // If not in memory, check safeCache (IndexedDB)
        if (cachedData === undefined) {
          const loaded = await safeCache.get('pscqube_op_cache_' + key);
          if (loaded) {
            cachedData = loaded;
            operationalDataByKeyRef.current[key] = cachedData;
          }
        }
        
        if (cachedData !== undefined) {
          console.log(`[Immediate Restore] Found snapshot for ${tableName} (key: ${key}). Restoring.`);
          updateTableState(tableName, cachedData, date, shiftId);
        } else {
          // First-time visit or no cache: clear the state to prevent leaking previous context's data in local UI filters
          console.log(`[Immediate Restore] No snapshot found for ${tableName} (key: ${key}). Clearing state.`);
          updateTableState(tableName, [], date, shiftId);
        }
      }
    };

    restoreSnapshots();
  }, [hasEnteredApp, userContext.selectedDate, userContext.selectedShiftId, prodTab, getCooldownKey, updateTableState, OPERATIONAL_TABLES_MAP]);

  const fetchTableWithGuards = useCallback(async (tableName: string, bypassCache = false, source = "unspecified") => {
    const date = userContext.selectedDate;
    const shiftId = userContext.selectedShiftId;
    const key = getCooldownKey(tableName, date, shiftId);

    // 1. Cooldown Check (60 seconds)
    if (!bypassCache) {
      const lastFetch = tableCooldownsRef.current[key] || 0;
      const now = Date.now();
      if (now - lastFetch < 60000) {
        console.log(`[Cooldown Guard] Skipping fetch for ${tableName} (last fetch ${Math.round((now - lastFetch)/1000)}s ago)`);
        
        // Ensure state contains latest cache as a fallback/guard
        let cachedData = operationalDataByKeyRef.current[key];
        if (cachedData === undefined) {
          const loaded = await safeCache.get('pscqube_op_cache_' + key);
          if (loaded) {
            cachedData = loaded;
            operationalDataByKeyRef.current[key] = cachedData;
          }
        }
        if (cachedData !== undefined) {
          updateTableState(tableName, cachedData, date, shiftId);
        }
        return;
      }
    }

    // 2. In-flight Guard Check
    if (inFlightFetchesRef.current[key]) {
      console.log(`[In-Flight Guard] Request for ${tableName} already in progress. Re-using existing query.`);
      return inFlightFetchesRef.current[key];
    }

    // 3. Perform Fetch with fetchTable
    const filters = { date, shiftId };
    const fetchPromise = (async () => {
      try {
        const res = await fetchTable(tableName, bypassCache, filters, source);
        if (res.success && res.data) {
          updateTableState(tableName, res.data, date, shiftId);
          tableCooldownsRef.current[key] = Date.now();
        }
        return res;
      } finally {
        delete inFlightFetchesRef.current[key];
      }
    })();

    inFlightFetchesRef.current[key] = fetchPromise;
    return fetchPromise;
  }, [userContext.selectedDate, userContext.selectedShiftId, getCooldownKey, updateTableState]);

  const refreshOperationalDataForView = useCallback(async (
    section: AppSection, 
    tab: ProductivityTab, 
    bypassCache = false, 
    source = "unspecified"
  ) => {
    if (section !== 'PRODUCTIVITY') return;
    const tables = OPERATIONAL_TABLES_MAP[tab];
    if (!tables || tables.length === 0) return;

    console.log(`[Navigation Sync] Refreshing operational data for view: ${tab} with tables: ${tables.join(", ")} (bypassCache: ${bypassCache}, source: ${source})`);

    try {
      await Promise.all(
        tables.map(table => fetchTableWithGuards(table, bypassCache, source))
      );
      lastOperationalFetchTimeRef.current = Date.now();
    } catch (err) {
      console.error(`[Navigation Sync] Error refreshing operational data for ${tab}:`, err);
    }
  }, [fetchTableWithGuards, OPERATIONAL_TABLES_MAP]);

  // Keep track of the debounced timeout ref
  const tabChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Centralized Navigation Sync Effect with Debounce (300-500 ms)
  useEffect(() => {
    if (!hasEnteredApp) return;

    if (tabChangeTimeoutRef.current) {
      clearTimeout(tabChangeTimeoutRef.current);
    }

    tabChangeTimeoutRef.current = setTimeout(() => {
      console.log(`[Navigation Sync] Debounce trigger activeSection: ${activeSection}, prodTab: ${prodTab}`);
      refreshOperationalDataForView(activeSection, prodTab, false, "NavigationDebounce");
    }, 400);

    return () => {
      if (tabChangeTimeoutRef.current) {
        clearTimeout(tabChangeTimeoutRef.current);
      }
    };
  }, [activeSection, prodTab, hasEnteredApp, userContext.selectedDate, userContext.selectedShiftId, refreshOperationalDataForView]);

  // Operational focus restorer detection (after > 10 minutes)
  useEffect(() => {
    if (!hasEnteredApp) return;

    const handleVisibilityChangeOperational = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastOperationalFetchTimeRef.current;
        const tenMinutes = 10 * 60 * 1000;
        
        if (elapsed > tenMinutes) {
          console.log(`[Operational Refresh] Focus restorer detected elapsed time is ${Math.round(elapsed / 1000)}s (> 10 mins). Executing silent operational refresh.`);
          // Clear cooldowns for current view's tables to guarantee fresh fetch
          const tables = OPERATIONAL_TABLES_MAP[prodTab] || [];
          const date = userContext.selectedDate;
          const shiftId = userContext.selectedShiftId;
          tables.forEach(tableName => {
            const key = getCooldownKey(tableName, date, shiftId);
            delete tableCooldownsRef.current[key];
          });
          refreshOperationalDataForView(activeSection, prodTab, true, "FocusRestorer");
        } else {
          console.log(`[Operational Refresh] Focus restorer skipped fetch. Elapsed: ${Math.round(elapsed / 1000)}s (< 10 mins).`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChangeOperational);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChangeOperational);
    };
  }, [hasEnteredApp, prodTab, activeSection, userContext.selectedDate, userContext.selectedShiftId, refreshOperationalDataForView, getCooldownKey, OPERATIONAL_TABLES_MAP]);

  // Helper to force cache bypass for a single table after local CRUD mutations
  const forceRefreshTable = useCallback((tableName: string) => {
    const date = userContext.selectedDate;
    const shiftId = userContext.selectedShiftId;
    const key = getCooldownKey(tableName, date, shiftId);
    
    // Invalidate local cooldown for this combination
    delete tableCooldownsRef.current[key];
  // Trigger guarded fetch with bypassCache = true
    fetchTableWithGuards(tableName, true, `CRUD_${tableName}`);
  }, [userContext.selectedDate, userContext.selectedShiftId, getCooldownKey, fetchTableWithGuards]);

  // --- Centralized, Synchronized & Toast-Enabled handlers ---
  
  const handleSaveDispatch = (entry: any) => {
    const exists = dispatchEntries.some(x => x.id === entry.id);
    setDispatchEntries(prev => {
      return exists
        ? prev.map(x => x.id === entry.id ? entry : x)
        : [entry, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("DESPACHOSV2", entry.id, entry)
      : createRecordInSheets("DESPACHOSV2", entry);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Despacho actualizado con éxito" : "Despacho guardado con éxito", "success");
        forceRefreshTable("DESPACHOSV2");
      } else {
        addToast("Guardado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteDispatch = (id: string) => {
    setDispatchEntries(prev => prev.filter(e => e.id !== id));

    deleteRecordInSheets("DESPACHOSV2", id).then(res => {
      if (res.success) {
        addToast("Despacho eliminado", "success");
        forceRefreshTable("DESPACHOSV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveStop = (stop: MachineStop) => {
    deletedStopIdsRef.current.delete(stop.id);
    const exists = stops.some(x => x.id === stop.id);
    setStops(prev => {
      return exists
        ? prev.map(x => x.id === stop.id ? stop : x)
        : [stop, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("PAROSV2", stop.id, stop)
      : createRecordInSheets("PAROSV2", stop);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Paro actualizado con éxito" : "Paro registrado con éxito", "success");
        forceRefreshTable("PAROSV2");
        forceRefreshTable("PRODUCCIONV2");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveMultipleStops = async (stopsToSave: MachineStop[]) => {
    if (!stopsToSave || stopsToSave.length === 0) return;
    
    // Optimistically update the client state for immediate visual feedback
    setStops(prev => {
      const stopIds = stopsToSave.map(s => s.id);
      const filtered = prev.filter(s => !stopIds.includes(s.id));
      return [...stopsToSave, ...filtered];
    });

    setIsSaving(true);
    try {
      const promises = stopsToSave.map(stop => {
        deletedStopIdsRef.current.delete(stop.id);
        const exists = stops.some(x => x.id === stop.id);
        return exists
          ? updateRecordInSheets("PAROSV2", stop.id, stop)
          : createRecordInSheets("PAROSV2", stop);
      });

      const results = await Promise.all(promises);
      const allSuccess = results.every(res => res.success);

      if (allSuccess) {
        addToast(
          stopsToSave.length > 1
            ? `${stopsToSave.length} paros registrados y sincronizados con éxito`
            : "Paro registrado con éxito",
          "success"
        );
        forceRefreshTable("PAROSV2");
        forceRefreshTable("PRODUCCIONV2");
      } else {
        const errorMsg = results.find(r => !r.success)?.error || "Error de sincronización con Google Sheets";
        addToast(`Guardado localmente. Error al sincronizar: ${errorMsg}`, "warning");
      }
    } catch (err: any) {
      console.error("[Save Multiple Stops Error]", err);
      addToast("Error al guardar paros en base de datos", "warning");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStop = (id: string) => {
    deletedStopIdsRef.current.add(id);
    setStops(prev => prev.filter(s => s.id !== id));

    deleteRecordInSheets("PAROSV2", id).then(res => {
      if (res.success) {
        addToast("Paro eliminado", "success");
        forceRefreshTable("PAROSV2");
        forceRefreshTable("PRODUCCIONV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveProductionReport = (report: ProductionReport) => {
    const exists = productionReports.some(x => x.id === report.id);
    setProductionReports(prev => {
      return exists
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("PRODUCCIONV2", report.id, report)
      : createRecordInSheets("PRODUCCIONV2", report);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Producción actualizada con éxito" : "Producción guardada con éxito", "success");
        forceRefreshTable("PRODUCCIONV2");
      } else {
        addToast("Guardada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteProductionReport = (id: string) => {
    setProductionReports(prev => prev.filter(r => r.id !== id));

    deleteRecordInSheets("PRODUCCIONV2", id).then(res => {
      if (res.success) {
        addToast("Reporte de producción eliminado de base de datos", "success");
        forceRefreshTable("PRODUCCIONV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveDaterControl = (report: DaterControl, isUpdateExplicit?: boolean) => {
    const exists = isUpdateExplicit !== undefined ? isUpdateExplicit : daterControls.some(x => x.id === report.id);
    setDaterControls(prev => {
      const inPrev = prev.some(x => x.id === report.id);
      return inPrev
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("CONTROL_FECHADORV2", report.id, report)
      : createRecordInSheets("CONTROL_FECHADORV2", report);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Control fechador actualizado con éxito" : "Control fechador registrado con éxito", "success");
        forceRefreshTable("CONTROL_FECHADORV2");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteDaterControl = (id: string) => {
    setDaterControls(prev => prev.filter(c => c.id !== id));

    deleteRecordInSheets("CONTROL_FECHADORV2", id).then(res => {
      if (res.success) {
        addToast("Control fechador eliminado de Google Sheets", "success");
        forceRefreshTable("CONTROL_FECHADORV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveScaleControl = (report: ScaleControl, isUpdateExplicit?: boolean) => {
    const exists = isUpdateExplicit !== undefined ? isUpdateExplicit : scaleControls.some(x => x.id === report.id);
    setScaleControls(prev => {
      const inPrev = prev.some(x => x.id === report.id);
      return inPrev
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("CONTROL_BALANZAV2", report.id, report)
      : createRecordInSheets("CONTROL_BALANZAV2", report);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Control de balanza actualizado con éxito" : "Control de balanza registrado con éxito", "success");
        forceRefreshTable("CONTROL_BALANZAV2");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteScaleControl = (id: string) => {
    setScaleControls(prev => prev.filter(c => c.id !== id));

    deleteRecordInSheets("CONTROL_BALANZAV2", id).then(res => {
      if (res.success) {
        addToast("Control de balanza eliminado", "success");
        forceRefreshTable("CONTROL_BALANZAV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveInventory = (entry: InventoryEntry) => {
    const exists = inventoryEntries.some(x => x.id === entry.id);
    setInventoryEntries(prev => {
      return exists
        ? prev.map(x => x.id === entry.id ? entry : x)
        : [entry, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("INVENTARIO_FISICOV2", entry.id, entry)
      : createRecordInSheets("INVENTARIO_FISICOV2", entry);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Registro de insumo actualizado" : "Registro de insumo guardado", "success");
        forceRefreshTable("INVENTARIO_FISICOV2");
      } else {
        addToast("Guardado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteInventory = (id: string) => {
    setInventoryEntries(prev => prev.filter(e => e.id !== id));

    deleteRecordInSheets("INVENTARIO_FISICOV2", id).then(res => {
      if (res.success) {
        addToast("Registro de insumo eliminado", "success");
        forceRefreshTable("INVENTARIO_FISICOV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleBulkUpdateInventory = async (entriesToUpdate: { id: string; date: string; shiftId: string }[]) => {
    // 1. Update the local React state immediately for snappy UI
    setInventoryEntries(prev => {
      return prev.map(item => {
        const match = entriesToUpdate.find(u => u.id === item.id);
        if (match) {
          return { ...item, date: match.date, shiftId: match.shiftId };
        }
        return item;
      });
    });

    setIsSaving(true);
    let successCount = 0;
    try {
      for (const update of entriesToUpdate) {
        const originalItem = inventoryEntries.find(x => x.id === update.id);
        if (originalItem) {
          const updatedItem = { ...originalItem, date: update.date, shiftId: update.shiftId };
          const res = await rawUpdateRecord("INVENTARIO_FISICOV2", update.id, updatedItem);
          if (res.success) {
            successCount++;
          }
        }
      }
      
      if (successCount === entriesToUpdate.length) {
        addToast("Turno y fecha actualizados para todos los conteos", "success");
        forceRefreshTable("INVENTARIO_FISICOV2");
      } else if (successCount > 0) {
        addToast(`Actualizados ${successCount} de ${entriesToUpdate.length} conteos en base de datos`, "warning");
        forceRefreshTable("INVENTARIO_FISICOV2");
      } else {
        addToast("Error al sincronizar con la base de datos.", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Error al realizar la actualización masiva.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePalletClass = (entry: PalletClassification) => {
    const exists = palletClassifications.some(x => x.id === entry.id);
    setPalletClassifications(prev => {
      return exists
        ? prev.map(x => x.id === entry.id ? entry : x)
        : [entry, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("CLASISFICACION_PALLETSV2", entry.id, entry)
      : createRecordInSheets("CLASISFICACION_PALLETSV2", entry);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Registro de pallet actualizado" : "Registro de pallet guardado", "success");
        forceRefreshTable("CLASISFICACION_PALLETSV2");
      } else {
        addToast("Guardado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeletePalletClass = (id: string) => {
    setPalletClassifications(prev => prev.filter(e => e.id !== id));

    deleteRecordInSheets("CLASISFICACION_PALLETSV2", id).then(res => {
      if (res.success) {
        addToast("Registro de pallet eliminado", "success");
        forceRefreshTable("CLASISFICACION_PALLETSV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveProductChange = (report: ProductChange) => {
    const exists = productChanges.some(x => x.id === report.id);
    setProductChanges(prev => {
      return exists
        ? prev.map(x => x.id === report.id ? report : x)
        : [report, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("CAMBIO_PRODUCTOV2", report.id, report)
      : createRecordInSheets("CAMBIO_PRODUCTOV2", report);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Cambio de producto actualizado con éxito" : "Cambio de producto registrado con éxito", "success");
        forceRefreshTable("CAMBIO_PRODUCTOV2");
      } else {
        addToast("Registrado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteProductChange = (id: string) => {
    setProductChanges(prev => prev.filter(c => c.id !== id));

    deleteRecordInSheets("CAMBIO_PRODUCTOV2", id).then(res => {
      if (res.success) {
        addToast("Cambio de producto eliminado", "success");
        forceRefreshTable("CAMBIO_PRODUCTOV2");
      } else {
        addToast("Eliminado localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveLaneStatus = (laneStatus: any) => {
    const statusesToSave = Array.isArray(laneStatus) ? laneStatus : [laneStatus];

    setLaneStatuses(prev => {
      let current = [...prev];
      statusesToSave.forEach(status => {
        const idx = current.findIndex(x => x.id === status.id);
        if (idx > -1) {
          current[idx] = status;
        } else {
          current = [status, ...current];
        }
      });
      return current;
    });

    const promises = statusesToSave.map(status => {
      const entryExists = laneStatuses.some(x => x.id === status.id);
      return entryExists
        ? updateRecordInSheets("ESTADO_CALLESV2", status.id, status)
        : createRecordInSheets("ESTADO_CALLESV2", status);
    });

    Promise.all(promises).then(results => {
      const allSuccess = results.every(res => res.success);
      if (allSuccess) {
        addToast(
          Array.isArray(laneStatus)
            ? "Estados de calles actualizados con éxito"
            : "Calle de carga guardada con éxito",
          "success"
        );
        forceRefreshTable("ESTADO_CALLESV2");
      } else {
        addToast("Sincronizado parcialmente en base de datos.", "warning");
      }
    }).catch(() => {
      addToast("Registrada localmente. Error al sincronizar.", "warning");
    });
  };

  const handleDeleteLaneStatus = (id: string) => {
    setLaneStatuses(prev => prev.filter(l => l.id !== id));

    deleteRecordInSheets("ESTADO_CALLESV2", id).then(res => {
      if (res.success) {
        addToast("Calle de carga eliminada", "success");
        forceRefreshTable("ESTADO_CALLESV2");
      } else {
        addToast("Eliminada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleSaveFuelLoad = (load: any) => {
    const exists = fuelLoads.some(x => x.id === load.id);
    setFuelLoads(prev => {
      return exists
        ? prev.map(x => x.id === load.id ? load : x)
        : [load, ...prev];
    });

    const actionPromise = exists
      ? updateRecordInSheets("CARGA_COMBUSTIBLEV2", load.id, load)
      : createRecordInSheets("CARGA_COMBUSTIBLEV2", load);

    actionPromise.then(res => {
      if (res.success) {
        addToast(exists ? "Carga de combustible actualizada con éxito" : "Carga de combustible registrada con éxito", "success");
        forceRefreshTable("CARGA_COMBUSTIBLEV2");
      } else {
        addToast("Guardada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };

  const handleDeleteFuelLoad = (id: string) => {
    setFuelLoads(prev => prev.filter(e => e.id !== id));

    deleteRecordInSheets("CARGA_COMBUSTIBLEV2", id).then(res => {
      if (res.success) {
        addToast("Carga de combustible eliminada con éxito", "success");
        forceRefreshTable("CARGA_COMBUSTIBLEV2");
      } else {
        addToast("Eliminada localmente. Error al sincronizar con base de datos.", "warning");
      }
    });
  };
  
  const selectedShift = useMemo(() => 
    masters.shifts.find(s => s.id === userContext.selectedShiftId) || null,
    [masters.shifts, userContext.selectedShiftId]
  );

  const currentShift = useMemo(() => getCurrentShift(masters.shifts), [masters.shifts]);
  
  const selectedPalletizer = useMemo(() => 
    masters.palletizers.find(p => p.id === userContext.selectedPalletizerId) || null,
    [masters.palletizers, userContext.selectedPalletizerId]
  );

  // KPI calculations
  const kpis = useMemo(() => {
    if (!selectedPalletizer || !selectedShift) return { availability: 0, performance: 0, hsMarcha: 0, totalTons: 0 };
    const machineStops = stops.filter(s => 
      s &&
      s.date === userContext.selectedDate &&
      isStopForMachine(s, selectedPalletizer.id, masters) &&
      isStopForShift(s, selectedShift.id, masters)
    );
    const contextReports = productionReports.filter(r => 
      r.palletizerId === selectedPalletizer.id && 
      r.shiftId === selectedShift.id &&
      r.date === userContext.selectedDate
    );

    const hsShift = selectedShift.durationHours;
    const totalStopMinutes = machineStops.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalStopHours = totalStopMinutes / 60;
    
    const externalStopMinutes = machineStops
      .filter(s => masters.causes.find(c => c.id === s.causeId)?.stopType === 'EXTERNO')
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    const externalStopHours = externalStopMinutes / 60;

    const hsMarcha = hsShift - totalStopHours;
    const availability = hsShift > 0 ? (externalStopHours + hsMarcha) / hsShift : 0;

    let performance = 0;
    let totalTons = 0;
    if (contextReports.length > 0 && hsMarcha > 0) {
      totalTons = contextReports.reduce((sum, r) => sum + (Number(r.tonsProduced) || 0), 0);
      // Guard against BDP = 0 to avoid Infinity
      const sumTonsOverBDP = contextReports.reduce((sum, r) => sum + ((Number(r.tonsProduced) || 0) / (Number(r.bdp) || 100)), 0);
      const theoreticBDPWeighted = sumTonsOverBDP > 0 ? totalTons / sumTonsOverBDP : 100;
      performance = Math.min(1.5, (totalTons / hsMarcha) / theoreticBDPWeighted);
    }

    return {
      availability: availability * 100,
      performance: performance * 100,
      hsMarcha,
      totalTons
    };
  }, [selectedPalletizer, selectedShift, stops, productionReports, masters.causes]);

  return (
    <>
      <AnimatePresence>
        {showVersionAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[99999] flex flex-col items-center justify-center p-4 text-center"
          >
            <div className="max-w-md w-full bg-[#1c1d24] border border-[#ef4444]/30 p-8 rounded-2xl shadow-2xl flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-[#ef4444]/15 rounded-full flex items-center justify-center text-[#ef4444] animate-pulse">
                <RefreshCw size={32} className="animate-spin duration-3000" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold tracking-tight text-white uppercase">
                  Actualización Requerida
                </h3>
                <p className="text-xs text-primary font-bold uppercase tracking-[0.2em]">
                  Control de Versión PSCQUBE
                </p>
              </div>

              <div className="bg-white/5 p-4 rounded-xl text-left w-full space-y-3 border border-white/5">
                <p className="text-xs text-[#a0a5b5] leading-relaxed">
                  Para evitar consultas inconsistentes en segundo plano y optimizar el consumo de recursos de base de datos, las pestañas antiguas del navegador se bloquean automáticamente.
                </p>
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <div className="flex items-center space-x-2 text-[11px] text-green-400 font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                    <span>✓ Sesión de base de datos preservada</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-green-400 font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                    <span>✓ Caché local invalidada</span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-primary font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span>⌛ Listo para reiniciar versión</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  try {
                    clearClientCache();
                    localStorage.removeItem("pscqube_app_version");
                  } catch (e) {}
                  window.location.reload();
                }}
                className="w-full bg-[#ef4444] hover:bg-[#ef4444]/80 text-white py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-98"
              >
                Actualizar Ahora
              </button>
              
              <p className="text-[10px] text-[#a0a5b5] uppercase tracking-widest">
                La aplicación se recargará automáticamente en breve
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-md w-full bg-[#1c1d24]/60 border border-white/10 p-10 rounded-2xl shadow-2xl flex flex-col items-center space-y-6">
              {/* Spinning Circle */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black tracking-tight text-white uppercase logo-glow">
                  PSCQUBE
                </h3>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.25em]">
                  Sincronizando Base de Datos
                </p>
              </div>

              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full animate-[pulse_2s_infinite] w-full" />
              </div>

              <p className="text-xs text-text-muted font-black uppercase tracking-widest leading-relaxed">
                {syncMessage}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!hasEnteredApp ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            <WelcomeScreen 
              onEnter={()  => handleSyncOnEnter()} 
              onLoginSuccess={(user, email) => {
                sessionStorage.setItem('pscqube_user_dni', user.dni);
                sessionStorage.setItem('pscqube_user', JSON.stringify(user));
                sessionStorage.setItem('pscqube_google_email', email);
                handleSyncOnEnter(user.dni);
              }}
              addToast={addToast}
            />
          </motion.div>
        ) : (
        <motion.div 
          key="app-main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen relative pb-32 bg-bg text-text-main transition-colors duration-300"
        >
          <Header 
            palletizers={masters.palletizers}
            selectedId={userContext.selectedPalletizerId}
            onSelect={id => setUserContext({...userContext, selectedPalletizerId: id})}
            shifts={masters.shifts}
            selectedShiftId={userContext.selectedShiftId}
            onShiftSelect={id => setUserContext({...userContext, selectedShiftId: id})}
            selectedDate={userContext.selectedDate}
            onDateChange={date => setUserContext({...userContext, selectedDate: date})}
            isDark={isDark}
            toggleTheme={() => setIsDark(!isDark)}
            currentUser={currentUser}
            notifications={notifications}
            readNotificationKeys={readNotificationKeys}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onNavigateToChange={() => {
              setActiveSection('PRODUCTIVITY');
              setProdTab('CHANGE');
            }}
            onRefreshCurrentFilters={handleRefreshCurrentFilters}
            activeSection={activeSection}
          />

          <main className="p-4 md:p-8 max-w-7xl mx-auto pt-4 md:pt-8">
            <AnimatePresence mode="wait">
              {activeSection === 'PRODUCTIVITY' && (
                <motion.div 
                  key="productivity" 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4 md:space-y-6"
                >
                  {/* Sub-nav Productivity - Menú Desplegable desde Header */}
                  <div className="sticky top-16 z-30 bg-bg/80 backdrop-blur-md pt-2 pb-2 mb-6 border-b border-border/40">
                    {(() => {
                      const visibleTabs = productivityTabs.filter(t => canView(t.id));
                      const currentTabObj = visibleTabs.find(t => t.id === prodTab) || visibleTabs[0];

                      return (
                        <div className="relative max-w-7xl mx-auto px-1">
                          {/* Selector Bar Header */}
                          <div className={cn(
                            "flex items-center justify-between gap-3 p-3 px-4 rounded-2xl transition-all border shadow-lg ring-1",
                            isDark 
                              ? "bg-[#1E293B] border-slate-600/80 ring-white/10 shadow-black/50" 
                              : "bg-white border-slate-200/90 ring-black/5 shadow-slate-200/50"
                          )}>
                            <button
                              type="button"
                              onClick={() => setIsProdMenuOpen(!isProdMenuOpen)}
                              className="flex items-center gap-3 text-left flex-1 min-w-0 hover:opacity-90 transition-opacity focus:outline-none group"
                            >
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors shadow-xs",
                                isDark 
                                  ? "bg-primary/30 text-blue-300 border-primary/40 group-hover:bg-primary group-hover:text-white" 
                                  : "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white"
                              )}>
                                {currentTabObj?.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest",
                                    isDark ? "text-slate-300" : "text-slate-500"
                                  )}>
                                    Funcionalidad Activa
                                  </span>
                                  <span className={cn(
                                    "text-[9px] px-2 py-0.5 rounded-full font-black border",
                                    isDark ? "bg-primary/30 text-blue-200 border-primary/40" : "bg-primary/10 text-primary border-primary/20"
                                  )}>
                                    {visibleTabs.length} disponibles
                                  </span>
                                </div>
                                <p className={cn(
                                  "text-sm font-black truncate flex items-center gap-1.5",
                                  isDark ? "text-white" : "text-slate-900"
                                )}>
                                  {currentTabObj?.label}
                                </p>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsProdMenuOpen(!isProdMenuOpen)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border shadow-sm shrink-0",
                                isProdMenuOpen
                                  ? "bg-primary text-white border-primary shadow-primary/30 ring-2 ring-primary/40"
                                  : isDark
                                    ? "bg-slate-700/90 hover:bg-slate-600 text-white border-slate-500/80 hover:border-blue-400"
                                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 hover:border-primary/50"
                              )}
                            >
                              <LayoutGrid size={15} />
                              <span className="hidden sm:inline">Ver Menú</span>
                              <ChevronDown
                                size={15}
                                className={cn("transition-transform duration-200", isProdMenuOpen && "rotate-180")}
                              />
                            </button>
                          </div>

                          {/* Dropdown Menu Panel */}
                          <AnimatePresence>
                            {isProdMenuOpen && (
                              <>
                                {/* Overlay backdrop for closing on outside click */}
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={() => setIsProdMenuOpen(false)}
                                />

                                <motion.div
                                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                                  transition={{ duration: 0.15 }}
                                  className={cn(
                                    "absolute top-full left-0 right-0 mt-2.5 z-40 rounded-2xl shadow-2xl overflow-hidden p-3.5 md:p-5 max-h-[75vh] overflow-y-auto border backdrop-blur-xl transition-all",
                                    isDark
                                      ? "bg-[#141C2A]/95 border-slate-700/90 shadow-black/60"
                                      : "bg-white/95 border-slate-200 shadow-xl shadow-slate-300/40"
                                  )}
                                >
                                  <div className={cn(
                                    "flex items-center justify-between pb-3 mb-3.5 border-b px-1",
                                    isDark ? "border-slate-700/60" : "border-slate-200"
                                  )}>
                                    <div className="flex items-center gap-2.5">
                                      <div className={cn(
                                        "p-2 rounded-xl border",
                                        isDark ? "bg-primary/20 text-blue-400 border-primary/30" : "bg-primary/10 text-primary border-primary/20"
                                      )}>
                                        <LayoutGrid size={16} />
                                      </div>
                                      <div>
                                        <h4 className={cn(
                                          "text-xs font-extrabold uppercase tracking-wider",
                                          isDark ? "text-white" : "text-slate-900"
                                        )}>
                                          Funcionalidades de Productividad
                                        </h4>
                                        <p className={cn(
                                          "text-[11px]",
                                          isDark ? "text-slate-400" : "text-slate-500"
                                        )}>
                                          Selecciona el módulo al que deseas ingresar
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setIsProdMenuOpen(false)}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-colors border",
                                        isDark 
                                          ? "hover:bg-slate-800 text-slate-400 hover:text-white border-transparent hover:border-slate-700" 
                                          : "hover:bg-slate-100 text-slate-500 hover:text-slate-900 border-transparent hover:border-slate-200"
                                      )}
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                    {visibleTabs.map(tab => {
                                      const isActive = prodTab === tab.id;
                                      return (
                                        <button
                                          key={tab.id}
                                          type="button"
                                          onClick={() => {
                                            setProdTab(tab.id as ProductivityTab);
                                            setIsProdMenuOpen(false);
                                          }}
                                          className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border text-left transition-all relative group cursor-pointer",
                                            isActive
                                              ? "bg-primary text-white border-primary shadow-md shadow-primary/20 font-bold"
                                              : isDark
                                                ? "bg-slate-800/60 hover:bg-slate-800/90 border-slate-700/60 text-slate-100 hover:border-primary/60 hover:shadow-md hover:shadow-black/20"
                                                : "bg-slate-50 hover:bg-white border-slate-200/80 text-slate-800 hover:border-primary/60 hover:shadow-md hover:shadow-slate-200/80"
                                          )}
                                        >
                                          <div
                                            className={cn(
                                              "w-8.5 h-8.5 rounded-lg flex items-center justify-center shrink-0 transition-colors border",
                                              isActive
                                                ? "bg-white/20 text-white border-white/20"
                                                : isDark
                                                  ? "bg-primary/20 text-blue-400 border-primary/30 group-hover:bg-primary group-hover:text-white group-hover:border-primary"
                                                  : "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white group-hover:border-primary"
                                            )}
                                          >
                                            {tab.icon}
                                          </div>
                                          <div className="min-w-0 flex-1 pr-4">
                                            <span className={cn(
                                              "text-xs font-bold block truncate",
                                              isActive
                                                ? "text-white"
                                                : isDark
                                                  ? "text-slate-100 group-hover:text-white"
                                                  : "text-slate-800 group-hover:text-primary"
                                            )}>
                                              {tab.label}
                                            </span>
                                          </div>
                                          {isActive && (
                                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white text-primary flex items-center justify-center">
                                              <Check size={11} strokeWidth={3} />
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}
                  </div>

                  {prodTab === 'DASHBOARD' && (
                    <DashboardView 
                        masters={masters}
                        selectedShift={selectedShift}
                        selectedDate={userContext.selectedDate}
                        onTabChange={tab => setProdTab(tab)} 
                        stops={stops.filter(s => s && s.date === userContext.selectedDate && isStopForShift(s, userContext.selectedShiftId, masters))}
                        productionReports={productionReports.filter(r => r.shiftId === userContext.selectedShiftId && r.date === userContext.selectedDate)}
                        inventoryEntries={inventoryEntries.filter(e => e.date === userContext.selectedDate)}
                        dispatchEntries={dispatchEntries.filter(d => d.shiftId === userContext.selectedShiftId && d.date === userContext.selectedDate)}
                        laneStatuses={laneStatuses.filter(l => l.shiftId === userContext.selectedShiftId && l.date === userContext.selectedDate)}
                        allProductionReports={productionReports.filter(r => r.date === userContext.selectedDate)}
                        allDispatchEntries={dispatchEntries.filter(d => d.date === userContext.selectedDate)}
                    />
                  )}
                  {prodTab === 'DESPACHOS' && (
                    <DespachosView 
                      masters={masters}
                      currentUser={currentUser}
                      history={(dispatchEntries || []).filter(d => d && d.date === userContext.selectedDate)}
                      onSave={handleSaveDispatch}
                      onDelete={handleDeleteDispatch}
                      selectedShiftId={userContext.selectedShiftId}
                      selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'REPORTS' && (
                    <ReportsView 
                        masters={masters} 
                        currentUser={currentUser}
                        userContext={userContext}
                    />
                  )}
                  {prodTab === 'PAROS' && (
                    <StopsView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={handleSaveStop}
                        onDelete={handleDeleteStop}
                        onSaveMultiple={handleSaveMultipleStops}
                        palletizerId={userContext.selectedPalletizerId} 
                        shiftId={userContext.selectedShiftId} 
                        selectedDate={userContext.selectedDate}
                        history={stops.filter(s => s && s.date === userContext.selectedDate && isStopForMachine(s, userContext.selectedPalletizerId, masters) && isStopForShift(s, userContext.selectedShiftId, masters))}
                        allStops={stops}
                    />
                  )}
                  {prodTab === 'PRODUCCION' && (
                    <ProductionView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={handleSaveProductionReport}
                        onDelete={handleDeleteProductionReport}
                        palletizerId={userContext.selectedPalletizerId} 
                        shiftId={userContext.selectedShiftId} 
                        selectedDate={userContext.selectedDate}
                        history={productionReports.filter(r => r && String(r.palletizerId || '').trim().toUpperCase() === String(userContext.selectedPalletizerId || '').trim().toUpperCase() && String(r.shiftId || '').trim().toUpperCase() === String(userContext.selectedShiftId || '').trim().toUpperCase() && r.date === userContext.selectedDate)}
                        stops={stops}
                      />
                  )}
                  {prodTab === 'DATER' && (
                    <DaterControlView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={handleSaveDaterControl}
                        onDelete={handleDeleteDaterControl}
                        history={daterControls}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'SCALE' && (
                    <ScaleControlView 
                        masters={masters} 
                        currentUser={currentUser}
                        onSave={handleSaveScaleControl}
                        onDelete={handleDeleteScaleControl}
                        history={scaleControls}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'STOCK' && (
                    <InventoryView 
                        masters={masters} 
                        currentUser={currentUser}
                        entries={inventoryEntries}
                        productionReports={productionReports}
                        onSave={handleSaveInventory}
                        onDelete={handleDeleteInventory}
                        onBulkUpdate={handleBulkUpdateInventory}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'PALLET_CLASS' && (
                    <PalletClassificationView 
                        masters={masters} 
                        currentUser={currentUser}
                        entries={palletClassifications.filter(e => e.shiftId === userContext.selectedShiftId && e.date === userContext.selectedDate)}
                        allEntries={palletClassifications}
                        onSave={handleSavePalletClass}
                        onDelete={handleDeletePalletClass}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                        isDark={isDark}
                    />
                  )}
                  {prodTab === 'CHANGE' && (
                    <ProductChangeView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={productChanges}
                        onSave={handleSaveProductChange}
                        onDelete={handleDeleteProductChange}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'LOADING_LANES' && (
                    <LoadingLanesView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={laneStatuses.filter(l => l.shiftId === userContext.selectedShiftId && l.date === userContext.selectedDate)}
                        onSave={handleSaveLaneStatus}
                        onDelete={handleDeleteLaneStatus}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                    />
                  )}
                  {prodTab === 'GASOIL' && (
                    <FuelView 
                        masters={masters} 
                        currentUser={currentUser}
                        history={fuelLoads.filter(f => (!f.shiftId || f.shiftId === userContext.selectedShiftId) && f.date === userContext.selectedDate)}
                        allFuelLoads={fuelLoads}
                        onSave={handleSaveFuelLoad}
                        onDelete={handleDeleteFuelLoad}
                        selectedShiftId={userContext.selectedShiftId}
                        selectedDate={userContext.selectedDate}
                        isDark={isDark}
                    />
                  )}
                  {prodTab === 'MANTENIMIENTO' && (
                    <PlaceholderView title="Módulo: MANTENIMIENTO" type="PRODUCTIVITY" />
                  )}
                </motion.div>
              )}

              {activeSection === 'SAFETY' && <PlaceholderView title="H&S" type="SAFETY" />}
              {activeSection === 'ENVIRONMENT' && <PlaceholderView title="Medio Ambiente" type="ENVIRONMENT" />}
              {activeSection === 'HR' && <PlaceholderView title="Capital Humano" type="HR" />}
              
              {activeSection === 'ADMIN' && (
                <AdminView 
                    masters={masters} 
                    currentUser={currentUser}
                    activeTab={adminTab} 
                    onTabChange={setAdminTab} 
                    onUserSwitch={dni => setUserContext({...userContext, currentUserDni: dni})}
                    onUpdateMasters={(type, data) => {
                      safeCache.remove('pscqube_maestros_cache');
                      let targetData = data;
                      if (type === 'SHIFTS') setShifts(data as Shift[]);
                      if (type === 'MACHINES') setPalletizers(data);
                      if (type === 'BAGGERS') setBaggers(data);
                      if (type === 'HACS') setHacs(data);
                      if (type === 'CAUSES') setCauses(data);
                      if (type === 'MATERIALS') setMaterials(data);
                      if (type === 'CAPACITIES') setCapacities(data);
                      if (type === 'USERS') {
                        const cleaned = (data as any[]).map(u => {
                          let perms = u.permissions || u.permisos;
                          if (typeof perms === 'string' && perms.trim() !== '') {
                            try {
                              perms = JSON.parse(perms);
                            } catch {
                              perms = [];
                            }
                          }
                          if (!Array.isArray(perms) || perms.length === 0) {
                            const level = u.profile === 'Administrador' ? 'EDIT' : 'VIEW';
                            perms = SYSTEM_VIEWS.map(v => ({
                              viewId: v.id,
                              label: v.label,
                              section: v.section,
                              level: level
                            }));
                          }
                          return {
                            ...u,
                            permissions: perms
                          };
                        });
                        const sorted = cleaned.sort((a, b) => 
                          String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" })
                        );
                        setUsers(sorted);
                        targetData = sorted;
                      }
                      if (type === 'COMPANIES') setCompanies(data as Company[]);
                      if (type === 'PUNTOS_CARGA') setLoadingPoints(data);
                      if (type === 'BAG_SUPPLIERS' || type === 'PROVEEDORES_BOLSA') setBagSuppliers(data);
                      if (type === 'VEHICULOS' || type === 'VEHICULES') setVehicles(data);
                      if (type === 'CONTROLES_BALANZAS' || type === 'PARAMETROS_BALANZA') setScaleParameters(data);

                      // Sincronización automática en tiempo real con Google Sheets
                      const cleanType = String(type).toUpperCase().trim();
                      const tabSuffixMapping: Record<string, string> = {
                        SHIFTS: "TURNOSV2",
                        MACHINES: "PALETIZADORAV2",
                        BAGGERS: "ENSACADORAV2",
                        HACS: "HACSV2",
                        CAUSES: "CAUSASV2",
                        MATERIALS: "MATERIALESV2",
                        CAPACITIES: "CAPACIDADESV2",
                        USERS: "USUARIOSV2",
                        COMPANIES: "EMPRESASV2",
                        PUNTOS_CARGA: "PUNTOS_CARGAV2",
                        LOADING_POINTS: "PUNTOS_CARGAV2",
                        BAG_SUPPLIERS: "PROVEEDORES_BOLSAV2",
                        PROVEEDORES_BOLSA: "PROVEEDORES_BOLSAV2",
                        VEHICULOS: "VEHICULOSV2",
                        VEHICLES: "VEHICULOSV2",
                        CONTROLES_BALANZAS: "PARAMETROS_BALANZAV2",
                        PARAMETROS_BALANZA: "PARAMETROS_BALANZAV2"
                      };
                      const suffix = tabSuffixMapping[cleanType];
                      
                      console.log(`[AutoSync] onUpdateMasters invocado. Tipo original: "${type}", Tipo limpio: "${cleanType}", Suffix: "${suffix || 'No encontrado'}"`, targetData);

                      if (suffix) {
                        syncTableToSheets(suffix, targetData)
                          .then(res => {
                            if (res.success) {
                              addToast(`Maestro ${cleanType} guardado y sincronizado con éxito`, "success");
                              console.log(`[AutoSync] Sincronización automática de ${suffix} exitosa en Google Sheets.`);
                            } else {
                              addToast(`Maestro guardado localmente (error sync: ${res.error})`, "warning");
                              console.warn(`[AutoSync] Falló la sincronización de ${suffix}:`, res.error);
                            }
                          })
                          .catch(err => {
                            addToast(`Maestro guardado localmente. Error de conexión.`, "warning");
                            console.error(`[AutoSync] Error crítico de red al sincronizar ${suffix}:`, err);
                          });
                      } else {
                        console.warn(`[AutoSync] No se encontró mapeo de sufijo para tabla: "${type}"`);
                      }
                    }}
                    addToast={addToast}
                />
              )}
            </AnimatePresence>
          </main>

          <BottomNav 
            activeSection={activeSection} 
            onSectionChange={setActiveSection} 
            currentUser={currentUser}
            onLogout={() => setIsLogoutConfirmOpen(true)}
            isDark={isDark}
          />
          
          {/* Toast Notification Container */}
          <ToastContainer toasts={toasts} onClose={id => setToasts(prev => prev.filter(t => t.id !== id))} />

          {/* Confirmar Cierre de Sesión Modal */}
          <ConfirmModal
            isOpen={isLogoutConfirmOpen}
            onClose={() => setIsLogoutConfirmOpen(false)}
            onConfirm={async () => {
              try {
                const supabase = await getSupabaseClient();
                if (supabase) {
                  await supabase.auth.signOut();
                }
              } catch (e) {
                console.warn("[Logout Supabase SignOut Warning]", e);
              }
              sessionStorage.clear();
              await safeCache.remove('pscqube_maestros_cache');
              safeCache.purgeLegacyLocalStorage();
              window.location.reload();
            }}
            title="Cerrar Sesión"
            message="¿Está seguro de que desea cerrar su sesión y salir de la aplicación?"
            confirmLabel="Cerrar Sesión"
            cancelLabel="Cancelar"
          />
        </motion.div>
      )}
    </AnimatePresence>
   </>
  );
}

function ProductivitySubTab({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      data-active={active}
      className={cn(
        "carousel-tab px-4 py-1.5 rounded-md flex items-center gap-2 transition-all flex-none text-[10px] font-bold uppercase tracking-widest whitespace-nowrap min-w-fit",
        active 
          ? "btn-active-highlight" 
          : "text-text-muted hover:text-text-main hover:bg-bg"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Update PlaceholderView to handle PRODUCTIVITY type
// (I will add it in a minute if needed, but let's keep it simple for now)
