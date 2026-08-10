import { HAC, Cause, Shift, Machine, Material, CapacityBDP, AppUser } from '../types';

export const SYSTEM_VIEWS: { id: string; label: string; section: 'PRODUCTIVITY' | 'ADMIN' }[] = [
  { id: 'DASHBOARD', label: 'Dashboard', section: 'PRODUCTIVITY' },
  { id: 'PAROS', label: 'Paros', section: 'PRODUCTIVITY' },
  { id: 'PRODUCCION', label: 'Producción', section: 'PRODUCTIVITY' },
  { id: 'DATER', label: 'Control Fechadores', section: 'PRODUCTIVITY' },
  { id: 'SCALE', label: 'Control Balanzas', section: 'PRODUCTIVITY' },
  { id: 'STOCK', label: 'Insumos', section: 'PRODUCTIVITY' },
  { id: 'PALLET_CLASS', label: 'Clasificación de Pallets', section: 'PRODUCTIVITY' },
  { id: 'DESPACHOS', label: 'Despachos', section: 'PRODUCTIVITY' },
  { id: 'CHANGE', label: 'Cambio de Producto', section: 'PRODUCTIVITY' },
  { id: 'GASOIL', label: 'Combustible', section: 'PRODUCTIVITY' },
  { id: 'MANTENIMIENTO', label: 'Mantenimiento', section: 'PRODUCTIVITY' },
  { id: 'LOADING_LANES', label: 'Calles de Carga', section: 'PRODUCTIVITY' },
  { id: 'REPORTS', label: 'Informes', section: 'PRODUCTIVITY' },
  { id: 'TURNOS', label: 'Maestro Turnos', section: 'ADMIN' },
  { id: 'PALETIZADORAS', label: 'Maestro Paletizadoras', section: 'ADMIN' },
  { id: 'EMBOLSADORAS', label: 'Maestro Ensacadoras', section: 'ADMIN' },
  { id: 'MATERIALES', label: 'Maestro Materiales', section: 'ADMIN' },
  { id: 'EQUIPOS', label: 'Maestro Equipos (HAC)', section: 'ADMIN' },
  { id: 'CAUSAS', label: 'Maestro Causas', section: 'ADMIN' },
  { id: 'CAPACIDADES', label: 'Maestro Capacidades', section: 'ADMIN' },
  { id: 'USUARIOS', label: 'Maestro Usuarios', section: 'ADMIN' },
  { id: 'EMPRESAS', label: 'Maestro Empresas', section: 'ADMIN' },
  { id: 'PUNTOS_CARGA', label: 'Puntos de Carga', section: 'ADMIN' },
  { id: 'PROVEEDORES_BOLSA', label: 'Proveedores Bolsa', section: 'ADMIN' },
  { id: 'VEHICULOS', label: 'Vehículos', section: 'ADMIN' },
  { id: 'CONTROLES_BALANZAS', label: 'Controles Balanzas', section: 'ADMIN' },
];

export const USERS: AppUser[] = [
  {
    dni: '20-12345678-9',
    name: 'Joni Holcim',
    sapUser: 'j-0627',
    email: 'joni0627@gmail.com',
    position: 'Operario Supervisor',
    profile: 'Administrador',
    permissions: SYSTEM_VIEWS.map(v => ({
      viewId: v.id,
      label: v.label,
      section: v.section,
      level: 'EDIT'
    }))
  }
];

export const SHIFTS: Shift[] = [
  { id: 'S1', name: 'T1', startTime: '06:00', endTime: '14:00', durationHours: 8 },
  { id: 'S2', name: 'T2', startTime: '14:00', endTime: '22:00', durationHours: 8 },
  { id: 'S3', name: 'T3', startTime: '22:00', endTime: '06:00', durationHours: 8 },
];

export const PALLETIZERS: Machine[] = [
  { id: 'P1', type: 'PALLETIZADORA', name: 'Palletizadora 1' },
  { id: 'P2', type: 'PALLETIZADORA', name: 'Palletizadora 2' },
  { id: 'P3', type: 'PALLETIZADORA', name: 'Palletizadora 3' },
];

export const BAGGERS: Machine[] = [
  { id: 'E1', type: 'ENSACADORA', name: 'Ensacadora 1', nozzles: 4, hacId: 'H1', isSamplingPoint: true },
  { id: 'E2', type: 'ENSACADORA', name: 'Ensacadora 2', nozzles: 4, hacId: 'H2', isSamplingPoint: true },
  { id: 'E3', type: 'ENSACADORA', name: 'Ensacadora 3', nozzles: 4, hacId: 'H1' },
  { id: 'E4', type: 'ENSACADORA', name: 'Ensacadora 4', nozzles: 4, hacId: 'H3' },
];

export const MATERIALS: Material[] = [
  { 
    id: 'M1', 
    name: 'Cemento 50kg', 
    code: 'SAP-101', 
    packingWeight: 1500, 
    bagWeight: 50, 
    isPallet: false, 
    isProductive: true, 
    isSupply: false, 
    isBigBag: false 
  },
  { 
    id: 'M2', 
    name: 'Tarima Madera', 
    code: 'SAP-102', 
    packingWeight: 25, 
    bagWeight: 0, 
    isPallet: true, 
    isProductive: false, 
    isSupply: false, 
    isBigBag: false 
  },
  { 
    id: 'M3', 
    name: 'Bolson BigBag', 
    code: 'SAP-103', 
    packingWeight: 1000, 
    bagWeight: 1000, 
    isPallet: false, 
    isProductive: true, 
    isSupply: false, 
    isBigBag: true 
  },
  { 
    id: 'M4', 
    name: 'Film Stretch', 
    code: 'SAP-104', 
    packingWeight: 1, 
    bagWeight: 0, 
    isPallet: false, 
    isProductive: false, 
    isSupply: true, 
    isBigBag: false 
  },
  { 
    id: 'M5', 
    name: 'Funda Termo', 
    code: 'SAP-105', 
    packingWeight: 1, 
    bagWeight: 0, 
    isPallet: false, 
    isProductive: false, 
    isSupply: true, 
    isBigBag: false 
  },
];

export const HACS: HAC[] = [
  { id: 'H1', hac: 'HAC-001', detail: 'SISTEMA DE AIRE', gpoCodObjeto: 'OBJ01', equipment: 'COMPRESOR', isDater: false, isScale: false },
  { id: 'H2', hac: 'HAC-002', detail: 'SISTEMA HIDRAULICO', gpoCodObjeto: 'OBJ02', equipment: 'BOMBA HP', isDater: false, isScale: false },
  { id: 'H3', hac: 'HAC-003', detail: 'ELECTRICO', gpoCodObjeto: 'OBJ03', equipment: 'PLC MAIN', isDater: false, isScale: false },
  { id: 'H4', hac: 'HAC-004', detail: 'FECHADOR LINX', gpoCodObjeto: 'OBJ04', equipment: 'FECHADOR', isDater: true, isScale: false },
  { id: 'H5', hac: 'HAC-005', detail: 'FECHADOR VIDEOJET', gpoCodObjeto: 'OBJ05', equipment: 'FECHADOR', isDater: true, isScale: false },
  { id: 'H6', hac: 'HAC-006', detail: 'BALANZA DINAMICA #1', gpoCodObjeto: 'OBJ06', equipment: 'BALANZA', isDater: false, isScale: true },
  { id: 'H7', hac: 'HAC-007', detail: 'BALANZA DINAMICA #2', gpoCodObjeto: 'OBJ07', equipment: 'BALANZA', isDater: false, isScale: true },
];

export const CAUSES: Cause[] = [
  { id: 'C1', hac: 'HAC-001', text: 'FALTA DE PRESION', partObject: 'VALVULA', symptomGroup: 'G1', symptomCode: 'S1', sapCause: 'C-01', causeGroup: 'G1', causeCode: 'CC01', stopType: 'INTERNO' },
  { id: 'C2', hac: 'HAC-001', text: 'FALTA DE ENERGIA (PLANTA)', partObject: 'PLANTA', symptomGroup: 'G2', symptomCode: 'S2', sapCause: 'C-02', causeGroup: 'G2', causeCode: 'CC02', stopType: 'EXTERNO' },
  { id: 'C3', hac: 'HAC-002', text: 'FUGA DE ACEITE', partObject: 'MANGUERA', symptomGroup: 'G3', symptomCode: 'S3', sapCause: 'C-03', causeGroup: 'G3', causeCode: 'CC03', stopType: 'INTERNO' },
];

export const CAPACITIES: CapacityBDP[] = [
  { id: 'B1', baggerId: 'E1', palletizerId: 'P1', materialId: 'M1', bdp: 100 },
  { id: 'B2', baggerId: 'E1', palletizerId: 'P1', materialId: 'M2', bdp: 80 },
  { id: 'B3', baggerId: 'E2', palletizerId: 'P1', materialId: 'M1', bdp: 120 },
];

export const COMPANIES: any[] = [
  { 
    id: 'C1', 
    name: 'Holcim Argentina S.A.', 
    address: 'Av. El Libertador 1234, Malagueño, Córdoba', 
    taxId: '30-50000000-1', 
    phone: '+54 351 1234567', 
    email: 'contacto@holcim.com' 
  }
];

export const LOADING_POINTS: any[] = [
  { id: 'LP1', name: 'Calle 1', type: 'BOLSA' },
  { id: 'LP2', name: 'Calle 2', type: 'BOLSA' },
  { id: 'LP3', name: 'Calle 3', type: 'GRANEL' },
  { id: 'LP4', name: 'Calle 4', type: 'GRANEL' },
];

export const LANE_STATUSES: any[] = [];

export const BAG_SUPPLIERS: any[] = [
  { id: 'PS1', nombre: 'Klabin Argentina', direccion: 'Ruta 9 Km 100, Campana', telefono: '03489-440000', email: 'contacto@klabin.com.ar' },
  { id: 'PS2', nombre: 'Smurfit Kappa', direccion: 'Av. Libertador 450, Bernal', telefono: '011-4229-3000', email: 'ventas@smurfitkappa.com.ar' }
];

export const VEHICLES: any[] = [
  { id: 'V1', marca: 'Toyota', identificación: 'AE-101', tipo: 'Autoelevador', carga_maxima: '2500 kg' },
  { id: 'V2', marca: 'Ford', identificación: 'F-150', tipo: 'Camioneta', carga_maxima: '1000 kg' },
  { id: 'V3', marca: 'Iveco', identificación: 'T-200', tipo: 'Camión', carga_maxima: '15000 kg' }
];
