-- Forward-only hardening of the unreleased DEC-046 implementation.
-- Retain the already exercised migration checksum and every historical effect.
CREATE OR REPLACE FUNCTION erp_transfer_has_permission(actor uuid, company uuid, capability text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN companies c ON c.id=u.company_id AND c.is_active JOIN employees e ON e.id=u.employee_id AND e.company_id=u.company_id AND e.is_active
 JOIN user_roles ur ON ur.user_id=u.id AND ur.company_id=u.company_id
 JOIN roles r ON r.id=ur.role_id AND r.company_id=u.company_id AND r.is_active
 JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
 WHERE u.id=actor AND u.company_id=company AND u.is_active AND p.permission_code=capability)
$$;

CREATE FUNCTION erp_transfer_enabled_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.stock_transfer_id)
  AND NOT EXISTS(SELECT 1 FROM transfer_project_policies p JOIN stock_transfers t ON t.company_id=p.company_id WHERE t.id=NEW.stock_transfer_id AND p.project_id=NEW.source_project_id)
 THEN RAISE EXCEPTION 'TRANSFER_ALL_SOURCES_MUST_BE_ENABLED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_enabled_source_guard BEFORE INSERT OR UPDATE ON stock_transfer_items FOR EACH ROW EXECUTE FUNCTION erp_transfer_enabled_source_guard();

CREATE FUNCTION erp_transfer_new_source_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid uuid; t stock_transfers;
BEGIN
 IF TG_TABLE_NAME='stock_transfers' THEN tid=NEW.id; ELSE tid=NEW.stock_transfer_id; END IF;
 SELECT * INTO t FROM stock_transfers WHERE id=tid;
 -- Only a newly created transfer in this transaction is controlled by enablement.
 IF t.created_at>=transaction_timestamp() AND EXISTS(SELECT 1 FROM stock_transfer_items i JOIN transfer_project_policies p ON p.project_id=i.source_project_id AND p.company_id=t.company_id WHERE i.stock_transfer_id=tid)
 AND NOT EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=tid AND company_id=t.company_id) THEN RAISE EXCEPTION 'TRANSFER_NEW_PROVENANCE_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER transfer_new_header_proof AFTER INSERT ON stock_transfers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_new_source_proof();
CREATE CONSTRAINT TRIGGER transfer_new_line_proof AFTER INSERT ON stock_transfer_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_new_source_proof();

CREATE FUNCTION erp_transfer_effect_event_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid uuid; c transfer_custodies; v jsonb=to_jsonb(NEW);
BEGIN
 tid=NEW.transfer_id;
 SELECT * INTO c FROM transfer_custodies WHERE transfer_id=tid;
 IF TG_TABLE_NAME='transfer_dispatches' AND NOT EXISTS(SELECT 1 FROM transfer_custody_events WHERE transfer_id=tid AND action='DISPATCH' AND actor_user_id=(v->>'actor_user_id')::uuid AND reason=v->>'reason') THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EVENT_REQUIRED'; END IF;
 IF TG_TABLE_NAME='transfer_receiver_assignments' AND NOT EXISTS(SELECT 1 FROM transfer_custody_events WHERE transfer_id=tid AND version=(v->>'version')::integer AND action='ASSIGN' AND actor_user_id=(v->>'actor_user_id')::uuid AND reason=v->>'reason') THEN RAISE EXCEPTION 'TRANSFER_ASSIGNMENT_EVENT_REQUIRED'; END IF;
 IF TG_TABLE_NAME='transfer_receipts' THEN
  IF (SELECT count(*) FROM transfer_custody_events WHERE transfer_id=tid AND action='PREPARE_RECEIPT')<>(SELECT count(*) FROM transfer_receipts WHERE transfer_id=tid) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EVENT_REQUIRED'; END IF;
  IF (SELECT count(*) FROM transfer_custody_events WHERE transfer_id=tid AND action='RECEIVE')<>(SELECT count(*) FROM transfer_receipts WHERE transfer_id=tid AND posted_at IS NOT NULL) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EVENT_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER transfer_dispatch_event_proof AFTER INSERT ON transfer_dispatches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_effect_event_proof();
CREATE CONSTRAINT TRIGGER transfer_assignment_event_proof AFTER INSERT ON transfer_receiver_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_effect_event_proof();
CREATE CONSTRAINT TRIGGER transfer_receipt_event_proof AFTER INSERT OR UPDATE ON transfer_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_effect_event_proof();

CREATE OR REPLACE FUNCTION erp_transfer_document_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did uuid;
BEGIN
 did=COALESCE((to_jsonb(OLD)->>'document_id')::uuid,(to_jsonb(OLD)->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM transfer_receipts WHERE document_id=did AND posted_at IS NOT NULL) AND (
  TG_OP='DELETE' OR TG_TABLE_NAME='document_links' OR
  (to_jsonb(NEW)-'is_active'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'is_active'-'updated_at')) THEN RAISE EXCEPTION 'TRANSFER_EVIDENCE_HISTORY_IMMUTABLE'; END IF;
 RETURN COALESCE(NEW,OLD);
END $$;

DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='transfer_operations'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%action%'
 LOOP EXECUTE format('ALTER TABLE transfer_operations DROP CONSTRAINT %I',c.conname); END LOOP;
END $$;
ALTER TABLE transfer_operations ADD CONSTRAINT transfer_operations_shape CHECK(body_digest ~ '^[0-9a-f]{64}$' AND action IN ('ENABLE','APPROVE','DISPATCH','ASSIGN','PREPARE_RECEIPT','RECEIVE'));
