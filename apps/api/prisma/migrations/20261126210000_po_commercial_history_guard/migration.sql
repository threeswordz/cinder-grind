-- Forward-only technical hardening of PUR04/PUR01; no historical row rewrite.
-- Existing PO identity, cancellation, approval and line guards remain intact.
CREATE FUNCTION protect_purchase_order_commercial_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.approval_instance_id IS NOT NULL OR OLD.submitted_at IS NOT NULL
      OR OLD.cancelled_at IS NOT NULL OR NEW.approval_instance_id IS NOT NULL
      OR NEW.submitted_at IS NOT NULL OR NEW.cancelled_at IS NOT NULL)
     AND (NEW.delivery_location IS DISTINCT FROM OLD.delivery_location
       OR NEW.delivery_contact IS DISTINCT FROM OLD.delivery_contact
       OR NEW.delivery_terms IS DISTINCT FROM OLD.delivery_terms
       OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
       OR NEW.credit_terms IS DISTINCT FROM OLD.credit_terms
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.freight_amount IS DISTINCT FROM OLD.freight_amount
       OR NEW.additional_charge_amount IS DISTINCT FROM OLD.additional_charge_amount
       OR NEW.vat_rate_percent IS DISTINCT FROM OLD.vat_rate_percent
       OR NEW.supplier_quote_exception_reason IS DISTINCT FROM OLD.supplier_quote_exception_reason) THEN
    RAISE EXCEPTION 'PO_COMMERCIAL_HISTORY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_orders_commercial_history_guard
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION protect_purchase_order_commercial_history();

-- Serialize line mutation against the parent approval transition as well.
-- This supplements the existing award/source/immutable identity checks.
CREATE FUNCTION lock_draft_purchase_order_for_line()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_id UUID;
  parent_approval UUID;
  parent_submitted TIMESTAMPTZ;
  parent_cancelled TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN parent_id := OLD.purchase_order_id;
  ELSE parent_id := NEW.purchase_order_id; END IF;
  SELECT approval_instance_id, submitted_at, cancelled_at
    INTO parent_approval, parent_submitted, parent_cancelled
    FROM purchase_orders WHERE id = parent_id FOR UPDATE;
  IF NOT FOUND OR parent_approval IS NOT NULL OR parent_submitted IS NOT NULL
      OR parent_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Only Draft Purchase Order lines are editable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER purchase_order_lines_00_lock_draft
BEFORE INSERT OR UPDATE OR DELETE ON purchase_order_lines
FOR EACH ROW EXECUTE FUNCTION lock_draft_purchase_order_for_line();
