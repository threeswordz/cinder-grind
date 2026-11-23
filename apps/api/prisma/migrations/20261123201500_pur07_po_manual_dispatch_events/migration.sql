-- PUR07 append-only manual email/LINE evidence. No historical PO updates/backfill.
-- A recorded event is a human assertion, NOT proof that ERP transmitted anything.
CREATE TABLE "po_dispatch_events" (
  "id" UUID PRIMARY KEY,
  "company_id" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
  "purchase_order_id" UUID NOT NULL REFERENCES "purchase_orders"("id") ON DELETE RESTRICT,
  "kind" VARCHAR(30) NOT NULL,
  "channel" VARCHAR(20) NOT NULL,
  "recipient" VARCHAR(320) NOT NULL,
  "evidence_reference" VARCHAR(1200) NOT NULL,
  "evidence_document_id" UUID REFERENCES "documents"("id") ON DELETE RESTRICT,
  "pdf_file_name" VARCHAR(255),
  "pdf_sha256" VARCHAR(64),
  "acknowledges_event_id" UUID REFERENCES "po_dispatch_events"("id") ON DELETE RESTRICT,
  "recorded_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "po_dispatch_kind_valid" CHECK ("kind" IN ('DISPATCH','ACKNOWLEDGMENT')),
  CONSTRAINT "po_dispatch_channel_valid" CHECK ("channel" IN ('EMAIL','LINE')),
  CONSTRAINT "po_dispatch_recipient_present" CHECK (length(btrim("recipient")) >= 3),
  CONSTRAINT "po_dispatch_evidence_present" CHECK (length(btrim("evidence_reference")) >= 3),
  CONSTRAINT "po_dispatch_sha_valid" CHECK ("pdf_sha256" IS NULL OR "pdf_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "po_dispatch_ack_ref_valid" CHECK (
    ("kind" = 'DISPATCH' AND "acknowledges_event_id" IS NULL)
    OR ("kind" = 'ACKNOWLEDGMENT' AND "acknowledges_event_id" IS NOT NULL)
  )
);
CREATE INDEX "po_dispatch_events_scope_idx"
  ON "po_dispatch_events" ("company_id","project_id","purchase_order_id","recorded_at");
CREATE INDEX "po_dispatch_events_ack_idx"
  ON "po_dispatch_events" ("company_id","acknowledges_event_id");
CREATE INDEX "po_dispatch_events_evidence_idx"
  ON "po_dispatch_events" ("evidence_document_id");

CREATE FUNCTION "pur07_validate_po_external_event"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_company UUID;
DECLARE source_project UUID;
DECLARE prior_kind TEXT;
DECLARE prior_company UUID;
DECLARE prior_project UUID;
DECLARE prior_po UUID;
BEGIN
  SELECT "company_id", "project_id" INTO source_company,source_project
  FROM "purchase_orders" WHERE "id" = NEW."purchase_order_id";
  IF source_company IS DISTINCT FROM NEW."company_id" OR
     source_project IS DISTINCT FROM NEW."project_id" THEN
    RAISE EXCEPTION 'PO_DISPATCH_SCOPE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF NEW."evidence_document_id" IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM "documents" d WHERE d."id" = NEW."evidence_document_id"
    AND d."company_id" = NEW."company_id"
    AND d."is_active" = TRUE
    AND EXISTS (
      SELECT 1 FROM "document_links" l WHERE l."document_id"=d."id"
      AND l."entity_type"='PROJECT' AND l."entity_id"=NEW."project_id"
    )
  ) THEN
    RAISE EXCEPTION 'PO_DISPATCH_EVIDENCE_SCOPE_INVALID' USING ERRCODE = '23514';
  END IF;
  IF NEW."kind" = 'ACKNOWLEDGMENT' THEN
    SELECT "kind","company_id","project_id","purchase_order_id"
      INTO prior_kind,prior_company,prior_project,prior_po
    FROM "po_dispatch_events" WHERE "id"=NEW."acknowledges_event_id";
    IF prior_kind IS DISTINCT FROM 'DISPATCH'
       OR prior_company IS DISTINCT FROM NEW."company_id"
       OR prior_project IS DISTINCT FROM NEW."project_id"
       OR prior_po IS DISTINCT FROM NEW."purchase_order_id" THEN
      RAISE EXCEPTION 'PO_DISPATCH_ACK_REFERENCE_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "trg_pur07_validate_external_event"
BEFORE INSERT ON "po_dispatch_events"
FOR EACH ROW EXECUTE FUNCTION "pur07_validate_po_external_event"();

CREATE FUNCTION "pur07_external_event_immutable"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PO_DISPATCH_EVENT_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "trg_pur07_external_event_immutable"
BEFORE UPDATE OR DELETE ON "po_dispatch_events"
FOR EACH ROW EXECUTE FUNCTION "pur07_external_event_immutable"();
