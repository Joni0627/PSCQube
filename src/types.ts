export type ShiftName = 'T1' | 'T2' | 'T3';

export interface Shift {
  id: string;
  name: ShiftName;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  durationHours: number;
}

export interface Machine {
  id: string;
  type: 'PALLETIZADORA' | 'ENSACADORA';
  name: string;
  hacId?: string;
  nozzles?: number; // solo para ensacadoras
  isSamplingPoint?: boolean;
}

export interface HAC {
  id: string; // idhac automático
  hac: string; // HAC asignado
  detail: string; // Detalle HAC (Descripción)
  gpoCodObjeto: string; // GPO.CÓD. OBJETO (SAP)
  equipment: string; // EQUIPO (SAP)
  isDater: boolean; // Control Fechador?
  isScale: boolean; // Control Balanza?
}

export interface Cause {
  id: string; // idparo automático
  hac: string; // HAC (Consultado de equipos)
  text: string; // Texto de causa
  partObject: string; // Parte Objeto (SAP)
  symptomGroup: string; // GPO.CÓD. SÍNTOMA (SAP)
  symptomCode: string; // CÓD. SÍNTOMA (SAP)
  sapCause: string; // CAUSA SAP (SAP)
  causeGroup: string; // GPO.COD. CAUSA (SAP)
  causeCode: string; // CÓDIGO CAUSA (SAP)
  stopType: 'INTERNO' | 'EXTERNO';
  tipo_paro?: string;
  tipoParo?: string;
}

export interface Material {
  id: string;
  name: string;      // Descripción
  code?: string;      // Código SAP
  packingWeight: number; // Peso Embalaje (pallet)
  bagWeight: number;     // Peso bolsa
  isPallet: boolean;     // Es tarima?
  isProductive: boolean; // Es productivo?
  isSupply: boolean;     // Es insumo?
  isBigBag: boolean;     // Es bigbag?
  isDispatch?: boolean;   // Es despacho?
  isBulk?: boolean;       // Es granel?
}

export interface CapacityBDP {
  id: string;
  baggerId: string;
  palletizerId: string;
  materialId: string;
  bdp: number; // Toneladas por hora teóricas
}

export interface MachineStop {
  id: string; // IDPARO
  date: string; // FECHA
  finishDate: string; // FECHAFIN
  machineId: string; // MÁQUINA AFECTADA (ID)
  machineName: string; // MÁQUINA AFECTADA (Nombre - de la paletizadora creada en MAQUINAS)
  machineHacText?: string; // HAC de la máquina afectada
  shiftId: string; // TURNO (ID)
  shiftName?: string; // Nombre del turno (T1, T2, T3) / Turno A, B, C
  materialId: string; // MATERIAL (ID)
  startTime: string; // INICIO
  endTime?: string;   // FIN
  durationMinutes: number; // DURACIÓN
  
  // Lookups de Maestros
  hacId: string;
  hacName: string; // HAC
  hacDetail: string; // DETALLE HAC
  equipment: string; // EQUIPO
  
  causeId: string;
  causeText: string; // TEXTO DE CAUSA
  noticeText?: string; // TEXTO AVISO (Libre)
  symptomText: string; // TEXTO SÍNTOMA
  
  sapCause: string; // CAUSA SAP
  causeGroup: string; // GPO.COD. CAUSA
  causeCode: string; // CÓDIGO CAUSA
  stopType: string; // TIPO PARO
  
  gpoCodObjeto: string; // GPO.CÓD. OBJETO
  partObject: string; // PARTE OBJETO
  symptomGroup: string; // GPO.CÓD. SÍNTOMA
  symptomCode: string; // CÓD. SÍNTOMA
  
  user: string; // USUARIO
  userName: string; // Nombre del usuario
  workCenter: string; // PUESTO DE TRABAJO (OPEREXP)
  center: string; // CENTRO (AMG0)
}

export interface NozzleNews {
  id: string;
  nozzleNumber: number;
  startTime: string;
  endTime: string;
  isAllShift: boolean;
  observation?: string;
}

export interface ProductionMaterialDetail {
  id: string;
  productionId?: string;
  materialId: string;
  materialDescription?: string;
  bagsProduced: number;
  tonsProduced: number;
  bdp: number;
  availableNozzlesShift?: number;
  bagProvider?: string;
  discardedBagsBagger?: number;
  notNozzledBags?: number;
  discardedBagsVentocheck?: number;
  discardedBagsTransport?: number;
  observacion?: string;
}

export interface ProductionReport {
  id: string;
  date: string;
  shiftId: string;
  palletizerId: string;
  baggerId: string;
  materialId: string;
  bagsProduced: number;
  tonsProduced: number;
  bdp: number;
  // Nuevos campos operativos
  availableNozzlesShift: number;
  bagProvider?: string;
  discardedBagsBagger?: number;
  notNozzledBags?: number;
  discardedBagsVentocheck?: number;
  discardedBagsTransport?: number;
  nozzleNews: NozzleNews[];
  nozzleAvailability?: string;
  hsMarchaTis?: number;
  machinistId?: string;
  machinistName?: string;
  materialsDetails?: ProductionMaterialDetail[];
}

export interface DaterControl {
  id: string; // IDCTRLFECHADOR
  date: string; // FECHA (ISO)
  userId: string; // MAQUINISTA (ID)
  userName: string; // DESCRIPCIÓN MAQUINISTA (Nombre)
  shiftId: string; // TURNO
  hac: string; // HAC del fechador
  purge: 'SI' | 'NO'; // PURGA
  containerLevel: 'COMPLETO' | 'MEDIO' | 'VACÍO'; // NIVEL RECIPIENTE
  printQuality: 'BUENO' | 'REGULAR' | 'DEFICIENTE'; // CALIDAD IMPRESION
  inkStock: number; // STOCK TINTA
  solventStock: number; // STOCK SOLVENTE
  headsStock: number; // STOCK CABEZALES
  observations: string; // OBSERVACIONES
}

export interface ScaleControl {
  id: string; // IDCRTLBALANZA
  date: string; // FECHA
  userId: string; // MAQUINISTA (ID)
  userName: string; // DESCRIPCIÓN MAQUINISTA (Nombre)
  shiftId: string; // TURNO
  hac: string; // HAC de la balanza
  weight1: number; // PESO #1
  weight2: number; // PESO #2
  weight3: number; // PESO #3
  patternWeight: number; // PESO PATRÓN
  average: number; // MEDIA
  bias: number; // BIAS
  range: number; // RANGO
  observations: string;
}

export interface InventoryEntry {
  id: string;
  date: string; // ISO date
  shiftId: string;
  materialId: string;
  quantity: number; // Cantidad de unidades (Tarimas/Pallets)
  weightTn: number; // Peso calculado en Toneladas
  userId: string;
  userName: string;
}

export interface PalletClassification {
  id: string;
  date: string;
  machinistId: string;
  machinistName: string;
  shiftId: string;
  shiftDescription: string;
  palletType: string;
  quantity: number;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  taxId: string;
  logo?: string;
  phone?: string;
  email?: string;
}

export interface ProductChange {
  id: string;
  date: string;
  shiftId: string;
  
  // Maquinista/Operator
  operatorId: string;
  operatorName: string;
  machineId: string; // sampling place
  
  // Checklist
  siloValveClosed: boolean;
  circuitEmptied: boolean;
  machineCleaned: boolean;
  hopperEmptied: boolean;
  siloChanged: boolean;
  setupChanged: boolean;
  packagingChanged: boolean;
  twoBigBagsPalletized: boolean;
  colorSampling: boolean;
  sampleSentToLab: boolean;
  productReleased: boolean;
  
  // Materials
  previousMaterialId: string;
  newMaterialId: string;
  changeReason: 'DEMAND' | 'OUT_OF_SPEC' | 'EMPTY_SILO' | string;
  
  // Lab Section
  labOperatorId?: string;
  labOperatorName?: string;
  calcinationLoss?: number; // %
  incorporatedAir?: number; // %
  ckPercentageByDrx?: number; // %
  approvalStatus: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  rejectionObservation?: string;
}

export interface UserPermission {
  viewId: string;
  label: string;
  section: 'PRODUCTIVITY' | 'ADMIN' | 'OTHER';
  level: 'NONE' | 'VIEW' | 'EDIT';
}

export interface AppUser {
  dni: string; // Key / Legajo
  name: string;
  sapUser: string;
  email: string;
  email2?: string;
  position: 'Operario Maquinista' | 'Operario Técnico' | 'Operario Autoelevador' | 'Operario Granel' | 'Operario Supervisor' | 'Operario Líbero' | 'Laboratórista' | 'Laboratorista' | 'Pasante' | 'Analista' | 'Coordinador' | 'Gerente' | 'Jefe de Área' | string;
  profile: 'Administrador' | 'Operario' | 'Técnico' | 'Administrativo' | 'Supervisor' | 'Laboratorio';
  permissions: UserPermission[];
}

export interface UserContext {
  role: 'OPERARIO' | 'ADMIN';
  selectedPalletizerId: string | null;
  selectedShiftId: string | null;
  selectedDate: string; // ISO date string YYYY-MM-DD
  currentUserDni: string;
}

export interface LoadingPoint {
  id: string;
  name: string;
  type: 'BOLSA' | 'GRANEL';
  materialIds?: string[];
}

export interface LaneShiftStatus {
  id: string;
  date: string;
  shiftId: string;
  loadingPointId: string;
  isEnabled: boolean;
  materialIds: string[]; // Materiales que se están cargando
  observation?: string;   // Motivo si no está habilitada
}

export interface DispatchEntry {
  id: string;
  date: string;
  shiftId: string;
  shiftDescription?: string;
  materialId: string;
  materialDescription?: string;
  tons: number;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface BagSupplier {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
}

export interface Vehicle {
  id: string;
  marca: string;
  identificación: string;
  tipo: string;
  carga_maxima: string;
}

export interface FuelLoad {
  id: string;
  unidad_movil: string;
  id_operario: string;
  descripcion_operario: string;
  litros_combustible: number;
  date: string;
  shiftId: string;
}

export interface AlertNotification {
  id: string;
  type: 'NEW_PRODUCT_CHANGE' | 'LAB_ANALYSIS_COMPLETED';
  date: string;
  title: string;
  message: string;
  isReadByUsers: string[]; // List of user DNIs who have marked this notification as read
  targetProfile: 'Laboratorio' | 'Operario' | 'Administrador' | string;
  targetDni?: string; // Optional specific user DNI
  createdAt: string;
  relatedId?: string; // productChange ID
}

export interface ScaleParameter {
  id: string;
  positiveBiasTolerance: number;
  negativeBiasTolerance: number;
  positiveRangeTolerance: number;
  negativeRangeTolerance: number;
  modificationHistory?: any[] | string;
}

export interface MasterData {
  palletizers: Machine[];
  baggers: Machine[];
  materials: Material[];
  hacs: HAC[];
  causes: Cause[];
  shifts: Shift[];
  capacities: CapacityBDP[];
  users: AppUser[];
  companies: Company[];
  loadingPoints: LoadingPoint[];
  bagSuppliers: BagSupplier[];
  vehicles: Vehicle[];
  scaleParameters?: ScaleParameter[];
}
