-- CreateTable
CREATE TABLE "material_uom_bases" (
    "material_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "stock_uom_id" UUID NOT NULL,
    "stock_precision" INTEGER NOT NULL,
    "stock_uom_code" VARCHAR(30) NOT NULL,
    "stock_uom_name" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_uom_bases_pkey" PRIMARY KEY ("material_id")
);

-- CreateTable
CREATE TABLE "material_uom_revisions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "source_uom_id" UUID NOT NULL,
    "source_precision" INTEGER NOT NULL,
    "source_uom_code" VARCHAR(30) NOT NULL,
    "source_uom_name" VARCHAR(100) NOT NULL,
    "effective_from" DATE NOT NULL,
    "numerator" VARCHAR(38) NOT NULL,
    "denominator" VARCHAR(38) NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_uom_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_uom_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "material_id" UUID NOT NULL,
    "input" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_uom_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_uom_bases_operation_id_key" ON "material_uom_bases"("operation_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_uom_bases_company_id_material_id_key" ON "material_uom_bases"("company_id", "material_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_uom_revisions_operation_id_key" ON "material_uom_revisions"("operation_id");

-- CreateIndex
CREATE INDEX "material_uom_revisions_company_id_material_id_source_uom_id_idx" ON "material_uom_revisions"("company_id", "material_id", "source_uom_id", "effective_from", "revision_no");

-- CreateIndex
CREATE UNIQUE INDEX "material_uom_revisions_material_id_revision_no_key" ON "material_uom_revisions"("material_id", "revision_no");

-- CreateIndex
CREATE INDEX "material_uom_operations_company_id_material_id_created_at_idx" ON "material_uom_operations"("company_id", "material_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_uom_operations_company_id_actor_user_id_request_ke_key" ON "material_uom_operations"("company_id", "actor_user_id", "request_key");
