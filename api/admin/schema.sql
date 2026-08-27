-- DIMER VIATICOS - CANONICAL PRODUCTION SCHEMA
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,role TEXT NOT NULL DEFAULT 'SOLICITANTE',role_id TEXT,department TEXT,status TEXT NOT NULL DEFAULT 'ACTIVO',is_verified BOOLEAN NOT NULL DEFAULT true,password_hash TEXT NOT NULL,salt TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,description TEXT,active BOOLEAN NOT NULL DEFAULT true,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS bosses (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,department TEXT,active BOOLEAN NOT NULL DEFAULT true,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,description TEXT,active BOOLEAN NOT NULL DEFAULT true,is_system BOOLEAN NOT NULL DEFAULT false,permissions JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS travel_requests (id TEXT PRIMARY KEY,folio TEXT UNIQUE NOT NULL,status TEXT NOT NULL DEFAULT 'PENDIENTE',user_id TEXT,requester_name TEXT,department TEXT,request_type TEXT,detail TEXT,request_date DATE,urgency TEXT,boss_id TEXT,boss_email TEXT,boss_name TEXT,start_date TIMESTAMPTZ,end_date TIMESTAMPTZ,destination TEXT,reason TEXT,amount_requested NUMERIC,amount_authorized NUMERIC,transport_cost NUMERIC,hotel_cost NUMERIC,food_cost NUMERIC,misc_cost NUMERIC,comments TEXT,approved_by TEXT,approved_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),approval_token TEXT,rejected_by TEXT,rejected_at TIMESTAMPTZ,rejection_reason TEXT,updated_at TIMESTAMPTZ);
ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS approval_token TEXT; ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS rejected_by TEXT; ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ; ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT; ALTER TABLE travel_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_requests_folio ON travel_requests(folio); CREATE INDEX IF NOT EXISTS idx_requests_user ON travel_requests(user_id); CREATE INDEX IF NOT EXISTS idx_requests_status ON travel_requests(status);
CREATE TABLE IF NOT EXISTS approval_tokens (id TEXT PRIMARY KEY,token TEXT UNIQUE NOT NULL,request_id TEXT,boss_id TEXT,boss_email TEXT,expires_at TIMESTAMPTZ,used BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),used_at TIMESTAMPTZ,action TEXT);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON approval_tokens(token); CREATE INDEX IF NOT EXISTS idx_tokens_request ON approval_tokens(request_id);
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY,request_id TEXT,user_id TEXT,user_name TEXT,user_email TEXT,action TEXT NOT NULL,details JSONB,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_audit_request ON audit_logs(request_id); CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id); CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE TABLE IF NOT EXISTS travel_folio_counters (year INTEGER PRIMARY KEY,last_number BIGINT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS verification_codes (email TEXT PRIMARY KEY,code TEXT NOT NULL,name TEXT NOT NULL,department TEXT NOT NULL,role_id TEXT NOT NULL DEFAULT 'role_solicitante',password_hash TEXT NOT NULL,salt TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE OR REPLACE FUNCTION generate_next_travel_folio(target_year INTEGER) RETURNS TEXT LANGUAGE plpgsql AS $$ DECLARE n BIGINT; BEGIN INSERT INTO travel_folio_counters(year,last_number) VALUES(target_year,1) ON CONFLICT(year) DO UPDATE SET last_number=travel_folio_counters.last_number+1 RETURNING last_number INTO n; RETURN 'VIAT-'||target_year||'-'||LPAD(n::TEXT,6,'0'); END; $$;

CREATE OR REPLACE FUNCTION process_approval_token_action(p_token TEXT,p_action TEXT,p_amount_authorized NUMERIC DEFAULT NULL,p_comments TEXT DEFAULT NULL) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t approval_tokens%ROWTYPE; r travel_requests%ROWTYPE; u users%ROWTYPE; now_ts TIMESTAMPTZ:=NOW(); a TEXT:=UPPER(TRIM(p_action)); final_amount NUMERIC;
BEGIN
 IF a NOT IN ('APROBADA','RECHAZADA') THEN RAISE EXCEPTION 'Acción inválida'; END IF;
 SELECT * INTO t FROM approval_tokens WHERE token=TRIM(p_token) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Token de autorización inválido o no encontrado'; END IF;
 IF t.expires_at IS NOT NULL AND t.expires_at<now_ts THEN RAISE EXCEPTION 'Este enlace de autorización ha expirado'; END IF;
 IF t.used THEN RAISE EXCEPTION 'Este enlace ya fue utilizado previamente para %',COALESCE(t.action,'procesar'); END IF;
 SELECT * INTO r FROM travel_requests WHERE id=t.request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró la solicitud asociada al token'; END IF;
 IF r.status NOT IN ('PENDIENTE','PENDIENTE_APROBACION') THEN RAISE EXCEPTION 'La solicitud % ya fue procesada y está en estado %',r.folio,r.status; END IF;
 UPDATE approval_tokens SET used=true,used_at=now_ts,action=a WHERE id=t.id;
 IF a='APROBADA' THEN final_amount:=COALESCE(p_amount_authorized,r.amount_requested); UPDATE travel_requests SET status='APROBADA',amount_authorized=final_amount,comments=COALESCE(p_comments,comments),approved_by=COALESCE(t.boss_email,'Jefe Directo'),approved_at=now_ts,updated_at=now_ts WHERE id=r.id RETURNING * INTO r;
 ELSE UPDATE travel_requests SET status='RECHAZADA',comments=COALESCE(p_comments,comments),rejected_by=t.boss_email,rejected_at=now_ts,rejection_reason=COALESCE(p_comments,rejection_reason),updated_at=now_ts WHERE id=r.id RETURNING * INTO r; END IF;
 SELECT * INTO u FROM users WHERE id=r.user_id;
 INSERT INTO audit_logs(id,request_id,user_id,user_name,user_email,action,details,created_at) VALUES('aud_'||extract(epoch from now_ts)::text||'_'||substr(md5(random()::text),1,8),r.id,COALESCE(t.boss_id,'token_auth'),COALESCE(u.name,'Aprobador por token'),COALESCE(t.boss_email,''),CASE WHEN a='APROBADA' THEN 'APROBACION_VIA_TOKEN_TRANSACTIONAL' ELSE 'RECHAZO_VIA_TOKEN_TRANSACTIONAL' END,jsonb_build_object('folio',r.folio,'bossEmail',t.boss_email,'action',a,'amountAuthorized',r.amount_authorized,'comments',p_comments),now_ts);
 RETURN jsonb_build_object('success',true,'action',a,'requestId',r.id,'folio',r.folio,'userId',r.user_id,'requesterName',r.requester_name,'requesterEmail',u.email,'department',r.department,'destination',r.destination,'reason',r.reason,'amountRequested',r.amount_requested,'amountAuthorized',r.amount_authorized,'bossEmail',t.boss_email,'comments',r.comments,'approvedAt',r.approved_at,'processedAt',now_ts);
END; $$;
