-- DEC-033: additive provenance, no UPDATE/backfill of historical business rows.
ALTER TABLE companies ALTER COLUMN base_currency_code SET DEFAULT 'THB';

CREATE FUNCTION erp_thb_require_currency(currency TEXT) RETURNS void AS $$
BEGIN
  IF currency IS DISTINCT FROM 'THB' THEN
    RAISE EXCEPTION USING ERRCODE = 'P1201', MESSAGE = 'ERP_THB_PROVENANCE_REQUIRED';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION erp_thb_require_company(company UUID) RETURNS void AS $$
DECLARE currency TEXT;
BEGIN
  -- Serialize new activity with the deliberate audited Company transition.
  SELECT base_currency_code INTO currency FROM companies WHERE id = company FOR SHARE;
  IF currency IS DISTINCT FROM 'THB' THEN
    RAISE EXCEPTION USING ERRCODE = 'P1201', MESSAGE = 'ERP_THB_COMPANY_REQUIRED';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION erp_thb_company_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.base_currency_code IS DISTINCT FROM OLD.base_currency_code THEN
    PERFORM erp_thb_require_currency(NEW.base_currency_code);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER companies_thb_policy BEFORE INSERT OR UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION erp_thb_company_guard();

-- All names below are internal constant contracts, not user-selected tables.
-- Reading a source never infers currency from today's Company or a date/name.
CREATE FUNCTION erp_thb_assert_source(source_table TEXT, source_id UUID) RETURNS void AS $$
DECLARE row_data JSONB; parent_id UUID; child RECORD; currency TEXT;
BEGIN
  IF source_table NOT IN (
    'projects','boqs','budget_revisions','supplier_quotations','quotation_awards',
    'purchase_orders','goods_receipts','subcontract_agreements',
    'subcontract_agreement_versions','subcontract_work_orders','subcontract_claims',
    'subcontract_claim_assessments','subcontract_certifications','subcontract_variations',
    'supplier_invoices','client_invoices','payments','retention_ledger_entries',
    'direct_cost_postings','project_variations','cost_forecasts'
  ) THEN
    RAISE EXCEPTION 'Unknown THB source contract';
  END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = $1 FOR SHARE', source_table)
    INTO row_data USING source_id;
  IF row_data IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P1201', MESSAGE = 'ERP_THB_PROVENANCE_REQUIRED';
  END IF;

  -- Existing integrity guards, not this policy function, validate the exact
  -- offset/source/reason/approval/dimensions of these supported corrections.
  IF (source_table = 'direct_cost_postings' AND row_data->>'reverses_posting_id' IS NOT NULL)
    OR (source_table = 'project_variations' AND row_data->>'reverses_variation_id' IS NOT NULL)
    OR (source_table = 'retention_ledger_entries' AND row_data->>'entry_type' = 'REVERSAL') THEN
    RETURN;
  END IF;
  IF source_table = 'quotation_awards' THEN
    SELECT company_id INTO parent_id FROM supplier_quotations WHERE id = (row_data->>'supplier_quotation_id')::UUID;
    PERFORM erp_thb_require_company(parent_id);
  ELSE
    PERFORM erp_thb_require_company((row_data->>'company_id')::UUID);
  END IF;
  currency := CASE WHEN source_table = 'projects'
    THEN row_data->>'contract_currency_code' ELSE row_data->>'currency_code' END;
  IF source_table NOT IN ('subcontract_work_orders','subcontract_claim_assessments','goods_receipts') THEN
    PERFORM erp_thb_require_currency(currency);
  END IF;

  CASE source_table
    WHEN 'budget_revisions' THEN
      SELECT id INTO parent_id FROM boqs WHERE project_id = (row_data->>'project_id')::UUID
        AND company_id = (row_data->>'company_id')::UUID;
      PERFORM erp_thb_assert_source('boqs', parent_id);
    WHEN 'quotation_awards' THEN
      PERFORM erp_thb_assert_source('supplier_quotations', (row_data->>'supplier_quotation_id')::UUID);
    WHEN 'purchase_orders' THEN
      FOR child IN SELECT quotation_award_id, supplier_quotation_id FROM purchase_order_lines WHERE purchase_order_id = source_id LOOP
        PERFORM erp_thb_assert_source('quotation_awards', child.quotation_award_id);
        PERFORM erp_thb_assert_source('supplier_quotations', child.supplier_quotation_id);
      END LOOP;
    WHEN 'goods_receipts' THEN
      PERFORM erp_thb_assert_source('purchase_orders', (row_data->>'purchase_order_id')::UUID);
    WHEN 'subcontract_agreement_versions', 'subcontract_work_orders', 'subcontract_claims',
         'subcontract_certifications', 'subcontract_variations' THEN
      PERFORM erp_thb_assert_source('subcontract_agreements', (row_data->>'agreement_id')::UUID);
    WHEN 'subcontract_claim_assessments' THEN
      PERFORM erp_thb_assert_source('subcontract_claims', (row_data->>'claim_id')::UUID);
    WHEN 'client_invoices', 'project_variations' THEN
      PERFORM erp_thb_assert_source('projects', (row_data->>'project_id')::UUID);
    WHEN 'supplier_invoices' THEN
      FOR child IN SELECT DISTINCT pol.purchase_order_id AS id FROM supplier_invoice_items i
        JOIN purchase_order_lines pol ON pol.id = i.purchase_order_line_id WHERE i.supplier_invoice_id = source_id LOOP
        PERFORM erp_thb_assert_source('purchase_orders', child.id);
      END LOOP;
      FOR child IN SELECT DISTINCT gri.goods_receipt_id AS id FROM supplier_invoice_items i
        JOIN goods_receipt_items gri ON gri.id = i.goods_receipt_item_id WHERE i.supplier_invoice_id = source_id LOOP
        PERFORM erp_thb_assert_source('goods_receipts', child.id);
      END LOOP;
    WHEN 'payments' THEN
      FOR child IN SELECT supplier_invoice_id AS id FROM supplier_payment_allocations WHERE payment_id = source_id LOOP
        PERFORM erp_thb_assert_source('supplier_invoices', child.id);
      END LOOP;
      FOR child IN SELECT client_invoice_id AS id FROM client_receipt_allocations WHERE payment_id = source_id LOOP
        PERFORM erp_thb_assert_source('client_invoices', child.id);
      END LOOP;
      FOR child IN SELECT subcontract_certification_id AS id FROM subcontract_payment_allocations WHERE payment_id = source_id LOOP
        PERFORM erp_thb_assert_source('subcontract_certifications', child.id);
      END LOOP;
    WHEN 'retention_ledger_entries' THEN
      PERFORM erp_thb_assert_source('subcontract_certifications', (row_data->>'certification_id')::UUID);
    ELSE NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION erp_thb_root_guard() RETURNS trigger AS $$
DECLARE row_data JSONB := to_jsonb(NEW); prior JSONB; currency_field TEXT := 'currency_code';
  neutral_fields TEXT[] := ARRAY['updated_at','state','approval_state','rejected_at',
    'rejected_by_user_id','rejection_reason','decided_at','cancelled_at',
    'cancelled_by_user_id','cancellation_reason','withdrawn_at','withdrawn_by_user_id',
    'withdrawal_reason','reversed_at','reversed_by_user_id','reversal_reason','reversal_key'];
  neutral BOOLEAN := FALSE; parent_id UUID; company UUID;
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN currency_field := 'contract_currency_code'; END IF;
  IF TG_OP = 'UPDATE' THEN
    prior := to_jsonb(OLD);
    IF row_data->currency_field IS DISTINCT FROM prior->currency_field
      OR row_data->'id' IS DISTINCT FROM prior->'id'
      OR row_data->'company_id' IS DISTINCT FROM prior->'company_id'
      OR row_data->'project_id' IS DISTINCT FROM prior->'project_id' THEN
      RAISE EXCEPTION USING ERRCODE = 'P1201', MESSAGE = 'ERP_THB_PROVENANCE_IMMUTABLE';
    END IF;
    -- Idempotent no-ops and Project nonmonetary administration retain history.
    IF row_data - 'updated_at' = prior - 'updated_at' THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'projects' AND row_data->'contract_value' IS NOT DISTINCT FROM prior->'contract_value' THEN
      RETURN NEW;
    END IF;
    neutral := row_data - neutral_fields = prior - neutral_fields AND (
      row_data->>'state' IN ('REJECTED','CANCELLED','WITHDRAWN','REVERSED')
      OR row_data->>'approval_state' IN ('REJECTED','CANCELLED')
      OR (row_data->>'cancelled_at' IS NOT NULL AND prior->>'cancelled_at' IS NULL)
      OR (TG_TABLE_NAME = 'goods_receipts' AND prior->>'posted_at' IS NOT NULL AND row_data->>'reversed_at' IS NOT NULL)
    );
    IF neutral THEN RETURN NEW; END IF;
  END IF;

  -- A correction is eligible only through its already-enforced exact-source
  -- contract. No client override, date, prefix, or currency-change exception.
  IF (TG_TABLE_NAME = 'direct_cost_postings' AND row_data->>'reverses_posting_id' IS NOT NULL)
    OR (TG_TABLE_NAME = 'project_variations' AND row_data->>'reverses_variation_id' IS NOT NULL)
    OR (TG_TABLE_NAME = 'retention_ledger_entries' AND row_data->>'entry_type' = 'REVERSAL') THEN
    RETURN NEW;
  END IF;

  company := (row_data->>'company_id')::UUID;
  IF TG_TABLE_NAME = 'quotation_awards' THEN
    SELECT company_id INTO company FROM supplier_quotations WHERE id = NEW.supplier_quotation_id FOR SHARE;
  END IF;
  PERFORM erp_thb_require_company(company);
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME IN ('projects','boqs','supplier_quotations','quotation_awards') THEN
    IF row_data->>currency_field IS NOT NULL THEN PERFORM erp_thb_require_currency(row_data->>currency_field); END IF;
    NEW := jsonb_populate_record(NEW, jsonb_build_object(currency_field, 'THB'));
    row_data := to_jsonb(NEW);
  END IF;
  IF TG_TABLE_NAME NOT IN ('subcontract_work_orders','subcontract_claim_assessments','goods_receipts') THEN
    PERFORM erp_thb_require_currency(row_data->>currency_field);
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'budget_revisions' THEN
      SELECT id INTO parent_id FROM boqs WHERE project_id = NEW.project_id AND company_id = NEW.company_id;
      PERFORM erp_thb_assert_source('boqs', parent_id);
    WHEN 'quotation_awards' THEN
      PERFORM erp_thb_assert_source('supplier_quotations', NEW.supplier_quotation_id);
    WHEN 'purchase_orders' THEN
      IF NEW.previous_revision_id IS NOT NULL THEN PERFORM erp_thb_assert_source('purchase_orders', NEW.previous_revision_id); END IF;
    WHEN 'goods_receipts' THEN
      PERFORM erp_thb_assert_source('purchase_orders', NEW.purchase_order_id);
    WHEN 'subcontract_agreement_versions', 'subcontract_work_orders', 'subcontract_claims',
         'subcontract_certifications', 'subcontract_variations' THEN
      PERFORM erp_thb_assert_source('subcontract_agreements', NEW.agreement_id);
    WHEN 'subcontract_claim_assessments' THEN
      PERFORM erp_thb_assert_source('subcontract_claims', NEW.claim_id);
    WHEN 'client_invoices', 'project_variations' THEN
      PERFORM erp_thb_assert_source('projects', NEW.project_id);
    WHEN 'retention_ledger_entries' THEN
      PERFORM erp_thb_assert_source('subcontract_certifications', NEW.certification_id);
    ELSE NULL;
  END CASE;
  IF TG_OP = 'UPDATE' THEN PERFORM erp_thb_assert_source(TG_TABLE_NAME, NEW.id); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE name TEXT;
BEGIN
  FOREACH name IN ARRAY ARRAY['projects','boqs','budget_revisions','supplier_quotations',
    'quotation_awards','purchase_orders','goods_receipts','subcontract_agreements',
    'subcontract_agreement_versions','subcontract_work_orders','subcontract_claims',
    'subcontract_claim_assessments','subcontract_certifications','subcontract_variations',
    'supplier_invoices','client_invoices','payments','retention_ledger_entries',
    'direct_cost_postings','project_variations','cost_forecasts'] LOOP
    EXECUTE format('CREATE TRIGGER zz_thb_root_policy BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION erp_thb_root_guard()', name);
  END LOOP;
END $$;

-- Child writes cannot change an unknown/foreign parent into new commercial
-- value, including deletion of a historical price/allocation. Existing source
-- scope/amount/state guards continue to apply independently.
CREATE FUNCTION erp_thb_child_guard() RETURNS trigger AS $$
DECLARE row_data JSONB; old_data JSONB; parent_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD); ELSE row_data := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    old_data := to_jsonb(OLD);
    IF row_data->TG_ARGV[1] IS DISTINCT FROM old_data->TG_ARGV[1] THEN
      RAISE EXCEPTION USING ERRCODE = 'P1201', MESSAGE = 'ERP_THB_PROVENANCE_IMMUTABLE';
    END IF;
  END IF;
  parent_id := (row_data->>TG_ARGV[1])::UUID;
  PERFORM erp_thb_assert_source(TG_ARGV[0], parent_id);
  IF TG_TABLE_NAME = 'purchase_order_lines' THEN
    PERFORM erp_thb_assert_source('quotation_awards', (row_data->>'quotation_award_id')::UUID);
    PERFORM erp_thb_assert_source('supplier_quotations', (row_data->>'supplier_quotation_id')::UUID);
  ELSIF TG_TABLE_NAME = 'supplier_invoice_items' THEN
    IF row_data->>'purchase_order_line_id' IS NOT NULL THEN
      SELECT purchase_order_id INTO parent_id FROM purchase_order_lines WHERE id = (row_data->>'purchase_order_line_id')::UUID;
      PERFORM erp_thb_assert_source('purchase_orders', parent_id);
    END IF;
    IF row_data->>'goods_receipt_item_id' IS NOT NULL THEN
      SELECT goods_receipt_id INTO parent_id FROM goods_receipt_items WHERE id = (row_data->>'goods_receipt_item_id')::UUID;
      PERFORM erp_thb_assert_source('goods_receipts', parent_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'supplier_payment_allocations' THEN
    PERFORM erp_thb_assert_source('supplier_invoices', (row_data->>'supplier_invoice_id')::UUID);
  ELSIF TG_TABLE_NAME = 'client_receipt_allocations' THEN
    PERFORM erp_thb_assert_source('client_invoices', (row_data->>'client_invoice_id')::UUID);
  ELSIF TG_TABLE_NAME = 'subcontract_payment_allocations' THEN
    PERFORM erp_thb_assert_source('subcontract_certifications', (row_data->>'subcontract_certification_id')::UUID);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE contract TEXT[];
BEGIN
  FOREACH contract SLICE 1 IN ARRAY ARRAY[
    ['boq_sections','boqs','boq_id'], ['boq_items','boqs','boq_id'],
    ['budget_revision_lines','budget_revisions','budget_revision_id'],
    ['supplier_quotation_lines','supplier_quotations','supplier_quotation_id'],
    ['purchase_order_lines','purchase_orders','purchase_order_id'],
    ['goods_receipt_items','goods_receipts','goods_receipt_id'],
    ['subcontract_claim_lines','subcontract_claims','claim_id'],
    ['supplier_invoice_items','supplier_invoices','supplier_invoice_id'],
    ['client_invoice_items','client_invoices','client_invoice_id'],
    ['supplier_payment_allocations','payments','payment_id'],
    ['client_receipt_allocations','payments','payment_id'],
    ['subcontract_payment_allocations','payments','payment_id'],
    ['cost_forecast_lines','cost_forecasts','forecast_id']
  ] LOOP
    EXECUTE format('CREATE TRIGGER zz_thb_child_policy BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION erp_thb_child_guard(%L,%L)', contract[1], contract[2], contract[3]);
  END LOOP;
END $$;

-- These workflows retain their approval state outside the commercial header.
-- Validate the canonical source before starting/advancing approval, as well as
-- before appending APPROVE evidence. Reject/cancel evidence is not new value.
CREATE FUNCTION erp_thb_approval_guard() RETURNS trigger AS $$
DECLARE instance RECORD; source_table TEXT;
BEGIN
  IF TG_TABLE_NAME = 'approval_actions' THEN
    IF NEW.action <> 'APPROVE' THEN RETURN NEW; END IF;
    SELECT * INTO instance FROM approval_instances WHERE id = NEW.approval_instance_id;
  ELSE
    IF NEW.approval_state NOT IN ('SUBMITTED','APPROVED') THEN RETURN NEW; END IF;
    instance := NEW;
  END IF;
  source_table := CASE instance.entity_type
    WHEN 'BUDGET_REVISION' THEN 'budget_revisions'
    WHEN 'PURCHASE_ORDER' THEN 'purchase_orders'
    WHEN 'GOODS_RECEIPT' THEN 'goods_receipts'
    WHEN 'SUBCONTRACT_AGREEMENT' THEN 'subcontract_agreement_versions'
    WHEN 'SUBCONTRACT_AGREEMENT_REVISION' THEN 'subcontract_agreement_versions'
    WHEN 'SUBCONTRACT_WORK_ORDER' THEN 'subcontract_work_orders'
    WHEN 'SUBCONTRACT_CERTIFICATION' THEN 'subcontract_certifications'
    WHEN 'SUBCONTRACT_VARIATION' THEN 'subcontract_variations'
    WHEN 'SUPPLIER_INVOICE' THEN 'supplier_invoices'
    WHEN 'CLIENT_INVOICE' THEN 'client_invoices'
    WHEN 'PAYMENT' THEN 'payments'
    WHEN 'DIRECT_COST_POSTING' THEN 'direct_cost_postings'
    WHEN 'COST_FORECAST' THEN 'cost_forecasts'
    WHEN 'PROJECT_VARIATION' THEN 'project_variations'
    ELSE NULL END;
  IF source_table IS NOT NULL THEN PERFORM erp_thb_assert_source(source_table, instance.entity_id); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER zz_thb_approval_policy BEFORE INSERT OR UPDATE ON approval_instances
FOR EACH ROW EXECUTE FUNCTION erp_thb_approval_guard();
CREATE TRIGGER zz_thb_approval_action_policy BEFORE INSERT ON approval_actions
FOR EACH ROW EXECUTE FUNCTION erp_thb_approval_guard();
