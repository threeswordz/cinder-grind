-- DropIndex
DROP INDEX "stock_transactions_transfer_item_movement_key";

-- AlterTable
ALTER TABLE "stock_transactions" ADD COLUMN     "transfer_receipt_line_id" UUID;

-- CreateTable
CREATE TABLE "transfer_project_policies" (
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "enabled_by_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "synthetic_only" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_project_policies_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "transfer_custodies" (
    "transfer_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_custodies_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateTable
CREATE TABLE "transfer_dispatches" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_receiver_assignments" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_receiver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_receipts" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "document_id" UUID,
    "checksum" VARCHAR(64),
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_receipt_lines" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "transfer_item_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "transfer_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_custody_events" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "reason" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_custody_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "transfer_id" UUID,
    "project_id" UUID,
    "action" VARCHAR(40) NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfer_dispatches_transfer_id_key" ON "transfer_dispatches"("transfer_id");

-- CreateIndex
CREATE INDEX "transfer_receiver_assignments_transfer_id_project_id_versio_idx" ON "transfer_receiver_assignments"("transfer_id", "project_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_receiver_assignments_transfer_id_version_key" ON "transfer_receiver_assignments"("transfer_id", "version");

-- CreateIndex
CREATE INDEX "transfer_receipts_transfer_id_project_id_created_at_idx" ON "transfer_receipts"("transfer_id", "project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_receipt_lines_receipt_id_transfer_item_id_key" ON "transfer_receipt_lines"("receipt_id", "transfer_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_custody_events_transfer_id_version_key" ON "transfer_custody_events"("transfer_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_operations_company_id_actor_user_id_request_key_key" ON "transfer_operations"("company_id", "actor_user_id", "request_key");

-- CreateIndex
CREATE INDEX "stock_transactions_stock_transfer_item_id_movement_type_idx" ON "stock_transactions"("stock_transfer_item_id", "movement_type");

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_transfer_receipt_line_id_fkey" FOREIGN KEY ("transfer_receipt_line_id") REFERENCES "transfer_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transfer_dispatches" ADD CONSTRAINT "transfer_dispatches_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfer_custodies"("transfer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transfer_receiver_assignments" ADD CONSTRAINT "transfer_receiver_assignments_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfer_custodies"("transfer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transfer_receipts" ADD CONSTRAINT "transfer_receipts_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfer_custodies"("transfer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transfer_receipt_lines" ADD CONSTRAINT "transfer_receipt_lines_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "transfer_receipts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "transfer_custody_events" ADD CONSTRAINT "transfer_custody_events_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfer_custodies"("transfer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- DEC-046: explicit synthetic policy; no automatic grants or historical backfill.
ALTER TABLE transfer_project_policies
 ADD FOREIGN KEY(company_id,project_id) REFERENCES projects(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(company_id,enabled_by_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CHECK(synthetic_only AND length(btrim(reason))>0);
ALTER TABLE transfer_custodies
 ADD FOREIGN KEY(transfer_id) REFERENCES stock_transfers(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CHECK(version>0);
ALTER TABLE transfer_dispatches ADD FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT, ADD CHECK(length(btrim(reason))>0);
ALTER TABLE transfer_receiver_assignments
 ADD FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CHECK(version>1 AND length(btrim(reason))>0);
ALTER TABLE transfer_receipts
 ADD FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CHECK(length(btrim(reason))>0),
 ADD CHECK((posted_at IS NULL AND document_id IS NULL AND checksum IS NULL) OR (posted_at IS NOT NULL AND document_id IS NOT NULL AND checksum ~ '^[0-9a-f]{64}$'));
ALTER TABLE transfer_receipt_lines ADD FOREIGN KEY(transfer_item_id) REFERENCES stock_transfer_items(id) ON DELETE RESTRICT ON UPDATE RESTRICT, ADD CHECK(quantity>0 AND length(btrim(note))>0);
ALTER TABLE transfer_custody_events ADD FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CHECK(version>0 AND length(btrim(reason))>0 AND action IN ('CREATE','APPROVE','DISPATCH','ASSIGN','PREPARE_RECEIPT','RECEIVE','REVERSE'));
ALTER TABLE transfer_operations
 ADD FOREIGN KEY(company_id,actor_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(transfer_id) REFERENCES transfer_custodies(transfer_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CHECK(body_digest ~ '^[0-9a-f]{64}$' AND action IN ('ENABLE','DISPATCH','ASSIGN','PREPARE_RECEIPT','RECEIVE'));

CREATE UNIQUE INDEX stock_transactions_transfer_legacy_movement_key ON stock_transactions(stock_transfer_item_id,movement_type) WHERE transfer_receipt_line_id IS NULL;
CREATE UNIQUE INDEX stock_transactions_transfer_receipt_movement_key ON stock_transactions(transfer_receipt_line_id,movement_type) WHERE transfer_receipt_line_id IS NOT NULL;
ALTER TABLE stock_transactions ADD CHECK(transfer_receipt_line_id IS NULL OR (stock_transfer_item_id IS NOT NULL AND movement_type IN ('STOCK_TRANSFER_IN','STOCK_TRANSFER_IN_REVERSAL')));

INSERT INTO permissions(id,permission_code,module_code,description)
SELECT ('d1170010-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'inventory.transfer.'||code,'INVENTORY',label FROM (VALUES
 (1,'configure','Enable synthetic dispatch/receipt transfer policy'),
 (2,'dispatch','Dispatch approved origin stock'),
 (3,'receipt_view','View destination-scoped transfer receipts'),
 (4,'receive','Acknowledge destination stock as configured Store'),
 (5,'receive_assigned','Acknowledge stock only as explicitly assigned destination Employee'),
 (6,'assign_receiver','Explicitly assign destination receiving Employee')
) AS p(n,code,label) ON CONFLICT(permission_code) DO NOTHING;

CREATE FUNCTION erp_transfer_has_permission(actor uuid, company uuid, capability text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN employees e ON e.id=u.employee_id AND e.company_id=u.company_id AND e.is_active
 JOIN companies c ON c.id=u.company_id AND c.is_active
 JOIN user_roles ur ON ur.user_id=u.id AND ur.company_id=u.company_id
 JOIN roles r ON r.id=ur.role_id AND r.company_id=u.company_id AND r.is_active
 JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
 WHERE u.id=actor AND u.company_id=company AND u.is_active AND p.permission_code=capability)
$$;
CREATE FUNCTION erp_transfer_project_actor(actor uuid, company uuid, project uuid, capability text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT erp_transfer_has_permission(actor,company,capability) AND EXISTS(SELECT 1 FROM projects p WHERE p.id=project AND p.company_id=company AND p.is_active)
 AND (erp_transfer_has_permission(actor,company,'projects.access_all') OR EXISTS(SELECT 1 FROM users u JOIN project_members pm ON pm.employee_id=u.employee_id AND pm.is_active WHERE u.id=actor AND pm.project_id=project))
$$;
CREATE FUNCTION erp_transfer_receiver(actor uuid, transfer uuid, project uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM transfer_custodies c WHERE c.transfer_id=transfer
 AND erp_transfer_project_actor(actor,c.company_id,project,'inventory.transfer.receipt_view') AND (
 erp_transfer_has_permission(actor,c.company_id,'inventory.transfer.receive') OR (
 erp_transfer_has_permission(actor,c.company_id,'inventory.transfer.receive_assigned') AND EXISTS(
 SELECT 1 FROM users u JOIN project_members pm ON pm.employee_id=u.employee_id AND pm.is_active AND pm.project_id=project
 WHERE u.id=actor AND u.employee_id=(SELECT a.employee_id FROM transfer_receiver_assignments a WHERE a.transfer_id=transfer AND a.project_id=project ORDER BY a.version DESC LIMIT 1)))))
$$;
CREATE FUNCTION erp_transfer_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'TRANSFER_HISTORY_IMMUTABLE'; END $$;
CREATE TRIGGER transfer_policy_immutable BEFORE UPDATE OR DELETE ON transfer_project_policies FOR EACH ROW EXECUTE FUNCTION erp_transfer_immutable();
CREATE TRIGGER transfer_dispatch_immutable BEFORE UPDATE OR DELETE ON transfer_dispatches FOR EACH ROW EXECUTE FUNCTION erp_transfer_immutable();
CREATE TRIGGER transfer_assignment_immutable BEFORE UPDATE OR DELETE ON transfer_receiver_assignments FOR EACH ROW EXECUTE FUNCTION erp_transfer_immutable();
CREATE TRIGGER transfer_receipt_line_immutable BEFORE UPDATE OR DELETE ON transfer_receipt_lines FOR EACH ROW EXECUTE FUNCTION erp_transfer_immutable();
CREATE TRIGGER transfer_event_immutable BEFORE UPDATE OR DELETE ON transfer_custody_events FOR EACH ROW EXECUTE FUNCTION erp_transfer_immutable();
CREATE TRIGGER transfer_operation_immutable BEFORE UPDATE OR DELETE ON transfer_operations FOR EACH ROW EXECUTE FUNCTION erp_transfer_immutable();

CREATE FUNCTION erp_transfer_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT erp_transfer_project_actor(NEW.enabled_by_user_id,NEW.company_id,NEW.project_id,'inventory.transfer.configure') THEN RAISE EXCEPTION 'TRANSFER_POLICY_ACTOR_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_policy_guard BEFORE INSERT ON transfer_project_policies FOR EACH ROW EXECUTE FUNCTION erp_transfer_policy_guard();

CREATE FUNCTION erp_transfer_custody_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t stock_transfers;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'TRANSFER_HISTORY_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.transfer_id,NEW.company_id,NEW.created_at) IS DISTINCT FROM (OLD.transfer_id,OLD.company_id,OLD.created_at) OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'TRANSFER_VERSION_INVALID'; END IF;
 ELSE
  SELECT * INTO t FROM stock_transfers WHERE id=NEW.transfer_id;
  IF t.company_id IS DISTINCT FROM NEW.company_id OR t.submitted_at IS NOT NULL OR NEW.version<>1 OR t.created_at < transaction_timestamp()
   OR NOT EXISTS(SELECT 1 FROM stock_transfer_items WHERE stock_transfer_id=t.id)
   OR EXISTS(SELECT 1 FROM stock_transfer_items i WHERE i.stock_transfer_id=t.id AND NOT EXISTS(SELECT 1 FROM transfer_project_policies p WHERE p.project_id=i.source_project_id AND p.company_id=t.company_id))
  THEN RAISE EXCEPTION 'TRANSFER_NEW_PROVENANCE_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_custody_guard BEFORE INSERT OR UPDATE OR DELETE ON transfer_custodies FOR EACH ROW EXECUTE FUNCTION erp_transfer_custody_guard();

CREATE FUNCTION erp_transfer_dispatch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t stock_transfers; i record;
BEGIN
 SELECT * INTO t FROM stock_transfers WHERE id=NEW.transfer_id;
 IF t.posted_at IS NOT NULL OR t.reversed_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM approval_instances a WHERE a.id=t.approval_instance_id AND a.company_id=t.company_id AND a.entity_type='STOCK_TRANSFER' AND a.entity_id=t.id AND a.approval_state='APPROVED')
 THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_NOT_READY'; END IF;
 FOR i IN SELECT DISTINCT source_project_id FROM stock_transfer_items WHERE stock_transfer_id=t.id LOOP
  IF NOT erp_transfer_project_actor(NEW.actor_user_id,t.company_id,i.source_project_id,'inventory.transfer.dispatch') THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_ACTOR_INVALID'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_dispatch_guard BEFORE INSERT ON transfer_dispatches FOR EACH ROW EXECUTE FUNCTION erp_transfer_dispatch_guard();

CREATE FUNCTION erp_transfer_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE company uuid;
BEGIN
 SELECT company_id INTO company FROM transfer_custodies WHERE transfer_id=NEW.transfer_id;
 IF NOT EXISTS(SELECT 1 FROM stock_transfer_items WHERE stock_transfer_id=NEW.transfer_id AND destination_project_id=NEW.project_id)
  OR NOT erp_transfer_project_actor(NEW.actor_user_id,company,NEW.project_id,'inventory.transfer.assign_receiver')
  OR NOT EXISTS(SELECT 1 FROM users u JOIN employees e ON e.id=u.employee_id AND e.is_active AND e.company_id=company JOIN project_members pm ON pm.employee_id=e.id AND pm.is_active AND pm.project_id=NEW.project_id
   WHERE e.id=NEW.employee_id AND u.is_active AND u.company_id=company AND erp_transfer_has_permission(u.id,company,'inventory.transfer.receive_assigned') AND erp_transfer_has_permission(u.id,company,'inventory.transfer.receipt_view'))
  OR NEW.version<>(SELECT version FROM transfer_custodies WHERE transfer_id=NEW.transfer_id)
 THEN RAISE EXCEPTION 'TRANSFER_ASSIGNEE_NOT_ELIGIBLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_assignment_guard BEFORE INSERT ON transfer_receiver_assignments FOR EACH ROW EXECUTE FUNCTION erp_transfer_assignment_guard();

CREATE FUNCTION erp_transfer_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t stock_transfers;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'TRANSFER_HISTORY_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' AND (OLD.posted_at IS NOT NULL OR (NEW.id,NEW.transfer_id,NEW.project_id,NEW.created_by_user_id,NEW.created_at) IS DISTINCT FROM (OLD.id,OLD.transfer_id,OLD.project_id,OLD.created_by_user_id,OLD.created_at)) THEN RAISE EXCEPTION 'TRANSFER_HISTORY_IMMUTABLE'; END IF;
 SELECT * INTO t FROM stock_transfers WHERE id=NEW.transfer_id;
 IF t.reversed_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM transfer_dispatches WHERE transfer_id=t.id)
  OR NOT EXISTS(SELECT 1 FROM stock_transfer_items WHERE stock_transfer_id=t.id AND destination_project_id=NEW.project_id)
  OR NOT erp_transfer_receiver(NEW.created_by_user_id,t.id,NEW.project_id)
 THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_ACTOR_INVALID'; END IF;
 IF NEW.posted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM documents d JOIN document_links l ON l.document_id=d.id AND l.entity_type='TRANSFER_RECEIPT' AND l.entity_id=NEW.id
  WHERE d.id=NEW.document_id AND d.company_id=t.company_id AND d.is_active AND d.checksum=NEW.checksum AND d.file_size_bytes>0) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EVIDENCE_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON transfer_receipts FOR EACH ROW EXECUTE FUNCTION erp_transfer_receipt_guard();

CREATE FUNCTION erp_transfer_receipt_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r transfer_receipts; i stock_transfer_items; accepted numeric;
BEGIN
 SELECT * INTO r FROM transfer_receipts WHERE id=NEW.receipt_id;
 PERFORM 1 FROM transfer_custodies WHERE transfer_id=r.transfer_id FOR UPDATE;
 SELECT * INTO i FROM stock_transfer_items WHERE id=NEW.transfer_item_id;
 SELECT COALESCE(sum(l.quantity),0) INTO accepted FROM transfer_receipt_lines l JOIN transfer_receipts rr ON rr.id=l.receipt_id WHERE l.transfer_item_id=i.id AND rr.posted_at IS NOT NULL;
 IF r.posted_at IS NULL OR i.stock_transfer_id IS DISTINCT FROM r.transfer_id OR i.destination_project_id IS DISTINCT FROM r.project_id OR accepted+NEW.quantity>i.quantity
 THEN RAISE EXCEPTION 'TRANSFER_OVERRECEIPT_OR_DIMENSION_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_receipt_line_guard BEFORE INSERT ON transfer_receipt_lines FOR EACH ROW EXECUTE FUNCTION erp_transfer_receipt_line_guard();

CREATE FUNCTION erp_transfer_validate_movement(m stock_transactions) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t stock_transfers; i stock_transfer_items; d transfer_dispatches; r transfer_receipts; l transfer_receipt_lines; original stock_transactions;
BEGIN
 SELECT * INTO t FROM stock_transfers WHERE id=m.stock_transfer_id;
 SELECT * INTO i FROM stock_transfer_items WHERE id=m.stock_transfer_item_id;
 SELECT * INTO d FROM transfer_dispatches WHERE transfer_id=t.id;
 IF i.stock_transfer_id IS DISTINCT FROM t.id OR m.company_id IS DISTINCT FROM t.company_id OR m.material_id IS DISTINCT FROM i.material_id OR m.uom_id IS DISTINCT FROM i.uom_id
  OR m.wbs_id IS NOT NULL OR m.cost_code_id IS NOT NULL OR m.activity_id IS NOT NULL OR t.posted_at IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'TRANSFER_STOCK_SOURCE_INVALID'; END IF;
 IF m.movement_type='STOCK_TRANSFER_OUT' THEN
  IF t.reversed_at IS NOT NULL OR m.transfer_receipt_line_id IS NOT NULL OR m.project_id IS DISTINCT FROM i.source_project_id OR m.warehouse_id<>t.source_warehouse_id OR m.quantity<>-i.quantity OR m.posted_by_user_id<>d.actor_user_id OR m.effect_key<>'stock-transfer-out:'||i.id THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EFFECT_INVALID'; END IF;
 ELSIF m.movement_type='STOCK_TRANSFER_IN' THEN
  SELECT * INTO l FROM transfer_receipt_lines WHERE id=m.transfer_receipt_line_id;
  SELECT * INTO r FROM transfer_receipts WHERE id=l.receipt_id;
  IF t.reversed_at IS NOT NULL OR l.id IS NULL OR l.transfer_item_id<>i.id OR r.transfer_id<>t.id OR r.posted_at IS NULL OR r.project_id<>i.destination_project_id
   OR m.project_id IS DISTINCT FROM i.destination_project_id OR m.warehouse_id<>t.destination_warehouse_id OR m.quantity<>l.quantity OR m.posted_by_user_id<>r.created_by_user_id OR m.effect_key<>'transfer-receipt:'||l.id THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EFFECT_INVALID'; END IF;
 ELSIF m.movement_type IN ('STOCK_TRANSFER_OUT_REVERSAL','STOCK_TRANSFER_IN_REVERSAL') THEN
  SELECT * INTO original FROM stock_transactions WHERE id=m.reversal_of_id;
  IF t.reversed_at IS NULL OR original.id IS NULL OR original.stock_transfer_id IS DISTINCT FROM t.id OR original.stock_transfer_item_id IS DISTINCT FROM i.id
   OR m.transfer_receipt_line_id IS DISTINCT FROM original.transfer_receipt_line_id OR m.project_id IS DISTINCT FROM original.project_id OR m.warehouse_id<>original.warehouse_id OR m.quantity<>-original.quantity
   OR (m.movement_type='STOCK_TRANSFER_OUT_REVERSAL' AND original.movement_type<>'STOCK_TRANSFER_OUT') OR (m.movement_type='STOCK_TRANSFER_IN_REVERSAL' AND original.movement_type<>'STOCK_TRANSFER_IN')
   OR m.posted_by_user_id IS DISTINCT FROM t.reversed_by_user_id OR m.effect_key<>'stock-transfer-reversal:'||original.id THEN RAISE EXCEPTION 'TRANSFER_REVERSAL_EFFECT_INVALID'; END IF;
 ELSE RAISE EXCEPTION 'TRANSFER_MOVEMENT_INVALID'; END IF;
END $$;

CREATE FUNCTION erp_transfer_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid uuid; t stock_transfers; c transfer_custodies; r record; i record;
BEGIN
 IF TG_TABLE_NAME='transfer_custodies' THEN tid=NEW.transfer_id;
 ELSIF TG_TABLE_NAME='stock_transfers' THEN tid=NEW.id;
 ELSIF TG_TABLE_NAME='stock_transactions' THEN tid=NEW.stock_transfer_id;
 ELSIF TG_TABLE_NAME='transfer_receipt_lines' THEN SELECT transfer_id INTO tid FROM transfer_receipts WHERE id=NEW.receipt_id;
 ELSE tid=NEW.transfer_id; END IF;
 SELECT * INTO c FROM transfer_custodies WHERE transfer_id=tid;
 IF c.transfer_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO t FROM stock_transfers WHERE id=tid;
 IF NOT EXISTS(SELECT 1 FROM transfer_custody_events e WHERE e.transfer_id=tid AND e.version=c.version) THEN RAISE EXCEPTION 'TRANSFER_VERSION_EVENT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM transfer_dispatches WHERE transfer_id=tid) THEN
  IF t.posted_at IS NULL THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EFFECT_REQUIRED'; END IF;
  FOR i IN SELECT * FROM stock_transfer_items WHERE stock_transfer_id=tid LOOP
   IF NOT EXISTS(SELECT 1 FROM stock_transactions m WHERE m.stock_transfer_item_id=i.id AND m.movement_type='STOCK_TRANSFER_OUT' AND m.quantity=-i.quantity) THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EFFECT_REQUIRED'; END IF;
  END LOOP;
 ELSIF t.posted_at IS NOT NULL THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_REQUIRED'; END IF;
 FOR r IN SELECT * FROM transfer_receipts WHERE transfer_id=tid AND posted_at IS NOT NULL LOOP
  IF NOT EXISTS(SELECT 1 FROM transfer_receipt_lines WHERE receipt_id=r.id) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_LINES_REQUIRED'; END IF;
  FOR i IN SELECT * FROM transfer_receipt_lines WHERE receipt_id=r.id LOOP
   IF NOT EXISTS(SELECT 1 FROM stock_transactions m WHERE m.transfer_receipt_line_id=i.id AND m.movement_type='STOCK_TRANSFER_IN' AND m.quantity=i.quantity) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EFFECT_REQUIRED'; END IF;
  END LOOP;
 END LOOP;
 IF t.reversed_at IS NOT NULL THEN
  FOR i IN SELECT * FROM stock_transfer_items WHERE stock_transfer_id=tid LOOP
   IF i.quantity<>(SELECT COALESCE(sum(quantity),0) FROM stock_transactions WHERE stock_transfer_item_id=i.id AND movement_type='STOCK_TRANSFER_IN') THEN RAISE EXCEPTION 'TRANSFER_OUTSTANDING_CUSTODY_NOT_REVERSIBLE'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM stock_transactions m WHERE m.stock_transfer_id=tid AND m.movement_type IN ('STOCK_TRANSFER_IN','STOCK_TRANSFER_OUT') AND NOT EXISTS(SELECT 1 FROM stock_transactions rev WHERE rev.reversal_of_id=m.id)) THEN RAISE EXCEPTION 'TRANSFER_REVERSAL_EFFECT_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER transfer_custody_proof AFTER INSERT OR UPDATE ON transfer_custodies DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_proof();
CREATE CONSTRAINT TRIGGER transfer_dispatch_proof AFTER INSERT ON transfer_dispatches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_proof();
CREATE CONSTRAINT TRIGGER transfer_receipt_proof AFTER INSERT OR UPDATE ON transfer_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_proof();
CREATE CONSTRAINT TRIGGER transfer_receipt_line_proof AFTER INSERT ON transfer_receipt_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_proof();
CREATE CONSTRAINT TRIGGER transfer_header_proof AFTER UPDATE ON stock_transfers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_proof();
CREATE CONSTRAINT TRIGGER transfer_stock_proof AFTER INSERT ON stock_transactions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_transfer_proof();

CREATE FUNCTION erp_transfer_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c transfer_custodies;
BEGIN
 SELECT * INTO c FROM transfer_custodies WHERE transfer_id=NEW.transfer_id;
 IF NEW.version<>c.version OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_user_id AND company_id=c.company_id AND is_active) THEN RAISE EXCEPTION 'TRANSFER_EVENT_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_event_guard BEFORE INSERT ON transfer_custody_events FOR EACH ROW EXECUTE FUNCTION erp_transfer_event_guard();

CREATE FUNCTION erp_transfer_document_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did uuid;
BEGIN
 did=CASE WHEN TG_TABLE_NAME='documents' THEN OLD.id ELSE OLD.document_id END;
 IF EXISTS(SELECT 1 FROM transfer_receipts WHERE document_id=did AND posted_at IS NOT NULL) AND (
  TG_OP='DELETE' OR TG_TABLE_NAME='document_links' OR
  (to_jsonb(NEW)-'is_active'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'is_active'-'updated_at')) THEN RAISE EXCEPTION 'TRANSFER_EVIDENCE_HISTORY_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_document_history BEFORE UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION erp_transfer_document_history();
CREATE TRIGGER transfer_document_link_history BEFORE UPDATE OR DELETE ON document_links FOR EACH ROW EXECUTE FUNCTION erp_transfer_document_history();

CREATE OR REPLACE FUNCTION enforce_stock_transaction_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; original RECORD;
BEGIN
  IF NEW.goods_receipt_item_id IS NOT NULL THEN
    SELECT r.company_id,r.warehouse_id,r.project_id,r.posted_at,r.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity
    INTO source FROM goods_receipts r JOIN goods_receipt_items i ON i.goods_receipt_id=r.id
    WHERE r.id=NEW.goods_receipt_id AND i.id=NEW.goods_receipt_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Receipt Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='GOODS_RECEIPT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Receipt movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='GOODS_RECEIPT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'GOODS_RECEIPT'
        OR original.goods_receipt_item_id<>NEW.goods_receipt_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Receipt reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Receipt source cannot use this movement type'; END IF;
  ELSIF NEW.material_issue_item_id IS NOT NULL THEN
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.wbs_id,i.cost_code_id,i.activity_id
    INTO source FROM material_issues h JOIN material_issue_items i ON i.material_issue_id=h.id
    WHERE h.id=NEW.material_issue_id AND i.id=NEW.material_issue_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Issue Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='MATERIAL_ISSUE' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>-source.item_quantity
      THEN RAISE EXCEPTION 'Issue movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='MATERIAL_ISSUE_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_ISSUE'
        OR original.material_issue_item_id<>NEW.material_issue_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Issue reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Issue source cannot use this movement type'; END IF;
  ELSIF NEW.material_return_item_id IS NOT NULL THEN
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,
      src.wbs_id,src.cost_code_id,src.activity_id
    INTO source
    FROM material_returns h
    JOIN material_return_items i ON i.material_return_id=h.id
    JOIN material_issue_items src ON src.id=i.material_issue_item_id
    WHERE h.id=NEW.material_return_id AND i.id=NEW.material_return_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Return Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='MATERIAL_RETURN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Return movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='MATERIAL_RETURN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_RETURN'
        OR original.material_return_item_id<>NEW.material_return_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Return reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Return source cannot use this movement type'; END IF;
  ELSIF NEW.stock_transfer_item_id IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.stock_transfer_id) THEN
      PERFORM erp_transfer_validate_movement(NEW); RETURN NEW;
    END IF;
    IF NEW.transfer_receipt_line_id IS NOT NULL THEN RAISE EXCEPTION 'TRANSFER_LEGACY_RECEIPT_PROVENANCE_INVALID'; END IF;
    SELECT h.company_id,h.source_warehouse_id,h.destination_warehouse_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.source_project_id,i.destination_project_id
    INTO source
    FROM stock_transfers h JOIN stock_transfer_items i ON i.stock_transfer_id=h.id
    WHERE h.id=NEW.stock_transfer_id AND i.id=NEW.stock_transfer_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Transfer Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='STOCK_TRANSFER_OUT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.warehouse_id IS DISTINCT FROM source.source_warehouse_id
        OR NEW.project_id IS DISTINCT FROM source.source_project_id OR NEW.quantity<>-source.item_quantity
      THEN RAISE EXCEPTION 'Transfer OUT movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_IN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.warehouse_id IS DISTINCT FROM source.destination_warehouse_id
        OR NEW.project_id IS DISTINCT FROM source.destination_project_id OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Transfer IN movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_OUT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'STOCK_TRANSFER_OUT'
        OR original.stock_transfer_item_id<>NEW.stock_transfer_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Transfer OUT reversal must exactly negate source'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_IN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'STOCK_TRANSFER_IN'
        OR original.stock_transfer_item_id<>NEW.stock_transfer_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Transfer IN reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Transfer source cannot use this movement type'; END IF;
  ELSIF NEW.stock_count_id IS NOT NULL THEN
    SELECT c.company_id,c.project_id,c.warehouse_id,c.material_id,c.uom_id,c.status,
      c.variance_quantity,c.decided_by_user_id,c.post_key
    INTO source FROM stock_counts c WHERE c.id=NEW.stock_count_id;
    IF NOT FOUND OR source.status<>'APPROVED'
      OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
      OR NEW.posted_by_user_id IS DISTINCT FROM source.decided_by_user_id
      OR NEW.effect_key IS DISTINCT FROM ('stock-count:' || NEW.stock_count_id::text || ':' || source.post_key)
    THEN RAISE EXCEPTION 'Stock count movement source dimensions mismatch'; END IF;
    IF NEW.movement_type<>'STOCK_COUNT_ADJUSTMENT'
      OR NEW.quantity<>source.variance_quantity OR NEW.quantity=0
    THEN RAISE EXCEPTION 'Stock count movement quantity/state mismatch'; END IF;
  ELSE
    RAISE EXCEPTION 'Stock Transaction requires a supported source family';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION validate_document_link_scope()
RETURNS trigger AS $$
DECLARE
  document_company UUID;
  linker_company UUID;
  target_company UUID;
  target_project UUID;
BEGIN
  SELECT "company_id" INTO document_company
  FROM "documents" WHERE "id" = NEW."document_id";

  SELECT "company_id" INTO linker_company
  FROM "users" WHERE "id" = NEW."linked_by_user_id";

  IF document_company IS NULL OR linker_company IS NULL THEN
    RAISE EXCEPTION 'Document or linking user does not exist';
  END IF;

  IF NEW."entity_type" = 'HR_ATTACHMENT' THEN
    -- This is the ONLY exception to the generic same-Company linker rule:
    -- explicit native role capability plus live target-Company HR entitlement.
    -- An authorized cross-Company HR user remains the real audit actor.
    IF NOT hr_has_document_authority(NEW."linked_by_user_id", document_company) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_ACCESS_DENIED' USING ERRCODE='23514';
    END IF;
    -- No Project association: a canonical private file belongs to precisely
    -- the target-Company Employee. Native uploader Company may differ.
    IF NOT EXISTS (
      SELECT 1 FROM employees WHERE id = NEW."entity_id"
        AND company_id = document_company
    ) OR NOT EXISTS (
      SELECT 1 FROM documents WHERE id = NEW."document_id"
        AND company_id = document_company AND file_name = 'hr-private.enc'
        AND mime_type = 'application/octet-stream'
        AND storage_provider = 'LOCAL' AND file_size_bytes > 0
        AND checksum ~ '^[0-9a-f]{64}$'
        AND EXISTS (SELECT 1 FROM document_types dt
          WHERE dt.id=documents.document_type_id AND dt.company_id=document_company
            AND dt.is_active)
    ) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_SCOPE_INVALID' USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM document_links
      WHERE document_id = NEW."document_id"
        AND (entity_type <> 'HR_ATTACHMENT' OR entity_id <> NEW."entity_id")
    ) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_PRIVATE' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Every legacy Project/WBS/Finance/Stock/BOQ source keeps its original,
  -- strict same-Company linker requirement. No cross-Company generic path.
  IF document_company <> linker_company THEN
    RAISE EXCEPTION 'Document and linker must belong to the same Company';
  END IF;

  IF NEW."entity_type" = 'PROJECT' THEN
    SELECT "company_id","id"
      INTO target_company,target_project
    FROM "projects"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'BOQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "boqs"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'BUDGET_REVISION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "budget_revisions"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'CUSTOMER_BOQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "customer_boq_versions"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'WBS' THEN
    SELECT project."company_id", wbs."project_id"
      INTO target_company,target_project
    FROM "wbs_elements" wbs
    JOIN "projects" project ON project."id" = wbs."project_id"
    WHERE wbs."id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'ACTIVITY' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "activities"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'DAILY_SITE_REPORT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "daily_site_reports"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PURCHASE_REQUEST' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "purchase_requests"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'RFQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "rfqs"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUPPLIER_QUOTATION' THEN
    SELECT quotation."company_id", rfq."project_id"
      INTO target_company,target_project
    FROM "supplier_quotations" quotation
    JOIN "rfqs" rfq ON rfq."id" = quotation."rfq_id"
    WHERE quotation."id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PURCHASE_ORDER' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "purchase_orders"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'GOODS_RECEIPT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "goods_receipts"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_RESERVATION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "material_reservations"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_ISSUE' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "material_issues"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_RETURN' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "material_returns"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'STOCK_TRANSFER' THEN
    SELECT transfer."company_id", project_link."entity_id"
      INTO target_company,target_project
    FROM "stock_transfers" transfer
    JOIN "stock_transfer_items" item
      ON item."stock_transfer_id" = transfer."id"
    JOIN "document_links" project_link
      ON project_link."document_id" = NEW."document_id"
     AND project_link."entity_type" = 'PROJECT'
     AND (
       project_link."entity_id" = item."source_project_id"
       OR project_link."entity_id" = item."destination_project_id"
     )
    WHERE transfer."id" = NEW."entity_id"
    LIMIT 1;
  ELSIF NEW."entity_type" = 'SUPPLIER_INVOICE' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "supplier_invoices"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'CLIENT_INVOICE' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "client_invoices"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PAYMENT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "payments"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_AGREEMENT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_agreements"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_WORK_ORDER' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_work_orders"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_CLAIM' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_claims"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_CERTIFICATION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_certifications"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_VARIATION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_variations"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'TRANSFER_RECEIPT' THEN
    SELECT c.company_id,r.project_id INTO target_company,target_project
    FROM transfer_receipts r JOIN transfer_custodies c ON c.transfer_id=r.transfer_id WHERE r.id=NEW.entity_id;
  ELSIF NEW."entity_type" = 'RECEIVING_DELIVERY' THEN
    SELECT company_id,project_id INTO target_company,target_project
    FROM receiving_deliveries WHERE id=NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_REQUEST' THEN
    SELECT company_id,project_id INTO target_company,target_project
    FROM material_requests WHERE id=NEW."entity_id";
  ELSE
    RAISE EXCEPTION 'Unsupported Document Link entity type';
  END IF;

  IF target_company IS NULL OR target_project IS NULL THEN
    RAISE EXCEPTION 'Document Link target does not exist or is outside its Project link';
  END IF;

  IF target_company <> document_company THEN
    RAISE EXCEPTION 'Document Link target must belong to the same Company';
  END IF;

  IF NEW."entity_type" <> 'PROJECT'
     AND NOT EXISTS (
       SELECT 1
       FROM "document_links" project_link
       WHERE project_link."document_id" = NEW."document_id"
         AND project_link."entity_type" = 'PROJECT'
         AND project_link."entity_id" = target_project
     ) THEN
    RAISE EXCEPTION 'Document target link requires a matching Project link';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
