-- SS16: preserve physical custody and original decisions. Only a proven independent
-- approved correction can unlock the existing Store-owned receiving VOID transition.
CREATE FUNCTION erp_ss16_approved_unposted_cancellation(kind text, source uuid, company uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
  SELECT 1 FROM movement_correction_requests c
  JOIN approval_instances a ON a.id=c.approval_instance_id AND a.company_id=c.company_id
    AND a.entity_type='MOVEMENT_CORRECTION' AND a.entity_id=c.id AND a.approval_state='APPROVED'
  JOIN approval_instances o ON o.id=c.source_approval_instance_id AND o.company_id=c.company_id
    AND o.entity_type=c.source_kind AND o.entity_id=c.source_id AND o.approval_state='CANCELLED'
  JOIN approval_actions aa ON aa.approval_instance_id=a.id AND aa.action='APPROVE' AND aa.action_by_user_id<>c.requested_by_user_id
  JOIN approval_actions oa ON oa.approval_instance_id=o.id AND oa.action='CANCEL' AND oa.action_by_user_id=aa.action_by_user_id
  WHERE c.company_id=company AND c.source_kind=kind AND c.source_id=source AND c.source_posted_at IS NULL
    AND (CASE kind WHEN 'GOODS_RECEIPT' THEN EXISTS(SELECT 1 FROM goods_receipts g WHERE g.id=source AND g.company_id=company
        AND g.approval_instance_id=o.id AND g.submitted_at=c.source_submitted_at AND g.posted_at IS NULL AND g.reversed_at IS NULL)
      WHEN 'STOCK_TRANSFER' THEN EXISTS(SELECT 1 FROM stock_transfers t WHERE t.id=source AND t.company_id=company
        AND t.approval_instance_id=o.id AND t.submitted_at=c.source_submitted_at AND t.posted_at IS NULL AND t.reversed_at IS NULL)
      ELSE false END)
 );
$$;

CREATE OR REPLACE FUNCTION erp_receiving_header_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'RECEIVING_HISTORY_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.supplier_id,NEW.created_by_user_id,NEW.received_at,NEW.po_link_due_at,NEW.supersedes_id,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.company_id,OLD.project_id,OLD.warehouse_id,OLD.supplier_id,OLD.created_by_user_id,OLD.received_at,OLD.po_link_due_at,OLD.supersedes_id,OLD.created_at)
  OR(OLD.linked_at IS NOT NULL AND NEW.linked_at IS DISTINCT FROM OLD.linked_at) THEN RAISE EXCEPTION 'RECEIVING_DEADLINE_IMMUTABLE'; END IF;
  IF NEW.status='VOID' AND EXISTS(SELECT 1 FROM goods_receipts g LEFT JOIN approval_instances a ON a.id=g.approval_instance_id WHERE g.delivery_id=OLD.id AND g.submitted_at IS NOT NULL AND a.approval_state IS DISTINCT FROM 'REJECTED'
    AND NOT (a.approval_state IS NOT DISTINCT FROM 'CANCELLED' AND erp_ss16_approved_unposted_cancellation('GOODS_RECEIPT',g.id,g.company_id))) THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
  IF OLD.status='VOID' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'RECEIVING_HISTORY_IMMUTABLE'; END IF;
  IF EXISTS(SELECT 1 FROM goods_receipts gr WHERE gr.delivery_id=OLD.id AND (gr.posted_at IS NOT NULL OR gr.reversed_at IS NOT NULL))
  THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 END IF;
 IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM receiving_deliveries d WHERE d.id=NEW.supersedes_id AND d.status='VOID' AND d.company_id=NEW.company_id AND d.project_id=NEW.project_id AND d.warehouse_id=NEW.warehouse_id AND d.supplier_id=NEW.supplier_id AND d.created_by_user_id=NEW.created_by_user_id AND d.received_at=NEW.received_at AND d.po_link_due_at=NEW.po_link_due_at)
 THEN RAISE EXCEPTION 'RECEIVING_REPLACEMENT_INVALID'; END IF;
 RETURN NEW;
END $$;

-- Existing action whitelist is unnamed in the original migration. Replace
-- only its exact action constraint, retaining every historical allowed action.
DO $$ DECLARE c record; n integer:=0; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='transfer_custody_events'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) LIKE '%action%' AND pg_get_constraintdef(oid) LIKE '%PREPARE_RECEIPT%'
 LOOP
   EXECUTE format('ALTER TABLE transfer_custody_events DROP CONSTRAINT %I',c.conname); n:=n+1;
 END LOOP;
 IF n<>1 THEN RAISE EXCEPTION 'SS16_TRANSFER_EVENT_CONSTRAINT_UNEXPECTED'; END IF;
END $$;
ALTER TABLE transfer_custody_events ADD CONSTRAINT ss16_transfer_event_shape
 CHECK(version>0 AND length(btrim(reason))>0 AND action IN ('CREATE','APPROVE','DISPATCH','ASSIGN','PREPARE_RECEIPT','RECEIVE','REVERSE','CANCEL'));

CREATE FUNCTION erp_ss16_transfer_cancel_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE company uuid;
BEGIN
 IF NEW.action<>'CANCEL' THEN RETURN NEW; END IF;
 SELECT company_id INTO STRICT company FROM transfer_custodies WHERE transfer_id=NEW.transfer_id;
 IF NOT erp_ss16_approved_unposted_cancellation('STOCK_TRANSFER',NEW.transfer_id,company)
  OR EXISTS(SELECT 1 FROM transfer_dispatches WHERE transfer_id=NEW.transfer_id)
  OR EXISTS(SELECT 1 FROM stock_transactions WHERE stock_transfer_id=NEW.transfer_id)
  OR NOT EXISTS(SELECT 1 FROM movement_correction_requests c JOIN approval_instances a ON a.id=c.approval_instance_id
     JOIN approval_actions aa ON aa.approval_instance_id=a.id AND aa.action='APPROVE'
     WHERE c.company_id=company AND c.source_kind='STOCK_TRANSFER' AND c.source_id=NEW.transfer_id
       AND c.source_posted_at IS NULL AND a.company_id=company AND a.approval_state='APPROVED'
       AND a.entity_type='MOVEMENT_CORRECTION' AND a.entity_id=c.id
       AND aa.action_by_user_id=NEW.actor_user_id AND c.reason=NEW.reason)
  OR EXISTS(SELECT 1 FROM transfer_custody_events WHERE transfer_id=NEW.transfer_id AND action='CANCEL')
 THEN RAISE EXCEPTION 'SS16_TRANSFER_CANCEL_EVENT_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_transfer_cancel_event_guard BEFORE INSERT ON transfer_custody_events
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_transfer_cancel_event_guard();

CREATE FUNCTION erp_ss16_transfer_cancelled_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM stock_transfers t JOIN approval_instances a ON a.id=t.approval_instance_id
  WHERE t.id=NEW.transfer_id AND a.approval_state='CANCELLED')
 THEN RAISE EXCEPTION 'SS16_TRANSFER_CANCELLED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_transfer_cancelled_assignment_guard BEFORE INSERT ON transfer_receiver_assignments
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_transfer_cancelled_assignment_guard();
