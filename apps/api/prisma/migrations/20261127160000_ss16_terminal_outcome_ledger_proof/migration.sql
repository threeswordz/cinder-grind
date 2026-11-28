-- DEC-055 SS16 category-wide repair. Preserve all earlier migration bytes.
-- A correction is not complete merely because a reversal header is present.
-- Existing canonical source guards validate every ledger insert and copy UOM
-- pins; this check requires the entire immutable compensating set, at commit.
CREATE FUNCTION ss16_assert_terminal_outcome(aid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c movement_correction_requests%ROWTYPE; a approval_instances%ROWTYPE;
 d approval_actions%ROWTYPE; o approval_instances%ROWTYPE; h record;
 header_table text; source_column text; item_table text; item_column text;
 originals text[]; prefix text; n bigint; expected bigint; invalid boolean;
BEGIN
 SELECT * INTO a FROM approval_instances WHERE id=aid AND entity_type='MOVEMENT_CORRECTION' AND approval_state='APPROVED';
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO STRICT c FROM movement_correction_requests WHERE approval_instance_id=aid;
 SELECT * INTO STRICT d FROM approval_actions WHERE approval_instance_id=aid AND action='APPROVE';
 CASE c.source_kind
 WHEN 'GOODS_RECEIPT' THEN header_table:='goods_receipts';source_column:='goods_receipt_id';item_table:='goods_receipt_items';item_column:='goods_receipt_item_id';originals:=ARRAY['GOODS_RECEIPT'];prefix:='receipt-reversal:';
 WHEN 'MATERIAL_ISSUE' THEN header_table:='material_issues';source_column:='material_issue_id';item_table:='material_issue_items';item_column:='material_issue_item_id';originals:=ARRAY['MATERIAL_ISSUE'];prefix:='material-issue-reversal:';
 WHEN 'MATERIAL_RETURN' THEN header_table:='material_returns';source_column:='material_return_id';item_table:='material_return_items';item_column:='material_return_item_id';originals:=ARRAY['MATERIAL_RETURN'];prefix:='material-return-reversal:';
 WHEN 'STOCK_TRANSFER' THEN header_table:='stock_transfers';source_column:='stock_transfer_id';item_table:='stock_transfer_items';item_column:='stock_transfer_item_id';originals:=ARRAY['STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN'];prefix:='stock-transfer-reversal:';
 ELSE RAISE EXCEPTION 'SS16 terminal source kind invalid' USING ERRCODE='23514';
 END CASE;
 EXECUTE format('SELECT id,company_id,approval_instance_id,submitted_at,posted_at,reversed_at,reversal_key,reversed_by_user_id,reversal_reason FROM %I WHERE id=$1 AND company_id=$2',header_table)
  INTO h USING c.source_id,c.company_id;
 IF h.id IS NULL THEN RAISE EXCEPTION 'SS16 terminal source missing' USING ERRCODE='23514'; END IF;
 IF c.source_posted_at IS NULL THEN
  SELECT * INTO STRICT o FROM approval_instances WHERE id=c.source_approval_instance_id FOR UPDATE;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM stock_transactions WHERE %I=$1)',source_column) INTO invalid USING c.source_id;
  IF invalid OR h.posted_at IS NOT NULL OR h.reversed_at IS NOT NULL OR h.submitted_at IS DISTINCT FROM c.source_submitted_at
   OR o.company_id<>c.company_id OR o.completed_at IS NULL
  THEN RAISE EXCEPTION 'SS16 terminal cancellation proof invalid' USING ERRCODE='23514'; END IF;
  IF c.source_kind='MATERIAL_ISSUE' AND o.entity_type='MATERIAL_PLAN_OVERAGE' THEN
   IF NOT EXISTS(SELECT 1 FROM material_plan_issue_authorizations p
      JOIN material_plan_issue_bindings b ON b.issue_id=p.issue_id AND b.authorization_id IS NULL
      WHERE p.issue_id=c.source_id AND p.id=o.entity_id AND p.approval_instance_id=o.id AND p.mode='OVERAGE'
       AND p.sequence=(SELECT max(z.sequence) FROM material_plan_issue_authorizations z WHERE z.issue_id=c.source_id))
   THEN RAISE EXCEPTION 'SS16 terminal cancellation proof invalid' USING ERRCODE='23514'; END IF;
  ELSIF h.approval_instance_id IS DISTINCT FROM o.id OR o.entity_type<>c.source_kind OR o.entity_id<>c.source_id
  THEN RAISE EXCEPTION 'SS16 terminal cancellation proof invalid' USING ERRCODE='23514'; END IF;
  IF c.source_kind='STOCK_TRANSFER' AND EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=c.source_id) THEN
   IF EXISTS(SELECT 1 FROM transfer_dispatches WHERE transfer_id=c.source_id)
    OR (SELECT count(*) FROM transfer_custody_events WHERE transfer_id=c.source_id AND action='CANCEL')<>1
    OR NOT EXISTS(SELECT 1 FROM transfer_custody_events WHERE transfer_id=c.source_id AND action='CANCEL'
      AND actor_user_id=d.action_by_user_id AND reason=c.reason)
   THEN RAISE EXCEPTION 'SS16 terminal cancellation proof invalid' USING ERRCODE='23514'; END IF;
   -- An approved, undispatched transfer retains its original approval.
   IF o.approval_state='APPROVED' AND NOT EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=o.id AND action='CANCEL') THEN RETURN; END IF;
  END IF;
  IF o.approval_state<>'CANCELLED'
   OR (SELECT count(*) FROM approval_actions WHERE approval_instance_id=o.id AND action='CANCEL')<>1
   OR NOT EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=o.id AND action='CANCEL' AND action_by_user_id=d.action_by_user_id)
  THEN RAISE EXCEPTION 'SS16 terminal cancellation proof invalid' USING ERRCODE='23514'; END IF;
  RETURN;
 END IF;
 IF h.posted_at IS DISTINCT FROM c.source_posted_at OR h.reversed_at IS NULL
  OR h.reversal_key IS DISTINCT FROM 'ss16:'||c.id::text OR h.reversed_by_user_id IS DISTINCT FROM d.action_by_user_id
  OR h.reversal_reason IS DISTINCT FROM c.reason
 THEN RAISE EXCEPTION 'SS16 terminal reversal header invalid' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT count(*) FROM %I WHERE %I=$1',item_table,source_column) INTO expected USING c.source_id;
 EXECUTE format('SELECT count(*) FROM stock_transactions WHERE %I=$1 AND movement_type=ANY($2) AND reversal_of_id IS NULL',source_column)
  INTO n USING c.source_id,originals;
 IF expected=0 OR n=0 THEN RAISE EXCEPTION 'SS16 reversal ledger incomplete' USING ERRCODE='23514'; END IF;
 IF c.source_kind='STOCK_TRANSFER' THEN
  -- Includes paired legacy transfers and fully received custody transfers;
  -- split receipt effects are allowed, but every OUT and received IN must
  -- match the frozen stock-unit quantity and each must be reversed.
  IF EXISTS(SELECT 1 FROM stock_transfer_items i LEFT JOIN material_uom_transfer_source_pins p ON p.transfer_item_id=i.id
   WHERE i.stock_transfer_id=c.source_id AND (
     (SELECT count(*) FROM stock_transactions st WHERE st.stock_transfer_item_id=i.id AND st.movement_type='STOCK_TRANSFER_OUT')<>1
     OR (SELECT coalesce(sum(quantity),0) FROM stock_transactions st WHERE st.stock_transfer_item_id=i.id AND st.movement_type='STOCK_TRANSFER_OUT')<>-coalesce(p.stock_quantity,i.quantity)
     OR (SELECT coalesce(sum(quantity),0) FROM stock_transactions st WHERE st.stock_transfer_item_id=i.id AND st.movement_type='STOCK_TRANSFER_IN')<>coalesce(p.stock_quantity,i.quantity)))
  THEN RAISE EXCEPTION 'SS16 reversal ledger incomplete' USING ERRCODE='23514'; END IF;
 ELSE
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I i WHERE i.%I=$1 AND (SELECT count(*) FROM stock_transactions st WHERE st.%I=i.id AND st.%I=$1 AND st.movement_type=ANY($2) AND st.reversal_of_id IS NULL)<>1)',item_table,source_column,item_column,source_column)
   INTO invalid USING c.source_id,originals;
  IF n<>expected OR invalid THEN RAISE EXCEPTION 'SS16 reversal ledger incomplete' USING ERRCODE='23514'; END IF;
 END IF;
 -- Compare each original with its single reciprocal reversal, including
 -- both transfer legs, dimensional attribution, actor, effect key and UOM
 -- provenance. Existing append-only/source/unique guards stay authoritative.
 EXECUTE format($q$
  SELECT EXISTS(
   SELECT 1 FROM stock_transactions st LEFT JOIN stock_transactions rev ON rev.reversal_of_id=st.id
   LEFT JOIN material_uom_effect_pins p ON p.stock_transaction_id=st.id
   LEFT JOIN material_uom_effect_pins rp ON rp.stock_transaction_id=rev.id
   WHERE st.%I=$1 AND st.movement_type=ANY($2) AND st.reversal_of_id IS NULL AND (
     st.company_id<>$3 OR rev.id IS NULL OR rev.movement_type IS DISTINCT FROM st.movement_type||'_REVERSAL'
     OR rev.quantity IS DISTINCT FROM -st.quantity OR rev.posted_by_user_id IS DISTINCT FROM $4
     OR rev.effect_key IS DISTINCT FROM $5||st.id::text
     OR ROW(rev.company_id,rev.warehouse_id,rev.material_id,rev.project_id,rev.uom_id,
      rev.goods_receipt_id,rev.goods_receipt_item_id,rev.material_issue_id,rev.material_issue_item_id,
      rev.material_return_id,rev.material_return_item_id,rev.stock_transfer_id,rev.stock_transfer_item_id,
      rev.transfer_receipt_line_id,rev.stock_count_id,rev.wbs_id,rev.cost_code_id,rev.activity_id)
       IS DISTINCT FROM ROW(st.company_id,st.warehouse_id,st.material_id,st.project_id,st.uom_id,
      st.goods_receipt_id,st.goods_receipt_item_id,st.material_issue_id,st.material_issue_item_id,
      st.material_return_id,st.material_return_item_id,st.stock_transfer_id,st.stock_transfer_item_id,
      st.transfer_receipt_line_id,st.stock_count_id,st.wbs_id,st.cost_code_id,st.activity_id)
     OR (p.stock_transaction_id IS NULL) IS DISTINCT FROM (rp.stock_transaction_id IS NULL)
     OR (p.stock_transaction_id IS NOT NULL AND ROW(rp.company_id,rp.material_id,rp.source_uom_id,rp.source_quantity,rp.stock_uom_id,rp.stock_quantity,
       rp.business_date,rp.basis_version,rp.revision_id,rp.numerator,rp.denominator,rp.effect_sign)
      IS DISTINCT FROM ROW(p.company_id,p.material_id,p.source_uom_id,p.source_quantity,p.stock_uom_id,p.stock_quantity,
       p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator,-p.effect_sign))))
  $q$,source_column) INTO invalid USING c.source_id,originals,c.company_id,d.action_by_user_id,prefix;
 IF invalid THEN RAISE EXCEPTION 'SS16 reversal ledger incomplete' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT count(*) FROM stock_transactions WHERE %I=$1',source_column) INTO expected USING c.source_id;
 IF expected<>2*n THEN RAISE EXCEPTION 'SS16 reversal ledger incomplete' USING ERRCODE='23514'; END IF;
END $$;

CREATE FUNCTION ss16_terminal_outcome_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM ss16_assert_terminal_outcome(NEW.id); RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ss16_terminal_outcome_guard AFTER INSERT OR UPDATE ON approval_instances
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.entity_type='MOVEMENT_CORRECTION') EXECUTE FUNCTION ss16_terminal_outcome_guard();

-- Once the independent correction is approved, freeze the original
-- approval. The only permitted transition is its initial SUBMITTED ->
-- CANCELLED callback in the same transaction, with its matching action.
CREATE FUNCTION ss16_original_terminal_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE decision record;
BEGIN
 SELECT a.id,a.xmin AS txid,d.action_by_user_id INTO decision
 FROM movement_correction_requests c JOIN approval_instances a ON a.id=c.approval_instance_id
 JOIN approval_actions d ON d.approval_instance_id=a.id AND d.action='APPROVE'
 WHERE c.source_approval_instance_id=OLD.id AND c.source_posted_at IS NULL AND a.approval_state='APPROVED'
 ORDER BY c.id LIMIT 1;
 IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='UPDATE' AND OLD.approval_state='SUBMITTED' AND NEW.approval_state='CANCELLED'
  AND OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL
  AND ROW(NEW.id,NEW.company_id,NEW.entity_type,NEW.entity_id,NEW.approval_workflow_id,NEW.current_step_no,NEW.started_at)
   IS NOT DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.entity_type,OLD.entity_id,OLD.approval_workflow_id,OLD.current_step_no,OLD.started_at)
  AND decision.txid=pg_current_xact_id()::xid
  AND EXISTS(SELECT 1 FROM approval_actions oa WHERE oa.approval_instance_id=OLD.id AND oa.action='CANCEL'
    AND oa.action_by_user_id=decision.action_by_user_id AND oa.xmin=pg_current_xact_id()::xid)
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'SS16 original cancellation history immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER ss16_original_terminal_state_guard BEFORE UPDATE OR DELETE ON approval_instances
 FOR EACH ROW EXECUTE FUNCTION ss16_original_terminal_state_guard();

CREATE FUNCTION ss16_original_terminal_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[]; target uuid; original approval_instances%ROWTYPE; decision record;
BEGIN
 IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.approval_instance_id];
 ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.approval_instance_id];
 ELSE ids:=ARRAY[OLD.approval_instance_id,NEW.approval_instance_id]; END IF;
 FOR target IN SELECT DISTINCT x FROM unnest(ids) x ORDER BY x LOOP
  -- Serialize original action edits with the original approval/cancellation.
  SELECT * INTO original FROM approval_instances WHERE id=target AND entity_type IN
   ('GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER','MATERIAL_PLAN_OVERAGE') FOR UPDATE;
  IF NOT FOUND THEN CONTINUE; END IF;
  SELECT a.xmin AS txid,d.action_by_user_id INTO decision
   FROM movement_correction_requests c JOIN approval_instances a ON a.id=c.approval_instance_id
   JOIN approval_actions d ON d.approval_instance_id=a.id AND d.action='APPROVE'
   WHERE c.source_approval_instance_id=target AND c.source_posted_at IS NULL AND a.approval_state='APPROVED'
   ORDER BY c.id LIMIT 1;
  IF NOT FOUND THEN CONTINUE; END IF;
  IF TG_OP='INSERT' AND original.approval_state='SUBMITTED' AND NEW.action='CANCEL'
   AND NEW.action_by_user_id=decision.action_by_user_id AND decision.txid=pg_current_xact_id()::xid
   AND EXISTS(SELECT 1 FROM approval_steps s WHERE s.id=NEW.approval_step_id AND s.approval_workflow_id=original.approval_workflow_id AND s.step_no=original.current_step_no)
   AND NOT EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=target AND action='CANCEL')
  THEN CONTINUE; END IF;
  RAISE EXCEPTION 'SS16 original cancellation action immutable' USING ERRCODE='23514';
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER ss16_original_terminal_action_guard BEFORE INSERT OR UPDATE OR DELETE ON approval_actions
 FOR EACH ROW EXECUTE FUNCTION ss16_original_terminal_action_guard();

-- All four unposted source kinds remain terminal even for raw writes.
CREATE FUNCTION ss16_cancelled_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
BEGIN
 kind:=CASE TG_TABLE_NAME WHEN 'goods_receipts' THEN 'GOODS_RECEIPT' WHEN 'material_issues' THEN 'MATERIAL_ISSUE'
  WHEN 'material_returns' THEN 'MATERIAL_RETURN' WHEN 'stock_transfers' THEN 'STOCK_TRANSFER' END;
 IF EXISTS(SELECT 1 FROM movement_correction_requests c JOIN approval_instances a ON a.id=c.approval_instance_id
   WHERE c.company_id=OLD.company_id AND c.source_id=OLD.id AND c.source_kind=kind AND c.source_posted_at IS NULL AND a.approval_state='APPROVED')
 THEN RAISE EXCEPTION 'SS16 cancelled source immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['goods_receipts','material_issues','material_returns','stock_transfers'] LOOP
  EXECUTE format('CREATE TRIGGER ss16_cancelled_source_guard BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ss16_cancelled_source_guard()',t);
 END LOOP;
END $$;

-- Validate existing approved SS16 decisions, not unrelated legacy movements.
-- Fail closed on corrupt historical correction proof; never repair rows.
DO $$ DECLARE x record; BEGIN
 FOR x IN SELECT id FROM approval_instances WHERE entity_type='MOVEMENT_CORRECTION' AND approval_state='APPROVED' LOOP
  PERFORM ss16_assert_terminal_outcome(x.id);
 END LOOP;
END $$;
