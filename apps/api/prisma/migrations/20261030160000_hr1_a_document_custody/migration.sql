-- HR1-A #295: forward-only canonical employee attachment custody.
-- No live grants, document rows, business fixtures, HR private plaintext, or
-- new Document Type are created by this migration.
CREATE UNIQUE INDEX "documents_company_id_id_key" ON "documents"("company_id", "id");

CREATE TABLE "hr_document_attachments" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "encrypted_metadata" TEXT NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hr_document_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hr_document_attachment_values" CHECK (
    version > 0 AND octet_length(encrypted_metadata) BETWEEN 40 AND 8192
  )
);

CREATE UNIQUE INDEX "hr_document_attachments_document_id_key"
  ON "hr_document_attachments"("document_id");
CREATE UNIQUE INDEX "hr_document_attachments_company_id_employee_id_version_key"
  ON "hr_document_attachments"("company_id", "employee_id", "version");
CREATE INDEX "hr_document_attachments_company_id_employee_id_idx"
  ON "hr_document_attachments"("company_id", "employee_id");

ALTER TABLE "hr_document_attachments" ADD CONSTRAINT "hr_document_attachments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_document_attachments" ADD CONSTRAINT "hr_document_attachments_company_id_employee_id_fkey"
  FOREIGN KEY ("company_id", "employee_id") REFERENCES "employees"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_document_attachments" ADD CONSTRAINT "hr_document_attachments_company_id_document_id_fkey"
  FOREIGN KEY ("company_id", "document_id") REFERENCES "documents"("company_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "hr_document_attachments" ADD CONSTRAINT "hr_document_attachments_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lock the owning Employee and Document while checking the next append-only
-- version. No new file may have a different Company or a public filename/MIME.
CREATE FUNCTION hr_attachment_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE next_version INTEGER;
BEGIN
  PERFORM 1 FROM employees WHERE id=NEW.employee_id
    AND company_id=NEW.company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HR_ATTACHMENT_SCOPE_INVALID' USING ERRCODE='23503';
  END IF;
  PERFORM 1 FROM documents WHERE id=NEW.document_id AND company_id=NEW.company_id
    AND file_name='hr-private.enc' AND mime_type='application/octet-stream'
    AND storage_provider='LOCAL' AND file_size_bytes > 0
    AND checksum ~ '^[0-9a-f]{64}$' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HR_ATTACHMENT_CANONICAL_INVALID' USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(MAX(version),0)+1 INTO next_version
    FROM hr_document_attachments
    WHERE company_id=NEW.company_id AND employee_id=NEW.employee_id;
  IF NEW.version <> next_version THEN
    RAISE EXCEPTION 'HR_ATTACHMENT_VERSION_CONFLICT' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hr_attachment_reference_guard BEFORE INSERT ON hr_document_attachments
  FOR EACH ROW EXECUTE FUNCTION hr_attachment_reference_guard();

-- The canonical Document must have its sole HR source association by COMMIT.
-- Deferral permits the Document + private record + HR link to be created in one
-- atomic database transaction in any order, without an exposed Project alias.
CREATE FUNCTION hr_attachment_link_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM document_links WHERE document_id=NEW.document_id
      AND entity_type='HR_ATTACHMENT' AND entity_id=NEW.employee_id
  ) OR EXISTS(
    SELECT 1 FROM document_links WHERE document_id=NEW.document_id
      AND (entity_type <> 'HR_ATTACHMENT' OR entity_id <> NEW.employee_id)
  ) THEN
    RAISE EXCEPTION 'HR_ATTACHMENT_LINK_INCOMPLETE' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hr_attachment_link_complete_guard
  AFTER INSERT ON hr_document_attachments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  EXECUTE FUNCTION hr_attachment_link_complete_guard();

-- After creation, no generic link can be attached, and HR links cannot be
-- edited/deleted to erase the generic-download fail-closed source marker.
CREATE FUNCTION hr_attachment_document_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF OLD.entity_type LIKE 'HR\_%' ESCAPE '\'
      OR EXISTS(SELECT 1 FROM hr_document_attachments WHERE document_id=OLD.document_id) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_IMMUTABLE' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF EXISTS(
      SELECT 1 FROM hr_document_attachments h
      WHERE h.document_id=NEW.document_id AND
        (NEW.entity_type <> 'HR_ATTACHMENT' OR NEW.entity_id <> h.employee_id)
    ) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_PRIVATE' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER hr_attachment_document_link_guard
  BEFORE INSERT OR UPDATE OR DELETE ON document_links
  FOR EACH ROW EXECUTE FUNCTION hr_attachment_document_link_guard();

-- Private rows, exact ciphertext metadata linkage, canonical Document storage
-- pointer and audit lineage are immutable. Changes are new versions only.
CREATE TRIGGER hr_document_attachment_immutable BEFORE UPDATE OR DELETE
  ON hr_document_attachments FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();

CREATE FUNCTION hr_attachment_document_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM hr_document_attachments WHERE document_id=OLD.id) THEN
    RAISE EXCEPTION 'HR_ATTACHMENT_DOCUMENT_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER hr_attachment_document_immutable BEFORE UPDATE OR DELETE
  ON documents FOR EACH ROW EXECUTE FUNCTION hr_attachment_document_immutable();

-- Preserve existing unreferenced Employee edits, but extend the HR-history
-- identity guard to include the newly owned file records.
CREATE OR REPLACE FUNCTION hr_protect_employee_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.employee_code IS DISTINCT FROM OLD.employee_code)
 AND (EXISTS(SELECT 1 FROM hr_employments WHERE employee_id=OLD.id)
   OR EXISTS(SELECT 1 FROM hr_private_revisions WHERE employee_id=OLD.id)
   OR EXISTS(SELECT 1 FROM hr_person_links WHERE employee_id=OLD.id)
   OR EXISTS(SELECT 1 FROM hr_document_attachments WHERE employee_id=OLD.id)) THEN
  RAISE EXCEPTION 'HR_EMPLOYEE_HISTORY_PROTECTED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
