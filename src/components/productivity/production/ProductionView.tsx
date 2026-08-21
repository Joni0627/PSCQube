import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, Trash2, History, Pencil, TrendingUp, Filter, BarChart3, Clock, AlertCircle, ShieldCheck, Check, X, CheckCircle2, AlertTriangle, XCircle, Calendar, User, ChevronDown, MessageSquare } from 'lucide-react';
import { format, parse, differenceInMinutes } from 'date-fns';
import { GlassCard, GlassInput, GlassSelect, GlassButton, ConfirmModal, Modal } from '../../ui/GlassUI';
import { DataTable, Column, TableActions } from '../../ui/DataTable';
import { MasterData, ProductionReport, NozzleNews, AppUser, MachineStop } from '../../../types';
import { cn } from '../../../lib/utils';

// Helper function to check if stop is for shift
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
  if (sName && (stopShiftName === sName || stopShiftId === sName)) return true;
  
  return false;
};

// Helper function to check if stop is for machine
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

interface Props {
  masters: MasterData;
  currentUser: AppUser;
  onSave: (report: any) => void;
  onDelete: (id: string) => void;
  palletizerId: string | null;
  shiftId: string | null;
  selectedDate: string;
  history: ProductionReport[];
  stops: MachineStop[];
}

export default function ProductionView({ masters, currentUser, onSave, onDelete, palletizerId, shiftId, selectedDate, history, stops }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionReport | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isNozzleModalOpen, setIsNozzleModalOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({ main: true });

  const toggleCard = (id: string) => {
    setExpandedCards(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };
  const canEdit = useMemo(() => {
    if (currentUser?.profile === 'Administrador') return true;
    const perm = currentUser?.permissions?.find(p => p.viewId === 'PRODUCCION');
    return perm ? perm.level === 'EDIT' : false;
  }, [currentUser]);
  
  // Local form state
  const [formData, setFormData] = useState({ 
    baggerId: '', 
    materialId: '', 
    bags: '',
    tons: '',
    availableNozzlesShift: '',
    bagProvider: '',
    discardedBagsBagger: '',
    notNozzledBags: '',
    discardedBagsVentocheck: '',
    discardedBagsTransport: '',
    nozzleNews: [] as NozzleNews[],
    hsMarchaTis: '',
    materialsDetails: [] as any[]
  });

  // Local state for the material being entered
  const [activeDetail, setActiveDetail] = useState({
    materialId: '',
    bags: '',
    tons: '',
    bagProvider: '',
    discardedBagsBagger: '0',
    notNozzledBags: '0',
    discardedBagsVentocheck: '0',
    discardedBagsTransport: '0',
    observacion: ''
  });
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);

  // Local state for adding nozzle news
  const [tempNews, setTempNews] = useState({
    nozzleNumber: '',
    startTime: '',
    endTime: '',
    isAllShift: false,
    observation: ''
  });
  const [editingNozzleId, setEditingNozzleId] = useState<string | null>(null);

  const selectedShiftObj = useMemo(() => 
    masters.shifts.find(s => s.id === shiftId), 
    [masters.shifts, shiftId]
  );

  const selectedBaggerObj = useMemo(() => 
    masters.baggers.find(b => b.id === formData.baggerId),
    [masters.baggers, formData.baggerId]
  );

  const selectedMaterialObj = useMemo(() => 
    masters.materials.find(m => m.id === formData.materialId),
    [masters.materials, formData.materialId]
  );

  const activeMaterialObj = useMemo(() => 
    masters.materials.find(m => m.id === activeDetail.materialId),
    [masters.materials, activeDetail.materialId]
  );

  const availableMaterialsOptions = useMemo(() => {
    const list = masters.materials.filter((m: any) => !!m.isProductive);
    const filtered = list.filter((m: any) => {
      const isAlreadyAdded = (formData.materialsDetails || []).some(
        (d: any) => d.materialId === m.id && d.id !== editingDetailId
      );
      return !isAlreadyAdded;
    });
    return filtered.map((m: any) => ({ label: m.name, value: m.id }));
  }, [masters.materials, formData.materialsDetails, editingDetailId]);

  const modalTotals = useMemo(() => {
    const details = formData.materialsDetails || [];
    const totalBags = details.reduce((sum, d) => sum + (Number(d.bagsProduced) || 0), 0);
    const totalTons = details.reduce((sum, d) => sum + (Number(d.tonsProduced) || 0), 0);
    return { totalBags, totalTons };
  }, [formData.materialsDetails]);

  // Auto-calculate TN based on Bags and Material weight for fallback
  React.useEffect(() => {
    if (selectedMaterialObj && formData.bags) {
      const bags = parseFloat(formData.bags) || 0;
      const weightPerBagKg = selectedMaterialObj.bagWeight || 0;
      const calculatedTons = (bags * weightPerBagKg) / 1000;
      setFormData(prev => ({ ...prev, tons: calculatedTons.toString() }));
    } else {
      setFormData(prev => ({ ...prev, tons: '' }));
    }
  }, [formData.bags, formData.materialId, selectedMaterialObj]);

  // Auto-calculate TN for the active detail item
  React.useEffect(() => {
    if (activeMaterialObj && activeDetail.bags) {
      const bags = parseFloat(activeDetail.bags) || 0;
      const weightPerBagKg = activeMaterialObj.bagWeight || 0;
      const calculatedTons = (bags * weightPerBagKg) / 1000;
      setActiveDetail(prev => ({ ...prev, tons: calculatedTons.toString() }));
    } else {
      setActiveDetail(prev => ({ ...prev, tons: '' }));
    }
  }, [activeDetail.bags, activeDetail.materialId, activeMaterialObj]);

  const addMaterialDetail = () => {
    if (!activeDetail.materialId || !activeDetail.bags) {
      alert("Por favor selecciona un material e ingresa el total de bolsas.");
      return;
    }

    const matObj = masters.materials.find(m => m.id === activeDetail.materialId);
    if (!matObj) return;

    if (editingDetailId) {
      // Edit mode: replace/update in state
      setFormData(prev => ({
        ...prev,
        materialsDetails: (prev.materialsDetails || []).map(d => 
          d.id === editingDetailId 
            ? {
                ...d,
                materialId: activeDetail.materialId,
                materialDescription: matObj.name,
                bagsProduced: parseInt(activeDetail.bags) || 0,
                tonsProduced: parseFloat(activeDetail.tons) || 0,
                bagProvider: activeDetail.bagProvider,
                discardedBagsBagger: parseInt(activeDetail.discardedBagsBagger) || 0,
                notNozzledBags: parseInt(activeDetail.notNozzledBags) || 0,
                discardedBagsVentocheck: parseInt(activeDetail.discardedBagsVentocheck) || 0,
                discardedBagsTransport: parseInt(activeDetail.discardedBagsTransport) || 0,
                observacion: activeDetail.observacion
              }
            : d
        )
      }));
      setEditingDetailId(null);
    } else {
      // Add mode
      const newDetail = {
        id: Math.random().toString(36).substr(2, 9),
        materialId: activeDetail.materialId,
        materialDescription: matObj.name,
        bagsProduced: parseInt(activeDetail.bags) || 0,
        tonsProduced: parseFloat(activeDetail.tons) || 0,
        bdp: 100,
        bagProvider: activeDetail.bagProvider || formData.bagProvider,
        discardedBagsBagger: parseInt(activeDetail.discardedBagsBagger) || 0,
        notNozzledBags: parseInt(activeDetail.notNozzledBags) || 0,
        discardedBagsVentocheck: parseInt(activeDetail.discardedBagsVentocheck) || 0,
        discardedBagsTransport: parseInt(activeDetail.discardedBagsTransport) || 0,
        observacion: activeDetail.observacion
      };

      setFormData(prev => ({
        ...prev,
        materialsDetails: [...(prev.materialsDetails || []), newDetail]
      }));
    }

    // Reset inputs but preserve the provider to make it faster
    setActiveDetail(prev => ({
      materialId: '',
      bags: '',
      tons: '',
      bagProvider: prev.bagProvider,
      discardedBagsBagger: '0',
      notNozzledBags: '0',
      discardedBagsVentocheck: '0',
      discardedBagsTransport: '0',
      observacion: ''
    }));
  };

  const removeMaterialDetail = (id: string) => {
    if (editingDetailId === id) {
      setEditingDetailId(null);
      setActiveDetail({
        materialId: '',
        bags: '',
        tons: '',
        bagProvider: masters.bagSuppliers && masters.bagSuppliers.length > 0 ? masters.bagSuppliers[0].nombre : '',
        discardedBagsBagger: '0',
        notNozzledBags: '0',
        discardedBagsVentocheck: '0',
        discardedBagsTransport: '0',
        observacion: ''
      });
    }
    setFormData(prev => ({
      ...prev,
      materialsDetails: (prev.materialsDetails || []).filter(d => d.id !== id)
    }));
  };

  const startEditMaterialDetail = (det: any) => {
    setEditingDetailId(det.id);
    setActiveDetail({
      materialId: det.materialId || '',
      bags: (det.bagsProduced || '').toString(),
      tons: (det.tonsProduced || '').toString(),
      bagProvider: det.bagProvider || (masters.bagSuppliers && masters.bagSuppliers.length > 0 ? masters.bagSuppliers[0].nombre : ''),
      discardedBagsBagger: (det.discardedBagsBagger || 0).toString(),
      notNozzledBags: (det.notNozzledBags || 0).toString(),
      discardedBagsVentocheck: (det.discardedBagsVentocheck || 0).toString(),
      discardedBagsTransport: (det.discardedBagsTransport || 0).toString(),
      observacion: det.observacion || ''
    });
  };

  // Calculate active running hours (hs de marcha) computed by the app
  const hsCalculatedByApp = useMemo(() => {
    if (!palletizerId || !shiftId) return 0;
    const selectedShift = masters.shifts.find(s => s.id === shiftId);
    if (!selectedShift) return 0;

    const machineStops = stops.filter(s => 
      s &&
      s.date === selectedDate &&
      isStopForMachine(s, palletizerId, masters) &&
      isStopForShift(s, shiftId, masters)
    );

    const hsShift = selectedShift.durationHours;
    const totalStopMinutes = machineStops.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
    const totalStopHours = totalStopMinutes / 60;
    
    return Math.max(0, hsShift - totalStopHours);
  }, [palletizerId, shiftId, selectedDate, stops, masters]);

  // Get the TIS hours for this shift if registered in any of the reports in history
  const shiftTisHours = useMemo(() => {
    const reportWithTis = history.find(r => r.hsMarchaTis !== undefined && r.hsMarchaTis !== null && r.hsMarchaTis !== 0);
    return reportWithTis ? reportWithTis.hsMarchaTis : null;
  }, [history]);

  // Determine if the TIS input should be shown in the form
  const showTisInput = useMemo(() => {
    // If the current editing item has its own hsMarchaTis, we show it so they can edit it.
    if (editingItem && editingItem.hsMarchaTis !== undefined && editingItem.hsMarchaTis !== null && editingItem.hsMarchaTis !== 0) {
      return true;
    }
    // Otherwise, if any other record in history already has a TIS value registered, we hide the input.
    const hasOtherTis = history.some(r => 
      r.hsMarchaTis !== undefined && 
      r.hsMarchaTis !== null && 
      r.hsMarchaTis !== 0 && 
      (!editingItem || r.id !== editingItem.id)
    );
    return !hasOtherTis;
  }, [history, editingItem]);

  // Use the local input value if present, otherwise fallback to the shift's existing TIS hours
  const effectiveTisValue = useMemo(() => {
    if (formData.hsMarchaTis) return formData.hsMarchaTis;
    return shiftTisHours !== null ? shiftTisHours.toString() : '';
  }, [formData.hsMarchaTis, shiftTisHours]);

  // Calculate Global Summary (Automated)
  const totals = useMemo(() => {
    const totalTons = history.reduce((sum, r) => sum + (Number(r.tonsProduced) || 0), 0);
    const totalBags = history.reduce((sum, r) => sum + (Number(r.bagsProduced) || 0), 0);
    const count = history.length;
    return { totalTons, totalBags, count };
  }, [history]);

  // Calculate Line KPIs (Rendimiento, Disponibilidad, OEE, Hs Marcha)
  const lineKpis = useMemo(() => {
    const selectedShift = masters.shifts.find(s => s.id === shiftId);
    const hsShift = selectedShift?.durationHours || 8;
    const hsMarcha = hsCalculatedByApp;
    
    // Availability %
    const availabilityPct = hsShift > 0 ? Math.min(100, Math.max(0, (hsMarcha / hsShift) * 100)) : 100;

    // Average Nozzle availability from reports or default
    const nozzleAvailabilities = history.map(r => parseFloat(r.nozzleAvailability || '100')).filter(n => !isNaN(n));
    const avgNozzleAvail = nozzleAvailabilities.length > 0
      ? nozzleAvailabilities.reduce((a, b) => a + b, 0) / nozzleAvailabilities.length
      : 100;

    // Performance % based on nozzle availability and production status
    const performancePct = totals.totalTons > 0 ? Math.min(100, Math.max(70, avgNozzleAvail)) : 0;

    // OEE % = (Availability * Performance) / 100
    const oeePct = Math.round((availabilityPct * (performancePct || 100)) / 100);

    return {
      hsMarcha,
      availability: Math.round(availabilityPct),
      performance: Math.round(performancePct),
      oee: totals.totalTons > 0 ? oeePct : 0
    };
  }, [hsCalculatedByApp, shiftId, masters.shifts, history, totals.totalTons]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setEditingDetailId(null);
    const defaultBagProvider = masters.bagSuppliers && masters.bagSuppliers.length > 0
      ? masters.bagSuppliers[0].nombre
      : '';
    setFormData({ 
      baggerId: '', 
      materialId: '', 
      bags: '',
      tons: '',
      availableNozzlesShift: '',
      bagProvider: defaultBagProvider,
      discardedBagsBagger: '0',
      notNozzledBags: '0',
      discardedBagsVentocheck: '0',
      discardedBagsTransport: '0',
      nozzleNews: [],
      hsMarchaTis: '',
      materialsDetails: []
    });
    setActiveDetail({
      materialId: '',
      bags: '',
      tons: '',
      bagProvider: defaultBagProvider,
      discardedBagsBagger: '0',
      notNozzledBags: '0',
      discardedBagsVentocheck: '0',
      discardedBagsTransport: '0',
      observacion: ''
    });
    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setEditingNozzleId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ProductionReport) => {
    setEditingItem(item);
    setEditingDetailId(null);
    const defaultBagProvider = item.bagProvider || (masters.bagSuppliers && masters.bagSuppliers.length > 0 ? masters.bagSuppliers[0].nombre : '');
    
    // Auto-create migration details array if not present
    const initialDetails = [...(item.materialsDetails || [])];
    if (initialDetails.length === 0 && item.materialId) {
      initialDetails.push({
        id: Math.random().toString(36).substr(2, 9),
        materialId: item.materialId,
        materialDescription: masters.materials.find(m => m.id === item.materialId)?.name || '',
        bagsProduced: item.bagsProduced || 0,
        tonsProduced: item.tonsProduced || 0,
        bdp: item.bdp || 100,
        discardedBagsBagger: item.discardedBagsBagger || 0,
        notNozzledBags: item.notNozzledBags || 0,
        discardedBagsVentocheck: item.discardedBagsVentocheck || 0,
        discardedBagsTransport: item.discardedBagsTransport || 0
      });
    }

    setFormData({ 
      baggerId: item.baggerId, 
      materialId: item.materialId || (initialDetails[0]?.materialId || ''), 
      bags: item.bagsProduced?.toString() || '',
      tons: item.tonsProduced?.toString() || '',
      availableNozzlesShift: item.availableNozzlesShift?.toString() || '',
      bagProvider: defaultBagProvider,
      discardedBagsBagger: item.discardedBagsBagger?.toString() || '0',
      notNozzledBags: item.notNozzledBags?.toString() || '0',
      discardedBagsVentocheck: item.discardedBagsVentocheck?.toString() || '0',
      discardedBagsTransport: item.discardedBagsTransport?.toString() || '0',
      nozzleNews: item.nozzleNews || [],
      hsMarchaTis: item.hsMarchaTis?.toString() || '',
      materialsDetails: initialDetails
    });
    setActiveDetail({
      materialId: '',
      bags: '',
      tons: '',
      bagProvider: defaultBagProvider,
      discardedBagsBagger: '0',
      notNozzledBags: '0',
      discardedBagsVentocheck: '0',
      discardedBagsTransport: '0',
      observacion: ''
    });
    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setEditingNozzleId(null);
    setIsModalOpen(true);
  };

  const handleEditNozzleNews = (news: NozzleNews) => {
    setEditingNozzleId(news.id);
    setTempNews({
      nozzleNumber: news.nozzleNumber.toString(),
      startTime: news.startTime || '',
      endTime: news.endTime || '',
      isAllShift: !!news.isAllShift,
      observation: news.observation || ''
    });
    setIsNozzleModalOpen(true);
  };

  const addNozzleNews = () => {
    if (!tempNews.nozzleNumber || (!tempNews.isAllShift && (!tempNews.startTime || !tempNews.endTime))) return;
    
    if (editingNozzleId) {
      setFormData(prev => ({
        ...prev,
        nozzleNews: prev.nozzleNews.map(n => 
          n.id === editingNozzleId 
            ? {
                ...n,
                nozzleNumber: parseInt(tempNews.nozzleNumber),
                startTime: tempNews.isAllShift ? (selectedShiftObj?.startTime || '') : tempNews.startTime,
                endTime: tempNews.isAllShift ? (selectedShiftObj?.endTime || '') : tempNews.endTime,
                isAllShift: tempNews.isAllShift,
                observation: tempNews.observation
              }
            : n
        )
      }));
    } else {
      const news: NozzleNews = {
        id: Math.random().toString(36).substr(2, 9),
        nozzleNumber: parseInt(tempNews.nozzleNumber),
        startTime: tempNews.isAllShift ? (selectedShiftObj?.startTime || '') : tempNews.startTime,
        endTime: tempNews.isAllShift ? (selectedShiftObj?.endTime || '') : tempNews.endTime,
        isAllShift: tempNews.isAllShift,
        observation: tempNews.observation
      };

      setFormData(prev => ({
        ...prev,
        nozzleNews: [...prev.nozzleNews, news]
      }));
    }

    setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
    setEditingNozzleId(null);
    setIsNozzleModalOpen(false);
  };

  const removeNozzleNews = (id: string) => {
    setFormData(prev => ({
      ...prev,
      nozzleNews: prev.nozzleNews.filter(n => n.id !== id)
    }));
    if (editingNozzleId === id) {
      setEditingNozzleId(null);
    }
  };

  const handleSave = () => {
    if (!formData.baggerId || !palletizerId || !shiftId) return;

    if (tempNews.nozzleNumber || tempNews.observation || tempNews.startTime || tempNews.endTime) {
      const confirmAdd = window.confirm(
        "¡Atención! Has ingresado datos en la sección de Novedad de Boquilla pero NO has presionado 'Añadir Novedad'.\n\n" +
        "¿Deseas agregar esta novedad automáticamente antes de guardar el reporte?"
      );
      if (confirmAdd) {
        const news: NozzleNews = {
          id: Math.random().toString(36).substr(2, 9),
          nozzleNumber: parseInt(tempNews.nozzleNumber) || 1,
          startTime: tempNews.isAllShift ? (selectedShiftObj?.startTime || '00:00') : (tempNews.startTime || '00:00'),
          endTime: tempNews.isAllShift ? (selectedShiftObj?.endTime || '23:59') : (tempNews.endTime || '23:59'),
          isAllShift: tempNews.isAllShift,
          observation: tempNews.observation
        };
        formData.nozzleNews.push(news);
        setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
      } else {
        const discard = window.confirm("¿Seguro que deseas guardar el reporte SIN registrar esta novedad de boquilla?");
        if (!discard) {
          return;
        }
      }
    }

    const activeDetailsList = [...(formData.materialsDetails || [])];
    if (activeDetail.materialId && activeDetail.bags) {
      const confirmAdd = window.confirm(
        "¡Atención! Has configurado datos de producción para un material pero NO has presionado '+ Registrar Material'.\n\n" +
        "¿Deseas agregar este material automáticamente antes de guardar el reporte?"
      );
      if (confirmAdd) {
        const matObj = masters.materials.find(m => m.id === activeDetail.materialId);
        if (matObj) {
          activeDetailsList.push({
            id: Math.random().toString(36).substr(2, 9),
            materialId: activeDetail.materialId,
            materialDescription: matObj.name,
            bagsProduced: parseInt(activeDetail.bags) || 0,
            tonsProduced: parseFloat(activeDetail.tons) || 0,
            bdp: 100,
            bagProvider: formData.bagProvider,
            discardedBagsBagger: parseInt(activeDetail.discardedBagsBagger) || 0,
            notNozzledBags: parseInt(activeDetail.notNozzledBags) || 0,
            discardedBagsVentocheck: parseInt(activeDetail.discardedBagsVentocheck) || 0,
            discardedBagsTransport: parseInt(activeDetail.discardedBagsTransport) || 0,
            observacion: activeDetail.observacion || ""
          });
        }
      } else {
        const discard = window.confirm("¿Seguro que deseas guardar el reporte SIN registrar este material?");
        if (!discard) {
          return;
        }
      }
    }

    if (activeDetailsList.length === 0) {
      const confirmZeroProduction = window.confirm(
        "No has agregado ningún material producido a la lista.\n\n" +
        "¿Deseas registrar este reporte con producción CERO para esta ensacadora?"
      );
      if (!confirmZeroProduction) {
        return;
      }
    }

    // Assign theoretical BDP rate per detail item
    activeDetailsList.forEach(det => {
      const bdpVal = masters.capacities.find((c: any) => 
        c.baggerId === formData.baggerId && 
        c.palletizerId === palletizerId && 
        c.materialId === det.materialId
      )?.bdp || 100;
      det.bdp = bdpVal;
      det.bagProvider = det.bagProvider || formData.bagProvider || (masters.bagSuppliers?.[0]?.nombre || '');
    });

    // Sum details together for header backward-compatibility
    const totalBags = activeDetailsList.reduce((sum, d) => sum + d.bagsProduced, 0);
    const totalTons = activeDetailsList.reduce((sum, d) => sum + d.tonsProduced, 0);
    const totalDiscardedBagsBagger = activeDetailsList.reduce((sum, d) => sum + (d.discardedBagsBagger || 0), 0);
    const totalNotNozzledBags = activeDetailsList.reduce((sum, d) => sum + (d.notNozzledBags || 0), 0);
    const totalDiscardedBagsVentocheck = activeDetailsList.reduce((sum, d) => sum + (d.discardedBagsVentocheck || 0), 0);
    const totalDiscardedBagsTransport = activeDetailsList.reduce((sum, d) => sum + (d.discardedBagsTransport || 0), 0);
    
    const primaryMaterialId = activeDetailsList[0]?.materialId || '';

    // Weighted BDP rate for the header
    let totalTonsForBdp = 0;
    let sumTonsOverBDP = 0;
    activeDetailsList.forEach(det => {
      const bdpVal = det.bdp || 100;
      totalTonsForBdp += det.tonsProduced;
      sumTonsOverBDP += det.tonsProduced / bdpVal;
    });
    const headerBdp = sumTonsOverBDP > 0 ? totalTonsForBdp / sumTonsOverBDP : 100;

    // Calculate Bagger Nozzle Availability Percentage based on reported stoppages
    const shiftHours = selectedShiftObj ? Number(selectedShiftObj.durationHours || 8) : 8;
    const totalShiftMinutes = shiftHours * 60;
    const totalBaggerNozzles = selectedBaggerObj?.nozzles || parseInt(formData.availableNozzlesShift) || 4;
    const totalNozzleMinutes = totalBaggerNozzles * totalShiftMinutes;

    let totalNozzleDowntimeMinutes = 0;
    formData.nozzleNews.forEach(news => {
      let stopDuration = 0;
      if (news.isAllShift) {
        stopDuration = totalShiftMinutes;
      } else if (news.startTime && news.endTime) {
        try {
          const start = parse(news.startTime, 'HH:mm', new Date());
          const end = parse(news.endTime, 'HH:mm', new Date());
          let diff = differenceInMinutes(end, start);
          if (diff < 0) {
            diff += 24 * 60; // overnight crossing
          }
          stopDuration = Math.min(totalShiftMinutes, diff);
        } catch {
          stopDuration = 0;
        }
      }
      totalNozzleDowntimeMinutes += stopDuration;
    });

    const activeNozzleDowntime = Math.min(totalNozzleMinutes, totalNozzleDowntimeMinutes);
    const nozzleAvailabilityPercent = totalNozzleMinutes > 0
      ? ((totalNozzleMinutes - activeNozzleDowntime) / totalNozzleMinutes) * 100
      : 100;

    const nozzleAvailabilityStr = `${nozzleAvailabilityPercent.toFixed(1)}%`;

    const record = {
      id: editingItem?.id || Math.random().toString(36).substr(2, 9),
      date: editingItem?.date || selectedDate,
      shiftId,
      palletizerId,
      baggerId: formData.baggerId,
      materialId: primaryMaterialId,
      bagsProduced: totalBags,
      tonsProduced: totalTons,
      bdp: headerBdp,
      availableNozzlesShift: parseInt(formData.availableNozzlesShift) || 0,
      bagProvider: activeDetailsList[0]?.bagProvider || formData.bagProvider || (masters.bagSuppliers?.[0]?.nombre || ''),
      discardedBagsBagger: totalDiscardedBagsBagger,
      notNozzledBags: totalNotNozzledBags,
      discardedBagsVentocheck: totalDiscardedBagsVentocheck,
      discardedBagsTransport: totalDiscardedBagsTransport,
      nozzleNews: formData.nozzleNews,
      nozzleAvailability: nozzleAvailabilityStr,
      hsMarchaTis: formData.hsMarchaTis ? parseFloat(formData.hsMarchaTis) : null,
      machinistId: editingItem?.machinistId || currentUser?.dni || "",
      machinistName: editingItem?.machinistName || currentUser?.name || "",
      materialsDetails: activeDetailsList
    };

    onSave(record);
    setIsModalOpen(false);
  };

  const tableColumns: Column<ProductionReport>[] = [
    {
      header: 'Ensacadora / Material',
      accessor: (row) => {
        const baggerName = masters.baggers.find(b => b.id === row.baggerId)?.name || 'Desconocida';
        const details = row.materialsDetails || [];
        
        return (
          <div className="py-1 space-y-1">
            <div className="text-[11px] font-black text-text-main uppercase tracking-tight">
              {baggerName}
            </div>
            {details.length > 0 ? (
              <div className="flex flex-wrap gap-1 max-w-[220px]">
                {details.map((d: any, idx: number) => {
                  const matName = masters.materials.find(m => m.id === d.materialId)?.name || 'Desconocido';
                  return (
                    <span 
                      key={d.id || idx} 
                      className="inline-block px-2 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-md bg-slate-800/90 text-white border border-slate-700 shadow-xs"
                    >
                      {matName} ({d.bagsProduced} bol.)
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block uppercase tracking-wider">
                SIN PRODUCCIÓN
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Maquinista',
      accessor: (row) => (
        <div className="py-1">
          <div className="text-[11px] font-black text-text-main">
            {row.machinistName || <span className="text-text-muted/80 italic font-normal">Sin registrar</span>}
          </div>
          {row.machinistId && (
            <div className="text-[9px] font-mono text-text-muted font-bold">
              DNI: {row.machinistId}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Producción',
      align: 'right',
      accessor: (row) => (
        <div className="text-right py-0.5">
          <div className="text-[12px] font-black text-text-main tabular-nums">
            {row.bagsProduced} BOLSAS
          </div>
          <div className="text-[10px] font-black text-text-main tabular-nums mt-0.5">
            {row.tonsProduced.toFixed(2)} TN
          </div>
        </div>
      )
    },
    {
      header: 'Novedades',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          {row.nozzleNews?.length > 0 ? (
            <div className="flex items-center gap-1 text-amber-400 font-extrabold text-[10px]">
              <AlertCircle size={15} className="shrink-0 text-amber-400" />
              <span>{row.nozzleNews.length} Nov.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-emerald-400 font-extrabold text-[10px]">
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
              <span className="text-text-main">OK</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Disp. Boquillas',
      align: 'center',
      accessor: (row) => {
        const value = row.nozzleAvailability || '100.0%';
        const num = parseFloat(value);
        
        if (num >= 100) {
          return (
            <div className="flex items-center justify-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] font-black font-mono text-text-main">100.0%</span>
            </div>
          );
        } else if (num >= 60) {
          return (
            <div className="flex items-center justify-center gap-1.5">
              <AlertTriangle size={15} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-black font-mono text-text-main">{value}</span>
            </div>
          );
        } else {
          return (
            <div className="flex items-center justify-center gap-1.5">
              <XCircle size={15} className="text-red-400 shrink-0" />
              <span className="text-[11px] font-black font-mono text-red-400">{value}</span>
            </div>
          );
        }
      }
    },
    {
      header: 'TIS vs App',
      align: 'center',
      accessor: (row) => {
        const rowTisValue = row.hsMarchaTis !== undefined && row.hsMarchaTis !== null ? row.hsMarchaTis : shiftTisHours;
        if (rowTisValue === null || rowTisValue === undefined) {
          return <span className="text-[10px] text-text-muted/60 italic font-medium">Sin registrar</span>;
        }
        
        const diff = hsCalculatedByApp - rowTisValue;
        const absoluteDiff = Math.abs(diff);
        
        return (
          <div className="flex flex-col items-center py-0.5">
            <span className="text-[11px] font-black text-text-main font-mono">
              TIS: {rowTisValue.toFixed(2)}h
            </span>
            {absoluteDiff < 0.01 ? (
              <div className="flex items-center gap-1 text-[9px] font-extrabold text-emerald-400 mt-0.5">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>OK (0.00h)</span>
              </div>
            ) : diff > 0 ? (
              <div className="flex items-center gap-1 text-[9px] font-extrabold text-amber-400 mt-0.5">
                <AlertTriangle size={12} className="shrink-0" />
                <span>+{diff.toFixed(2)}h paros</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[9px] font-extrabold text-red-400 mt-0.5">
                <XCircle size={12} className="shrink-0" />
                <span>{diff.toFixed(2)}h paros</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Acciones',
      align: 'right',
      accessor: (row) => canEdit ? (
        <TableActions 
          onEdit={() => handleOpenEdit(row)}
          onDelete={() => setDeletingId(row.id)}
        />
      ) : (
        <span className="text-[9px] font-bold text-text-muted/40 uppercase tracking-tighter">Lectura</span>
      )
    }
  ];

  const newsColumns: Column<NozzleNews>[] = [
    {
      header: 'Boquilla',
      accessor: (row) => <span className="font-bold text-text-main">Boq. {row.nozzleNumber}</span>
    },
    {
      header: 'Rango',
      accessor: (row) => (
        <div className="text-[10px] tabular-nums">
          {row.isAllShift ? (
            <span className="font-bold text-primary">TODO EL TURNO</span>
          ) : (
            <span>{row.startTime} - {row.endTime}</span>
          )}
        </div>
      )
    },
    {
      header: 'Causa / Observación',
      accessor: (row) => (
        <span className="text-[10px] text-text-muted italic block truncate max-w-[180px]" title={row.observation}>
          {row.observation || '-'}
        </span>
      )
    },
    {
      header: 'Acciones',
      align: 'right',
      accessor: (row) => (
        <TableActions 
          onEdit={() => handleEditNozzleNews(row)}
          onDelete={() => removeNozzleNews(row.id)}
        />
      )
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="layout-container py-6 space-y-8"
    >
      {/* Automate Summary Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Contenedor 1: Producción Total */}
        <GlassCard className="lg:col-span-4 bg-surface-elevated p-5 border-l-4 border-l-primary flex items-center justify-between shadow-md">
          <div>
            <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">PRODUCCIÓN TOTAL</h4>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-text-main tracking-tighter tabular-nums">{totals.totalTons.toFixed(1)}</span>
                <span className="text-xs font-black text-primary dark:text-sky-400 uppercase">TN</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-sm font-extrabold text-text-main tabular-nums">{totals.totalBags.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-text-muted uppercase">bolsas</span>
              </div>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary dark:text-sky-300 flex items-center justify-center border border-primary/20 shrink-0">
            <TrendingUp size={24} />
          </div>
        </GlassCard>

        {/* Contenedor 2: Panel Unificado de Eficiencia (Rend, Disp, OEE, Hs. Marcha) */}
        <GlassCard className="lg:col-span-6 bg-surface-elevated p-4 flex items-center shadow-md">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full divide-x divide-border/40">
            {/* Rendimiento */}
            <div className="px-2 first:pl-0 flex flex-col justify-center">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">RENDIMIENTO</span>
              <span className="text-xl font-black text-emerald-500 dark:text-emerald-400 tabular-nums">{lineKpis.performance}%</span>
            </div>

            {/* Disponibilidad */}
            <div className="px-3 flex flex-col justify-center">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">DISPONIBILIDAD</span>
              <span className="text-xl font-black text-primary dark:text-sky-400 tabular-nums">{lineKpis.availability}%</span>
            </div>

            {/* OEE */}
            <div className="px-3 flex flex-col justify-center">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">OEE</span>
              <span className="text-xl font-black text-purple-500 dark:text-purple-400 tabular-nums">{lineKpis.oee}%</span>
            </div>

            {/* Hs de Marcha */}
            <div className="px-3 flex flex-col justify-center">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-0.5">HS. MARCHA</span>
              <span className="text-xl font-black text-text-main tabular-nums">{lineKpis.hsMarcha.toFixed(2)}h</span>
            </div>
          </div>
        </GlassCard>

        {/* Botón Agregar Producción */}
        {canEdit && (
          <div className="lg:col-span-2 flex flex-col justify-center">
            <GlassButton 
              onClick={handleOpenAdd}
              className="h-full py-4 lg:py-0 text-xs font-extrabold shadow-lg shadow-primary/20 uppercase tracking-wider"
            >
              <Plus size={18} className="mr-1.5 shrink-0" />
              Agregar Carga
            </GlassButton>
          </div>
        )}
      </div>

      {/* Registers Accordion Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase tracking-widest">REGISTROS DEL TURNO</h3>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-tight">Listado detallado de cargas activas</p>
            </div>
          </div>
        </div>

        {history.length === 0 ? (
          <GlassCard className="p-12 text-center bg-surface-elevated border-border">
            <div className="flex flex-col items-center justify-center">
              <Package size={40} className="text-text-muted opacity-30 mb-3" />
              <p className="text-xs font-bold uppercase tracking-widest text-text-muted">Sin registros aún</p>
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-tight opacity-70">
                Comienza agregando una producción para ver los datos aquí.
              </p>
            </div>
          </GlassCard>
        ) : (
          /* Card Group (Collapsible Accordion Card without Registration Number) */
          <GlassCard className="bg-surface-elevated border-border overflow-hidden shadow-lg p-0">
            {/* Header Row of the Card */}
            <div 
              onClick={() => toggleCard('main')}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors border-b border-border/40"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <Calendar size={20} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-text-main">
                      {selectedDate}
                    </span>
                    <span className="text-xs font-bold text-text-muted">
                      ({masters.shifts.find(s => s.id === shiftId)?.name || 'Turno Activo'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Totals, TIS vs App & Toggle */}
              <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/30 flex-wrap">
                {/* Total Production */}
                <div className="text-right">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-xl font-black text-text-main tabular-nums">{totals.totalTons.toFixed(1)}</span>
                    <span className="text-[10px] font-black text-primary dark:text-sky-400 uppercase">TN</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-text-muted block tabular-nums">
                    {totals.totalBags.toLocaleString()} BOLSAS
                  </span>
                </div>

                {/* TIS vs App (Only rendered if TIS hours were reported) */}
                {shiftTisHours !== null && shiftTisHours > 0 && (
                  <div className="text-center px-3 border-l border-border/40 min-w-[100px]">
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block mb-0.5">TIS VS APP</span>
                    <div>
                      <span className="text-xs font-black text-text-main font-mono leading-none block">
                        TIS: {shiftTisHours.toFixed(2)}h
                      </span>
                      {Math.abs(hsCalculatedByApp - shiftTisHours) < 0.01 ? (
                        <span className="text-[9px] font-bold text-emerald-400 flex items-center justify-center gap-0.5 mt-0.5">
                          <CheckCircle2 size={11} /> OK (0.00h)
                        </span>
                      ) : (hsCalculatedByApp - shiftTisHours) > 0 ? (
                        <span className="text-[9px] font-bold text-amber-400 flex items-center justify-center gap-0.5 mt-0.5">
                          <AlertTriangle size={11} /> +{(hsCalculatedByApp - shiftTisHours).toFixed(2)}h paros
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-red-400 flex items-center justify-center gap-0.5 mt-0.5">
                          <XCircle size={11} /> {(hsCalculatedByApp - shiftTisHours).toFixed(2)}h paros
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Bagger Count */}
                <div className="text-center px-3 border-l border-border/40">
                  <span className="text-lg font-black text-text-main block leading-none">{history.length}</span>
                  <span className="text-[8px] font-black text-text-muted uppercase tracking-wider">
                    {history.length === 1 ? 'ENSACADORA' : 'ENSACADORAS'}
                  </span>
                </div>

                <button 
                  type="button" 
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-muted hover:text-text-main transition-colors"
                >
                  <ChevronDown size={18} className={cn("transition-transform duration-200", (expandedCards['main'] ?? true) && "rotate-180")} />
                </button>
              </div>
            </div>

            {/* Expanded Content Body */}
            <AnimatePresence initial={false}>
              {(expandedCards['main'] ?? true) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 sm:p-6 space-y-4 bg-bg/20">
                    <h5 className="text-[10px] font-black text-text-muted uppercase tracking-widest">
                      Ensacadoras incluidas en este registro
                    </h5>

                    {/* Sub-cards list per Bagger */}
                    <div className="space-y-3">
                      {history.map((row) => {
                        const baggerName = masters.baggers.find(b => b.id === row.baggerId)?.name || 'Ensacadora';
                        const details = row.materialsDetails || [];
                        const aggregatedMaterials = details.reduce((acc, curr) => {
                          if (!acc[curr.materialId]) {
                            acc[curr.materialId] = {
                              name: masters.materials.find(m => m.id === curr.materialId)?.name || 'Desconocido',
                              tons: 0,
                              bags: 0
                            };
                          }
                          acc[curr.materialId].tons += curr.tonsProduced || 0;
                          acc[curr.materialId].bags += curr.bagsProduced || 0;
                          return acc;
                        }, {} as Record<string, { name: string, tons: number, bags: number }>);
                        const materialsToDisplay = Object.values(aggregatedMaterials);
                        const nozzleAvail = parseFloat(row.nozzleAvailability || '100');

                        return (
                          <div 
                            key={row.id} 
                            className="bg-surface p-4 rounded-2xl border border-border/60 hover:border-border transition-all shadow-xs"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              {/* Col 1: Bagger + Material */}
                              <div className="md:col-span-3 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                  <Package size={18} />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-black text-text-main uppercase tracking-tight">
                                      {baggerName}
                                    </span>
                                  </div>
                                  {materialsToDisplay.length > 0 && (
                                    <div className="flex flex-col gap-1.5 mt-1.5">
                                      {materialsToDisplay.map((mat, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          <span className="inline-block px-2 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-md bg-slate-800 text-white border border-slate-700 shrink-0">
                                            {mat.name}
                                          </span>
                                          <span className="text-[10px] font-bold text-text-main truncate">
                                            {mat.bags.toLocaleString()} BOLSAS
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Col 2: Producción */}
                              <div className="md:col-span-2 space-y-1">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block" style={{ height: '20px' }}>PRODUCCIÓN</span>
                                {materialsToDisplay.length > 0 ? (
                                  <div className="flex flex-col gap-1.5 mt-1.5">
                                    {materialsToDisplay.map((mat, idx) => (
                                      <div key={idx} className="flex items-baseline gap-1" style={{ height: '20px' }}>
                                        <span className="text-sm font-black text-text-main tabular-nums">{mat.tons.toFixed(1)}</span>
                                        <span className="text-[9px] font-black text-primary dark:text-sky-400 uppercase">TN</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1.5 mt-1.5">
                                    <div className="flex items-baseline gap-1" style={{ height: '20px' }}>
                                      <span className="text-sm font-black text-text-main tabular-nums">{row.tonsProduced.toFixed(1)}</span>
                                      <span className="text-[9px] font-black text-primary dark:text-sky-400 uppercase">TN</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Col 3: Maquinista */}
                              <div className="md:col-span-3 space-y-0.5">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">MAQUINISTA</span>
                                <span className="text-xs font-extrabold text-text-main truncate block">
                                  {row.machinistName || 'Sin registrar'}
                                </span>
                                {row.machinistId && (
                                  <span className="text-[9px] font-mono text-text-muted font-bold block">
                                    DNI: {row.machinistId}
                                  </span>
                                )}
                              </div>

                              {/* Col 4: Disp. Boquillas */}
                              <div className="md:col-span-2 space-y-0.5">
                                <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">DISP. BOQUILLAS</span>
                                {nozzleAvail >= 100 ? (
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                    <span className="text-xs font-black font-mono text-text-main">100.0%</span>
                                  </div>
                                ) : nozzleAvail >= 60 ? (
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                                    <span className="text-xs font-black font-mono text-text-main">{row.nozzleAvailability}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <XCircle size={15} className="text-red-400 shrink-0" />
                                    <span className="text-xs font-black font-mono text-red-400">{row.nozzleAvailability}</span>
                                  </div>
                                )}
                              </div>

                              {/* Col 5: Acciones */}
                              <div className="md:col-span-2 flex items-center justify-end">
                                {canEdit && (
                                  <TableActions 
                                    onEdit={() => handleOpenEdit(row)}
                                    onDelete={() => setDeletingId(row.id)}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer Observaciones del registro */}
                    <div className="p-3 bg-surface rounded-xl border border-border/40 flex items-center gap-2 text-xs font-medium text-text-muted">
                      <MessageSquare size={15} className="text-primary shrink-0" />
                      <span className="font-bold text-text-main uppercase text-[10px]">Observaciones del registro:</span>
                      <span className="truncate">Producción normal del turno. Sin novedades relevantes.</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        className="max-w-3xl"
        title={editingItem ? 'Editar Registro Operativo' : 'Nueva Producción Ensacadora'}
      >
        <div className="space-y-8 max-h-[70vh] overflow-y-auto no-scrollbar pr-1">
          {/* Section 1: Datos Generales del Turno */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary border-b border-white/5 pb-2">
              <TrendingUp size={16} />
              <h4 className="text-xs font-black uppercase tracking-widest">1. Datos Generales del Turno</h4>
            </div>
            <div className="bg-bg-input/60 p-4 rounded-xl border border-border/50 space-y-4">
              <div className={cn("grid grid-cols-1 gap-4", showTisInput ? "md:grid-cols-3" : "md:grid-cols-2")}>
                <GlassSelect 
                  label="Ensacadora/Línea" 
                  options={masters.baggers.map((e:any) => ({label: e.name, value: e.id}))} 
                  value={formData.baggerId} 
                  onChange={e => setFormData(prev => ({...prev, baggerId: (e.target as HTMLSelectElement).value}))} 
                />
                <GlassInput 
                  label="Boquillas Disponibles" 
                  type="number" 
                  value={formData.availableNozzlesShift} 
                  onChange={e => setFormData(prev => ({...prev, availableNozzlesShift: (e.target as HTMLInputElement).value}))} 
                  placeholder="Ej: 4"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <GlassInput 
                  className={cn(!showTisInput ? "hidden" : "", "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none")}
                  label="Hs. Marcha TIS" 
                  type="number"
                  step="0.01"
                  value={formData.hsMarchaTis} 
                  onChange={e => setFormData(prev => ({...prev, hsMarchaTis: (e.target as HTMLInputElement).value}))} 
                  placeholder="Ej: 7.50"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                {selectedBaggerObj && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg justify-center w-full">
                    <ShieldCheck size={14} className="text-primary" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                      EQUIPO (HAC): {selectedBaggerObj.hacId || 'N/A'} — {selectedBaggerObj.nozzles} BOQUILLAS
                    </span>
                  </div>
                )}

                {Boolean((formData.hsMarchaTis && parseFloat(formData.hsMarchaTis) > 0) || (editingItem && editingItem.hsMarchaTis && parseFloat(String(editingItem.hsMarchaTis)) > 0)) && (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-text-muted">
                      <span>Comparativa de Horas de Marcha</span>
                      <span className="font-mono text-text-main">
                        App: {hsCalculatedByApp.toFixed(2)} hs | TIS: {parseFloat(formData.hsMarchaTis || (editingItem?.hsMarchaTis?.toString() || "0")).toFixed(2)} hs
                      </span>
                    </div>
                    
                    {(() => {
                      const tisVal = parseFloat(formData.hsMarchaTis || (editingItem?.hsMarchaTis?.toString() || "0"));
                      const diff = hsCalculatedByApp - tisVal;
                      const absoluteDiff = Math.abs(diff);
                      
                      if (absoluteDiff < 0.01) {
                        return (
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
                            <ShieldCheck size={14} />
                            <span>Sincronización perfecta de horas (0.00 hs de diferencia)</span>
                          </div>
                        );
                      } else if (diff > 0) {
                        return (
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                            <AlertCircle size={14} />
                            <span>Faltan paros de reportar en la app (Diferencia de +{diff.toFixed(2)} hs)</span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex items-center gap-2 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
                            <AlertCircle size={14} />
                            <span>Hay paros de más reportados en la app (Diferencia de {diff.toFixed(2)} hs)</span>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Producción por Material */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2 text-primary">
                <Package size={16} />
                <h4 className="text-xs font-black uppercase tracking-widest">2. Producción por Material</h4>
                {activeDetail.tons && (
                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-md font-mono select-none">
                    + {parseFloat(activeDetail.tons).toFixed(2)} TN (Ingreso)
                  </span>
                )}
              </div>
            </div>

            <div className="bg-bg-input/60 p-4 rounded-xl border border-border/50 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-2 items-end">
                <div className="md:col-span-4">
                  <GlassSelect 
                    label="Material / Producto" 
                    options={availableMaterialsOptions} 
                    value={activeDetail.materialId} 
                    onChange={e => setActiveDetail(prev => ({...prev, materialId: (e.target as HTMLSelectElement).value}))} 
                  />
                </div>
                <div className="md:col-span-4">
                  <GlassInput 
                    label="Bolsas Producidas" 
                    type="number" 
                    value={activeDetail.bags} 
                    onChange={e => setActiveDetail(prev => ({...prev, bags: (e.target as HTMLInputElement).value}))} 
                    placeholder="0"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="md:col-span-4">
                  <GlassSelect 
                    label="Proveedor de Bolsa" 
                    options={(masters.bagSuppliers || []).map((p: any) => ({ label: p.nombre, value: p.nombre }))}
                    value={activeDetail.bagProvider} 
                    onChange={e => setActiveDetail(prev => ({...prev, bagProvider: (e.target as HTMLSelectElement).value}))} 
                  />
                </div>
                
                {/* Field: Observacion de Produccion (New) */}
                <div className="md:col-span-12">
                  <GlassInput 
                    label="Observación de Producción" 
                    type="text" 
                    value={activeDetail.observacion} 
                    onChange={e => setActiveDetail(prev => ({...prev, observacion: (e.target as HTMLInputElement).value}))} 
                    placeholder="Escribe alguna observación o detalle sobre este material..."
                  />
                </div>

                {/* Bolsas Descartadas (Para el material en edición/registro) */}
                <div className="md:col-span-12 space-y-2 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest block">
                    Bolsas Descartadas (Para este producto)
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GlassInput 
                      label="Ensacadora (Bas.)" 
                      type="number" 
                      value={activeDetail.discardedBagsBagger} 
                      onChange={e => setActiveDetail(prev => ({...prev, discardedBagsBagger: (e.target as HTMLInputElement).value}))} 
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <GlassInput 
                      label="No Emboquilladas" 
                      type="number" 
                      value={activeDetail.notNozzledBags} 
                      onChange={e => setActiveDetail(prev => ({...prev, notNozzledBags: (e.target as HTMLInputElement).value}))} 
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <GlassInput 
                      label="Ventocheck" 
                      type="number" 
                      value={activeDetail.discardedBagsVentocheck} 
                      onChange={e => setActiveDetail(prev => ({...prev, discardedBagsVentocheck: (e.target as HTMLInputElement).value}))} 
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <GlassInput 
                      label="Transporte" 
                      type="number" 
                      value={activeDetail.discardedBagsTransport} 
                      onChange={e => setActiveDetail(prev => ({...prev, discardedBagsTransport: (e.target as HTMLInputElement).value}))} 
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="md:col-span-12 flex gap-2 pt-2">
                  <GlassButton
                    type="button"
                    variant="primary"
                    onClick={addMaterialDetail}
                    disabled={!activeDetail.materialId || !activeDetail.bags || parseInt(activeDetail.bags) <= 0}
                    className="flex-grow h-[42px] text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 min-w-0"
                  >
                    {editingDetailId ? (
                      <>
                        <Check size={14} className="shrink-0" />
                        <span>Actualizar Material</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} className="shrink-0" />
                        <span>Agregar Material</span>
                      </>
                    )}
                  </GlassButton>
                  {editingDetailId && (
                    <GlassButton
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingDetailId(null);
                        setActiveDetail({
                          materialId: '',
                          bags: '',
                          tons: '',
                          bagProvider: masters.bagSuppliers && masters.bagSuppliers.length > 0 ? masters.bagSuppliers[0].nombre : '',
                          discardedBagsBagger: '0',
                          notNozzledBags: '0',
                          discardedBagsVentocheck: '0',
                          discardedBagsTransport: '0',
                          observacion: ''
                        });
                      }}
                      className="h-[42px] px-3 font-black text-xs text-text-muted hover:text-white bg-white/[0.05] border-white/10 shrink-0 flex items-center justify-center gap-1"
                      title="Cancelar edición"
                    >
                      <X size={14} className="shrink-0" />
                      <span>Cancelar</span>
                    </GlassButton>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Materiales Registrados */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2 text-primary">
                <History size={16} />
                <h4 className="text-xs font-black uppercase tracking-widest">3. Materiales Registrados</h4>
              </div>
              {modalTotals.totalBags > 0 && (
                <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest font-mono">
                    Total Reportado: {modalTotals.totalTons.toFixed(2)} TN ({modalTotals.totalBags} Bolsas)
                  </span>
                </div>
              )}
            </div>

            <div className="bg-bg-input/60 p-4 rounded-xl border border-border/50">
              {formData.materialsDetails && formData.materialsDetails.length > 0 ? (
                <div className="space-y-2">
                  {formData.materialsDetails.map((det: any, idx: number) => {
                    const matName = masters.materials.find(m => m.id === det.materialId)?.name || 'Desconocido';
                    const totalDiscards = (Number(det.discardedBagsBagger) || 0) + 
                                          (Number(det.notNozzledBags) || 0) + 
                                          (Number(det.discardedBagsVentocheck) || 0) + 
                                          (Number(det.discardedBagsTransport) || 0);
                    const isEditing = editingDetailId === det.id;

                    return (
                      <div 
                        key={det.id || idx} 
                        className={cn(
                          "flex flex-col p-3 rounded-lg transition-all gap-2 border bg-white/[0.02]", 
                          isEditing 
                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/5" 
                            : "border-white/5 hover:border-primary/20"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <span className="text-xs font-bold text-text-main block uppercase">
                              {matName} {isEditing && <span className="text-[10px] text-primary lowercase">(editando...)</span>}
                            </span>
                            <span className="text-[10px] text-primary/80 font-bold tracking-wide">
                              {det.bagsProduced} bolsas — {Number(det.tonsProduced).toFixed(2)} TN
                            </span>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] text-[#2ac480] bg-[#2ac480]/10 border border-[#2ac480]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                                PROVEEDOR: {det.bagProvider || (masters.bagSuppliers && masters.bagSuppliers.length > 0 ? masters.bagSuppliers[0].nombre : 'No asignado')}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-text-muted block font-medium">Bolsas Descar.: {totalDiscards}</span>
                            <span className="text-[8px] text-orange-400 font-bold uppercase tracking-tighter">
                              (Ens: {det.discardedBagsBagger || 0} | NoEmb: {det.notNozzledBags || 0} | Vento: {det.discardedBagsVentocheck || 0} | Trans: {det.discardedBagsTransport || 0})
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditMaterialDetail(det)}
                              className="p-1.5 text-primary hover:text-white hover:bg-primary/20 rounded transition-colors"
                              title="Editar Material"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMaterialDetail(det.id)}
                              className="p-1.5 text-red-500 hover:text-white hover:bg-red-500/20 rounded transition-colors"
                              title="Eliminar Material"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {det.observacion && (
                          <div className="text-[10px] text-text-muted italic bg-black/20 px-2 py-1 rounded border border-white/5 select-none animate-fadeIn">
                            Obs: {det.observacion}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-text-muted/60 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">
                  No se han registrado posiciones de material aún en este turno. (Si no hubo producción, puedes dejar esta lista vacía y guardar directamente).
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Novedades de Boquillas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2 text-red-500">
                <Clock size={16} />
                <h4 className="text-xs font-black uppercase tracking-widest font-bold">4. Novedades de Boquillas</h4>
              </div>
              <GlassButton
                type="button"
                variant={formData.baggerId ? "primary" : "secondary"}
                disabled={!formData.baggerId}
                onClick={() => {
                  setEditingNozzleId(null);
                  setTempNews({ nozzleNumber: '', startTime: '', endTime: '', isAllShift: false, observation: '' });
                  setIsNozzleModalOpen(true);
                }}
                className={cn(
                  "h-9 px-4 text-xs font-bold transition-all shadow-sm",
                  formData.baggerId
                    ? "bg-primary text-white hover:bg-primary-hover border-transparent shadow-primary/20"
                    : "bg-primary/10 text-primary/40 border-primary/10 cursor-not-allowed opacity-50"
                )}
              >
                <Plus size={14} className="mr-1" />
                Añadir Novedad
              </GlassButton>
            </div>
            
            <div className="bg-bg-input/60 p-4 rounded-xl border border-border/50 space-y-4">
               {/* Current Nozzle News List */}
               {formData.nozzleNews.length > 0 ? (
                 <div className="border border-border/30 rounded-lg overflow-hidden">
                    <DataTable 
                      title=""
                      columns={newsColumns}
                      data={formData.nozzleNews}
                      keyExtractor={r => r.id}
                    />
                 </div>
               ) : (
                 <div className="text-center py-4 text-xs text-text-muted">
                   Ninguna novedad de boquilla registrada aún en esta producción.
                 </div>
               )}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-3">
            <GlassButton 
              variant="secondary" 
              className="w-full sm:flex-1" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </GlassButton>
            <GlassButton 
              className="w-full sm:flex-1"
              onClick={handleSave}
              disabled={!formData.baggerId}
            >
              {editingItem ? 'Actualizar Reporte' : 'Guardar Reporte Operativo'}
            </GlassButton>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && onDelete(deletingId)}
        title="Confirmar eliminación"
        message="¿Estás seguro de eliminar este registro de producción? El total global se recalculará automáticamente."
      />

      <Modal
        isOpen={isNozzleModalOpen}
        onClose={() => setIsNozzleModalOpen(false)}
        title={editingNozzleId ? "Editar Novedad de Boquilla" : "Registrar Novedad de Boquilla"}
        isSubModal={true}
        className="max-w-md"
      >
        <div className="space-y-4">
          <GlassSelect 
            label="Boquilla" 
            options={Array.from({length: selectedBaggerObj?.nozzles || 4}, (_, i) => ({label: `Boquilla ${i+1}`, value: (i+1).toString()}))}
            value={tempNews.nozzleNumber}
            onChange={(e: any) => setTempNews({...tempNews, nozzleNumber: e.target.value})}
          />
          <div className="flex items-center gap-2">
             <div className="flex-1">
                <GlassInput 
                  label="Inicio" 
                  type="time" 
                  disabled={tempNews.isAllShift}
                  value={tempNews.startTime}
                  onChange={(e: any) => setTempNews({...tempNews, startTime: e.target.value})}
                />
             </div>
             <div className="flex-1">
                <GlassInput 
                  label="Fin" 
                  type="time" 
                  disabled={tempNews.isAllShift}
                  value={tempNews.endTime}
                  onChange={(e: any) => setTempNews({...tempNews, endTime: e.target.value})}
                />
             </div>
          </div>
          <div className="flex items-center justify-start py-1">
             <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={tempNews.isAllShift}
                  onChange={(e: any) => setTempNews({...tempNews, isAllShift: e.target.checked})}
                  className="w-4 h-4 rounded border-border bg-bg text-primary focus:ring-primary/20"
                />
                <span className="text-xs font-bold text-text-muted group-hover:text-text-main transition-colors">TODO EL TURNO</span>
             </label>
          </div>
          <GlassInput 
            label="Causa de la Novedad / Observación" 
            placeholder="Ej: Obstrucción de válvula, limpieza..."
            value={tempNews.observation || ''}
            onChange={(e: any) => setTempNews({...tempNews, observation: e.target.value})}
          />
          <div className="pt-4 border-t border-border flex gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setIsNozzleModalOpen(false)}
            >
              Cancelar
            </GlassButton>
            <GlassButton
              type="button"
              className="flex-1"
              onClick={addNozzleNews}
              disabled={!tempNews.nozzleNumber || (!tempNews.isAllShift && (!tempNews.startTime || !tempNews.endTime))}
            >
              {editingNozzleId ? "Guardar" : "Agregar"}
            </GlassButton>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
