-- V0.6-B concurrency hardening: the retained header can never have
-- a due date earlier than its invoice date, including direct database writes.

ALTER TABLE "client_invoices"
  ADD CONSTRAINT "client_invoices_due_date_order_check"
  CHECK ("due_date" IS NULL OR "due_date" >= "invoice_date");
