export type Role = 
  | 'ADMIN' 
  | 'SOLICITANTE' 
  | 'SOLO_LECTURA_APROBADAS' 
  | 'JEFE' 
  | 'FINANZAS' 
  | 'EMPLEADO' 
  | string;

export type Status = 
  | 'BORRADOR' 
  | 'PENDIENTE_APROBACION' 
  | 'APROBADA' 
  | 'RECHAZADA' 
  | 'CANCELADA'
  | 'CORRECCION_SOLICITADA' 
  | 'PAGADA' 
  | 'COMPROBADA'
  | 'FINALIZADA';

export type UserStatus = 'ACTIVO' | 'INACTIVO';

export type Permission =
  | 'ver_solicitudes' | 'crear_solicitudes' | 'editar_solicitudes' | 'cancelar_solicitudes' | 'aprobar_solicitudes' | 'ver_todas_solicitudes' | 'administrar_usuarios' | 'administrar_departamentos' | 'administrar_jefes' | 'administrar_roles' | 'ver_reportes' | 'administrar_configuracion';

export interface RoleDefinition { id:string; name:string; description?:string; permissions:Permission[]; active:boolean; isSystem?:boolean; }
export interface Department { id:string; name:string; description?:string; active:boolean; createdAt?:string; }
export interface Boss { id:string; name:string; email:string; department:string; active:boolean; createdAt?:string; }
export interface User { id:string; name:string; email:string; department:string; role:Role; roleId?:string; roleIds?:string[]; roles?:RoleDefinition[]; permissions?:Permission[]; status:UserStatus; isVerified?:boolean; avatar?:string; createdAt?:string; }

const LEGACY_ROLE_IDS:Record<string,string>={ADMIN:'role_admin',ADMINISTRADOR:'role_admin',JEFE:'role_jefe',FINANZAS:'role_finanzas',SOLO_LECTURA_APROBADAS:'role_solo_lectura',SOLICITANTE:'role_solicitante',EMPLEADO:'role_empleado'};
export function getUserRoleIds(user?:User|null):string[]{if(!user)return[];const ids=[...(Array.isArray(user.roleIds)?user.roleIds:[]),...(Array.isArray(user.roles)?user.roles.map(role=>role.id):[]),user.roleId,LEGACY_ROLE_IDS[String(user.role||'').toUpperCase()]];return Array.from(new Set(ids.map(id=>String(id||'').trim()).filter(Boolean)));}
export function userHasRole(user:User|null|undefined,role:Role):boolean{if(!user)return false;const wantedName=String(role||'').trim().toUpperCase();const wantedId=LEGACY_ROLE_IDS[wantedName]||String(role||'').trim();const currentRole=String(user.role||'').toUpperCase();if(currentRole===wantedName)return true;if((wantedName==='ADMIN'||wantedName==='ADMINISTRADOR')&&(currentRole==='ADMIN'||currentRole==='ADMINISTRADOR'))return true;if(getUserRoleIds(user).includes(wantedId))return true;return Boolean(user.roles?.some(r=>String(r.name||'').trim().toUpperCase()===wantedName||r.id===wantedId));}
export function userHasAnyRole(user:User|null|undefined,roles:Role[]):boolean{return roles.some(role=>userHasRole(user,role));}
export function userHasPermission(user:User|null|undefined,permission:Permission):boolean{if(!user)return false;if(userHasRole(user,'ADMIN'))return true;return Array.isArray(user.permissions)&&user.permissions.includes(permission);}
export interface StoredUserRecord extends User { passwordHash?:string; salt?:string; }
export interface VerificationRecord { email:string; code:string; name:string; department:string; roleId:string; passwordHash:string; salt:string; expiresAt:number; attempts:number; }
export interface ApprovalToken { id:string; token:string; requestId:string; bossId?:string; bossEmail:string; expiresAt:string; used:boolean; usedAt?:string; action?:'APROBADA'|'RECHAZADA'; createdAt:string; }
export interface TravelRequest { id:string; folio:string; status:Status; userId:string; user?:User; requesterName?:string; department?:string; requestType?:string; detail?:string; requestDate?:string; depositDate?:string; urgency?:'baja'|'media'|'alta'|string; bossId?:string; bossEmail:string; bossName?:string; startDate:string; endDate:string; destination:string; reason:string; amountRequested:number; amountAuthorized?:number|null; transportCost?:number; hotelCost?:number; foodCost?:number; miscCost?:number; comments?:string|null; approvalToken?:string; approvedBy?:string; approvedAt?:string; rejectedBy?:string; rejectedAt?:string; rejectionReason?:string; createdAt:string; updatedAt?:string; }
export interface AuditLog { id:string; requestId?:string|null; userId:string; userEmail?:string; userName?:string; action:string; details?:Record<string,any>|null; createdAt:string; }
export interface EmailLog { id:string; requestId?:string; folio?:string; to:string; subject:string; html:string; status:'ENVIADO'|'SIMULADO'|'FALLIDO'; error?:string; createdAt:string; }
export interface SystemStats { totalRequests:number; pendingApproval:number; approved:number; paid:number; rejected:number; correctionRequested:number; totalAmountRequested:number; totalAmountAuthorized:number; totalUsers?:number; totalDepartments?:number; totalBosses?:number; totalRoles?:number; }

export type ExpenseType = 'FACTURA' | 'TICKET' | 'PENDIENTE';

export type PaymentMethodType =
  | 'ANTICIPO'
  | 'TARJETA_EMPRESA'
  | 'PERSONAL_REEMBOLSO';

export type ExpenseCategoryType =
  | 'HOSPEDAJE'
  | 'GASOLINA'
  | 'CASETAS'
  | 'TRANSPORTE_FORANEO'
  | 'TRANSPORTE_LOCAL'
  | 'ALIMENTOS'
  | 'ESTACIONAMIENTO'
  | 'GASTOS_MENORES';

export interface ExpenseDocumentCandidate {
  method: 'xml' | 'qr' | 'texto_pdf' | 'llm' | 'ocr' | 'pdf_local';
  total: number | null;
}

export interface ExpenseDocumentDetail {
  subtotal?: number | null;
  iva?: number | null;
  propina?: number | null;
  moneda?: string | null;
  fecha?: string | null;
  emisor?: string | null;
  uuid?: string | null;
}

export interface ExpenseDocumentAnalysis {
  status: 'DETECTADO' | 'SIN_TOTAL' | 'NO_DISPONIBLE' | 'ERROR';
  amount?: number;
  documentType?: 'FACTURA' | 'TICKET' | 'OTRO';
  confidence?: 'ALTA' | 'MEDIA' | 'BAJA';
  source: 'XML' | 'GEMINI' | 'PDF_LOCAL' | 'NINGUNO';
  includedInTotal: boolean;
  requiresReview?: boolean;
  candidates?: ExpenseDocumentCandidate[];
  detail?: ExpenseDocumentDetail;
  analyzedAt: string;
  error?: string;
}

export interface ExpenseFileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
  uuid?: string;
  role?: 'COMPROBANTE_PRINCIPAL' | 'COMPLEMENTO_FISCAL' | 'DOCUMENTO_ORIGINAL_EXCEL';
  analysis?: ExpenseDocumentAnalysis;
  /** Importe capturado manualmente cuando el documento no tiene un XML CFDI utilizable. */
  manualAmount?: number | null;
}

export interface ExpenseItem {
  id: string;
  concept: string;
  amount: number;
  type: ExpenseType;
  expenseDate: string;
  category?: ExpenseCategoryType;
  paymentMethod?: PaymentMethodType;
  sourceCategory?: string;
  importedFromExcel?: boolean;
  excelRowIndex?: number;
  xmlFile?: ExpenseFileAttachment;
  pdfFile?: ExpenseFileAttachment;
  ticketFile?: ExpenseFileAttachment;
  notes?: string;
  createdAt: string;
}

export interface ExcelAuditSummary {
  filename: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy?: string;
  sheetName: string;
  totalExcel: number;
  totalImported: number;
  difference: number;
  itemsCount: number;
  reconciliationStatus: 'CONCILIACION_CORRECTA' | 'DIFERENCIA_DETECTADA';
}

export interface ExcelParsedExpense {
  id: string;
  concept: string;
  sourceCategory: string;
  amount: number;
  expenseDate: string;
  category?: ExpenseCategoryType;
  paymentMethod?: PaymentMethodType;
  sectionTitle?: string;
  excelCellRef?: string;
  isOutOfRange?: boolean;
}

export interface ExpenseRefund {
  amount: number;
  method: 'SPEI' | 'EFECTIVO';
  reference: string;
  refundDate: string;
  receiptFile?: ExpenseFileAttachment;
  signedReceiptFile?: ExpenseFileAttachment;
  notes?: string;
  registeredAt: string;
}

export interface ExpenseVerification {
  id: string;
  requestId: string;
  folio: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  department?: string;
  destination?: string;
  status: 'BORRADOR' | 'ENVIADA';
  items: ExpenseItem[];
  totalAmountPaid: number;
  totalExpenses: number;
  totalAnticipo?: number;
  totalTarjetaEmpresa?: number;
  totalPersonal?: number;
  saldoAnticipoAntesReintegro?: number;
  saldoPendienteDevolucion?: number;
  saldoFavorColaborador?: number;
  financialStatus?: 'CUENTA_SALDADA' | 'SOBRANTE_PENDIENTE' | 'FAVOR_COLABORADOR';
  difference: number;
  balanceType: 'FAVOR_EMPRESA' | 'FAVOR_COLABORADOR' | 'EXACTO';
  balanceAmount: number;
  refund?: ExpenseRefund;
  pendingFiscalXmls?: ExpenseFileAttachment[];
  supportFiles?: ExpenseFileAttachment[];
  originalExcelFile?: ExpenseFileAttachment;
  excelAuditSummary?: ExcelAuditSummary;
  notes?: string;
  submittedAt?: string;
  updatedAt: string;
  createdAt: string;
}
