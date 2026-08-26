import { supabase } from './supabase';

/**
 * One-time-safe bootstrap for the initial application data.
 * Uses upsert by primary key and respects FK order.
 */
let seedPromise: Promise<void> | null = null;

const permissions = [
  'ver_solicitudes','crear_solicitudes','editar_solicitudes','cancelar_solicitudes',
  'aprobar_solicitudes','ver_todas_solicitudes','administrar_usuarios',
  'administrar_departamentos','administrar_jefes','administrar_roles',
  'ver_reportes','administrar_configuracion'
];

export async function ensureSupabaseSeed(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const { count, error: countError } = await supabase
      .from('roles').select('id', { count: 'exact', head: true });
    if (countError) throw new Error(`Supabase seed: no se pudo consultar roles: ${countError.message}`);
    if ((count ?? 0) > 0) return;

    const roles = [
      { id:'role_admin', name:'Administrador', description:'Acceso total al sistema, gestión de usuarios, roles, departamentos y auditoría.', active:true, is_system:true, permissions },
      { id:'role_solicitante', name:'Solicitante', description:'Puede crear nuevas solicitudes y consultar exclusivamente sus propias solicitudes y su estatus.', active:true, is_system:true, permissions:['ver_solicitudes','crear_solicitudes','editar_solicitudes','cancelar_solicitudes'] },
      { id:'role_solo_lectura', name:'Solo Lectura de Aprobadas', description:'Acceso de consulta exclusivo para visualizar solicitudes que ya fueron aprobadas en la empresa.', active:true, is_system:true, permissions:['ver_solicitudes','ver_todas_solicitudes'] },
      { id:'role_jefe', name:'Jefe / Aprobador', description:'Autorización y dictamen de solicitudes de colaboradores a su cargo.', active:true, is_system:true, permissions:['ver_solicitudes','crear_solicitudes','editar_solicitudes','aprobar_solicitudes','ver_todas_solicitudes'] },
      { id:'role_finanzas', name:'Finanzas / Tesorería', description:'Revisión de solicitudes aprobadas, dispersión de transferencias SPEI y emisión de pólizas.', active:true, is_system:true, permissions:['ver_solicitudes','ver_todas_solicitudes','ver_reportes'] }
    ];
    const departments = [
      ['dept_sistemas','Sistemas','Tecnología, Infraestructura y Soporte TI'],
      ['dept_finanzas','Finanzas','Tesorería, Contabilidad y Pólizas'],
      ['dept_rh','Recursos Humanos','Gestión de Talento y Desarrollo Organizacional'],
      ['dept_produccion','Producción','Manufactura, Operaciones y Planta'],
      ['dept_compras','Compras','Adquisiciones y Proveedores'],
      ['dept_ventas','Ventas','Comercialización, Proyectos y Cuentas Clave']
    ].map(([id,name,description]) => ({ id,name,description,active:true,created_at:'2026-01-01T00:00:00.000Z' }));
    const bosses = [{ id:'boss_sistemas', name:'Ing. Roberto Flores / Autorizaciones TI', email:'sistemas@dimer.com.mx', department:'Sistemas', active:true, created_at:'2026-01-01T00:00:00.000Z' }];
    const users = [
      {id:'usr_adm_1',name:'Ing. Sistemas Admin',email:'sistemas@dimer.com.mx',role:'ADMIN',role_id:'role_admin',department:'Sistemas',status:'ACTIVO',is_verified:true,password_hash:'6eed94be6945acc3eb56eb4ff4c69cbf84918f3ffb41f5117d2dc35a18eed01dd9b800ff40bdf5dfd9b63132a5e9dc0ea51c1e58ff0591b48d08d6786d6edb91',salt:'dd7bdc4663c5af5bf7568b3441b22ae1',created_at:'2026-01-01T00:00:00.000Z'},
      {id:'usr_sol_1',name:'Roberto Lozano (Solicitante)',email:'roberto.lozano@dimer.com.mx',role:'SOLICITANTE',role_id:'role_solicitante',department:'Sistemas',status:'ACTIVO',is_verified:true,password_hash:'1a8bc4a5a7aebaef93b008de2a239b13c13767d13c1408c793695f9144ee6d9878aa1e2d2ff28f97279252abecdb495dc5406883995d5121363484d8dbba4059',salt:'ffdff96d8a67da1bca99f7d49301cb22',created_at:'2026-01-01T00:00:00.000Z'},
      {id:'usr_fin_1',name:'CP. Laura Finanzas (Tesorería)',email:'finanzas@dimer.com.mx',role:'FINANZAS',role_id:'role_finanzas',department:'Finanzas',status:'ACTIVO',is_verified:true,password_hash:'1a8bc4a5a7aebaef93b008de2a239b13c13767d13c1408c793695f9144ee6d9878aa1e2d2ff28f97279252abecdb495dc5406883995d5121363484d8dbba4059',salt:'ffdff96d8a67da1bca99f7d49301cb22',created_at:'2026-01-01T00:00:00.000Z'},
      {id:'usr_lec_1',name:'Lic. Auditoria (Solo Lectura Aprobadas)',email:'auditoria@dimer.com.mx',role:'SOLO_LECTURA_APROBADAS',role_id:'role_solo_lectura',department:'Dirección',status:'ACTIVO',is_verified:true,password_hash:'1a8bc4a5a7aebaef93b008de2a239b13c13767d13c1408c793695f9144ee6d9878aa1e2d2ff28f97279252abecdb495dc5406883995d5121363484d8dbba4059',salt:'ffdff96d8a67da1bca99f7d49301cb22',created_at:'2026-01-01T00:00:00.000Z'}
    ];
    const requests = [
      {id:'req_001',folio:'VIAT-2026-000001',status:'PENDIENTE_APROBACION',user_id:'usr_sol_1',requester_name:'Roberto Lozano',department:'Sistemas',request_type:'Viáticos y Gastos de Viaje',detail:'Reunión de cierre con cliente industrial para proyecto de automatización y auditoría en planta.',request_date:'2026-08-21',urgency:'alta',boss_id:'boss_sistemas',boss_email:'sistemas@dimer.com.mx',boss_name:'Ing. Roberto Flores / Autorizaciones TI',start_date:'2026-08-25T00:00:00.000Z',end_date:'2026-08-28T00:00:00.000Z',destination:'Monterrey, N.L.',reason:'Reunión de cierre con cliente industrial para proyecto de automatización y auditoría en planta.',amount_requested:14850,amount_authorized:null,transport_cost:5000,hotel_cost:6000,food_cost:3000,misc_cost:850,comments:'Incluye vuelos, 3 noches de hospedaje en zona San Pedro y viáticos diarios según tabulador.',created_at:'2026-08-21T09:30:00.000Z',approval_token:null},
      {id:'req_002',folio:'VIAT-2026-000002',status:'APROBADA',user_id:'usr_sol_1',requester_name:'Roberto Lozano',department:'Sistemas',request_type:'Viáticos y Gastos de Viaje',detail:'Participación en Expo Industrial 2026 y visitas técnicas a socios estratégicos.',request_date:'2026-08-20',urgency:'media',boss_id:'boss_sistemas',boss_email:'sistemas@dimer.com.mx',boss_name:'Ing. Roberto Flores / Autorizaciones TI',start_date:'2026-09-02T00:00:00.000Z',end_date:'2026-09-04T00:00:00.000Z',destination:'Guadalajara, Jal.',reason:'Participación en Expo Industrial 2026 y visitas técnicas a socios estratégicos.',amount_requested:12000,amount_authorized:11000,transport_cost:4000,hotel_cost:4500,food_cost:2500,misc_cost:1000,comments:'Aprobado con ajuste de $1,000 en hotel corporativo con convenio.',approved_by:'sistemas@dimer.com.mx',approved_at:'2026-08-20T16:45:00.000Z',created_at:'2026-08-20T14:15:00.000Z',approval_token:null},
      {id:'req_003',folio:'VIAT-2026-000003',status:'PAGADA',user_id:'usr_sol_1',requester_name:'Roberto Lozano',department:'Sistemas',request_type:'Servicios y Mantenimiento',detail:'Instalación de servidores y entrega de infraestructura en nuevo centro logístico.',request_date:'2026-08-08',urgency:'baja',boss_id:'boss_sistemas',boss_email:'sistemas@dimer.com.mx',boss_name:'Ing. Roberto Flores / Autorizaciones TI',start_date:'2026-08-10T00:00:00.000Z',end_date:'2026-08-12T00:00:00.000Z',destination:'Querétaro, Qro.',reason:'Instalación de servidores y entrega de infraestructura en nuevo centro logístico.',amount_requested:8500,amount_authorized:8500,comments:'Dispersado vía transferencia SPEI folio 89123.',approved_by:'sistemas@dimer.com.mx',approved_at:'2026-08-08T15:20:00.000Z',created_at:'2026-08-08T11:00:00.000Z',approval_token:null}
    ];
    const tokens = [{id:'tok_init_1',token:'tok_seed_req_001_sistemas',request_id:'req_001',boss_id:'boss_sistemas',boss_email:'sistemas@dimer.com.mx',expires_at:'2026-09-02T13:10:00.128Z',used:false,created_at:'2026-08-21T09:30:00.000Z',used_at:null,action:null}];
    const audits = [
      {id:'aud_001',request_id:'req_003',user_id:'usr_sol_1',user_name:'Roberto Lozano (Solicitante)',user_email:'roberto.lozano@dimer.com.mx',action:'CREACION_SOLICITUD',details:{folio:'VIAT-2026-000003',amountRequested:8500,destination:'Querétaro, Qro.',bossEmail:'sistemas@dimer.com.mx'},created_at:'2026-08-08T11:00:00.000Z'},
      {id:'aud_002',request_id:'req_003',user_id:'usr_adm_1',user_name:'Ing. Roberto Flores / Autorizaciones TI',user_email:'sistemas@dimer.com.mx',action:'APROBACION_JEFE',details:{folio:'VIAT-2026-000003',amountAuthorized:8500,comments:'Aprobado sin observaciones'},created_at:'2026-08-08T15:20:00.000Z'},
      {id:'aud_003',request_id:'req_003',user_id:'usr_fin_1',user_name:'CP. Laura Finanzas (Tesorería)',user_email:'finanzas@dimer.com.mx',action:'DISPERSION_PAGO',details:{folio:'VIAT-2026-000003',amountPaid:8500,reference:'SPEI-89123'},created_at:'2026-08-09T10:00:00.000Z'},
      {id:'aud_004',request_id:'req_002',user_id:'usr_sol_1',user_name:'Roberto Lozano (Solicitante)',user_email:'roberto.lozano@dimer.com.mx',action:'CREACION_SOLICITUD',details:{folio:'VIAT-2026-000002',amountRequested:12000,destination:'Guadalajara, Jal.',bossEmail:'sistemas@dimer.com.mx'},created_at:'2026-08-20T14:15:00.000Z'},
      {id:'aud_005',request_id:'req_002',user_id:'usr_adm_1',user_name:'Ing. Roberto Flores / Autorizaciones TI',user_email:'sistemas@dimer.com.mx',action:'APROBACION_JEFE',details:{folio:'VIAT-2026-000002',amountRequested:12000,amountAuthorized:11000,adjustment:-1000},created_at:'2026-08-20T16:45:00.000Z'},
      {id:'aud_006',request_id:'req_001',user_id:'usr_sol_1',user_name:'Roberto Lozano (Solicitante)',user_email:'roberto.lozano@dimer.com.mx',action:'CREACION_SOLICITUD',details:{folio:'VIAT-2026-000001',amountRequested:14850,bossEmail:'sistemas@dimer.com.mx'},created_at:'2026-08-21T09:30:00.000Z'}
    ];

    const steps: Array<[string, any[]]> = [
      ['roles', roles], ['departments', departments], ['bosses', bosses], ['users', users],
      ['travel_requests', requests], ['approval_tokens', tokens], ['audit_logs', audits]
    ];
    for (const [table, rows] of steps) {
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw new Error(`Supabase seed ${table}: ${error.message}`);
    }
    console.log('[DIMER DB] Supabase seed completado: 7 tablas inicializadas.');
  })().catch(err => { seedPromise = null; throw err; });
  return seedPromise;
}
