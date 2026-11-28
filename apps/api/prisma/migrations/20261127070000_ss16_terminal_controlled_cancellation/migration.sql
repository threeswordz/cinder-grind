-- Preserve a previously approved but undispatched transfer's original approval.
CREATE OR REPLACE FUNCTION erp_ss16_approved_unposted_cancellation(kind text, source uuid, company uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
  SELECT 1 FROM movement_correction_requests c
  JOIN approval_instances a ON a.id=c.approval_instance_id AND a.company_id=c.company_id
    AND a.entity_type='MOVEMENT_CORRECTION' AND a.entity_id=c.id AND a.approval_state='APPROVED'
  JOIN approval_instances o ON o.id=c.source_approval_instance_id AND o.company_id=c.company_id
    AND o.entity_type=c.source_kind AND o.entity_id=c.source_id
    AND (o.approval_state='CANCELLED' OR (c.source_kind='STOCK_TRANSFER' AND o.approval_state='APPROVED'))
  JOIN approval_actions aa ON aa.approval_instance_id=a.id AND aa.action='APPROVE' AND aa.action_by_user_id<>c.requested_by_user_id
  LEFT JOIN approval_actions oa ON oa.approval_instance_id=o.id AND oa.action='CANCEL' AND oa.action_by_user_id=aa.action_by_user_id
  WHERE c.company_id=company AND c.source_kind=kind AND c.source_id=source AND c.source_posted_at IS NULL
    AND (oa.id IS NOT NULL OR (kind='STOCK_TRANSFER' AND o.approval_state='APPROVED'))
    AND (CASE kind WHEN 'GOODS_RECEIPT' THEN EXISTS(SELECT 1 FROM goods_receipts g WHERE g.id=source AND g.company_id=company
        AND g.approval_instance_id=o.id AND g.submitted_at=c.source_submitted_at AND g.posted_at IS NULL AND g.reversed_at IS NULL)
      WHEN 'STOCK_TRANSFER' THEN EXISTS(SELECT 1 FROM stock_transfers t WHERE t.id=source AND t.company_id=company
        AND t.approval_instance_id=o.id AND t.submitted_at=c.source_submitted_at AND t.posted_at IS NULL AND t.reversed_at IS NULL)
      ELSE false END)
 );
$$;

CREATE FUNCTION erp_ss16_terminal_transfer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM transfer_custody_events WHERE transfer_id=NEW.transfer_id AND action='CANCEL')
 THEN RAISE EXCEPTION 'SS16_TRANSFER_CANCELLED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_terminal_transfer_dispatch_guard BEFORE INSERT ON transfer_dispatches
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_terminal_transfer_guard();
CREATE TRIGGER ss16_terminal_transfer_assignment_guard BEFORE INSERT ON transfer_receiver_assignments
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_terminal_transfer_guard();

-- A terminal material-plan cancellation must pin the exact latest pending
-- overage approval; do not rewrite frozen allocations or allow reauthorization.
CREATE FUNCTION erp_ss16_terminal_plan_issue(iid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM movement_correction_requests c
  JOIN material_issues i ON i.id=c.source_id AND i.company_id=c.company_id AND i.submitted_at=c.source_submitted_at
  JOIN material_plan_issue_authorizations p ON p.issue_id=i.id AND p.approval_instance_id=c.source_approval_instance_id
  JOIN approval_instances o ON o.id=p.approval_instance_id AND o.company_id=c.company_id
    AND o.entity_type='MATERIAL_PLAN_OVERAGE' AND o.entity_id=p.id AND o.approval_state='CANCELLED'
  JOIN approval_instances a ON a.id=c.approval_instance_id AND a.company_id=c.company_id
    AND a.entity_type='MOVEMENT_CORRECTION' AND a.entity_id=c.id AND a.approval_state='APPROVED'
  JOIN approval_actions aa ON aa.approval_instance_id=a.id AND aa.action='APPROVE' AND aa.action_by_user_id<>c.requested_by_user_id
  JOIN approval_actions oa ON oa.approval_instance_id=o.id AND oa.action='CANCEL' AND oa.action_by_user_id=aa.action_by_user_id
  WHERE c.source_kind='MATERIAL_ISSUE' AND c.source_id=iid AND c.source_posted_at IS NULL);
$$;
CREATE FUNCTION erp_ss16_terminal_plan_auth_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF erp_ss16_terminal_plan_issue(NEW.issue_id) THEN RAISE EXCEPTION 'SS16_SOURCE_CANCELLED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_terminal_plan_auth_guard BEFORE INSERT ON material_plan_issue_authorizations
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_terminal_plan_auth_guard();
CREATE TRIGGER ss16_terminal_plan_binding_guard BEFORE UPDATE ON material_plan_issue_bindings
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_terminal_plan_auth_guard();
CREATE FUNCTION erp_ss16_terminal_issue_post_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.posted_at IS DISTINCT FROM OLD.posted_at AND NEW.posted_at IS NOT NULL
  AND erp_ss16_terminal_plan_issue(NEW.id) THEN RAISE EXCEPTION 'SS16_SOURCE_CANCELLED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_terminal_issue_post_guard BEFORE UPDATE ON material_issues
 FOR EACH ROW EXECUTE FUNCTION erp_ss16_terminal_issue_post_guard();
