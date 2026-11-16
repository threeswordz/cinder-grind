-- Posted receipt lines must be committed with their original receipt posting,
-- never appended to an already committed acknowledgment in a later transaction.
CREATE OR REPLACE FUNCTION erp_transfer_receipt_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r transfer_receipts; i stock_transfer_items; accepted numeric;
BEGIN
 SELECT * INTO r FROM transfer_receipts WHERE id=NEW.receipt_id;
 PERFORM 1 FROM transfer_custodies WHERE transfer_id=r.transfer_id FOR UPDATE;
 SELECT * INTO i FROM stock_transfer_items WHERE id=NEW.transfer_item_id;
 SELECT COALESCE(sum(l.quantity),0) INTO accepted FROM transfer_receipt_lines l JOIN transfer_receipts rr ON rr.id=l.receipt_id WHERE l.transfer_item_id=i.id AND rr.posted_at IS NOT NULL;
 IF NOT EXISTS(SELECT 1 FROM transfer_receipts WHERE id=r.id AND xmin=pg_current_xact_id()::text::xid)
  OR r.posted_at IS NULL OR i.stock_transfer_id IS DISTINCT FROM r.transfer_id OR i.destination_project_id IS DISTINCT FROM r.project_id OR accepted+NEW.quantity>i.quantity
 THEN RAISE EXCEPTION 'TRANSFER_OVERRECEIPT_OR_DIMENSION_INVALID'; END IF;
 RETURN NEW;
END $$;
