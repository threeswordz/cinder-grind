CREATE TABLE "document_types" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "document_type_code" VARCHAR(80) NOT NULL,
  "document_type_name" VARCHAR(150) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "document_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "document_types_company_id_document_type_code_key" ON "document_types"("company_id", "document_type_code");
CREATE INDEX "document_types_company_id_is_active_idx" ON "document_types"("company_id", "is_active");

CREATE TABLE "documents" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "document_type_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "storage_provider" VARCHAR(30) NOT NULL,
  "storage_key" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(255) NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "uploaded_by_user_id" UUID NOT NULL,
  "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checksum" VARCHAR(64),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_file_size_nonnegative" CHECK ("file_size_bytes" >= 0),
  CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");
CREATE INDEX "documents_company_id_is_active_uploaded_at_idx" ON "documents"("company_id", "is_active", "uploaded_at");
CREATE INDEX "documents_document_type_id_idx" ON "documents"("document_type_id");
CREATE INDEX "documents_uploaded_by_user_id_idx" ON "documents"("uploaded_by_user_id");

CREATE TABLE "document_links" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" UUID NOT NULL,
  "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linked_by_user_id" UUID NOT NULL,
  CONSTRAINT "document_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "document_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "document_links_document_id_entity_type_entity_id_key" ON "document_links"("document_id", "entity_type", "entity_id");
CREATE INDEX "document_links_entity_type_entity_id_idx" ON "document_links"("entity_type", "entity_id");
CREATE INDEX "document_links_linked_by_user_id_idx" ON "document_links"("linked_by_user_id");
