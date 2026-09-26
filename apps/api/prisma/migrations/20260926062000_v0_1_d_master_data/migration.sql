-- V0.1-D Master Data foundation.

CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_code" VARCHAR(50) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "registration_number" VARCHAR(100),
    "contact_name" VARCHAR(200),
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "supplier_code" VARCHAR(50) NOT NULL,
    "supplier_name" VARCHAR(200) NOT NULL,
    "registration_number" VARCHAR(100),
    "contact_name" VARCHAR(200),
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "uom_code" VARCHAR(30) NOT NULL,
    "uom_name" VARCHAR(100) NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "units_of_measure_decimal_places_check"
      CHECK ("decimal_places" >= 0 AND "decimal_places" <= 6)
);

CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "material_code" VARCHAR(80) NOT NULL,
    "material_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "default_uom_id" UUID NOT NULL,
    "material_category" VARCHAR(150),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customers_company_id_customer_code_key"
  ON "customers"("company_id", "customer_code");
CREATE INDEX "customers_company_id_is_active_idx"
  ON "customers"("company_id", "is_active");

CREATE UNIQUE INDEX "suppliers_company_id_supplier_code_key"
  ON "suppliers"("company_id", "supplier_code");
CREATE INDEX "suppliers_company_id_is_active_idx"
  ON "suppliers"("company_id", "is_active");

CREATE UNIQUE INDEX "units_of_measure_company_id_uom_code_key"
  ON "units_of_measure"("company_id", "uom_code");
CREATE INDEX "units_of_measure_company_id_is_active_idx"
  ON "units_of_measure"("company_id", "is_active");

CREATE UNIQUE INDEX "materials_company_id_material_code_key"
  ON "materials"("company_id", "material_code");
CREATE INDEX "materials_company_id_is_active_idx"
  ON "materials"("company_id", "is_active");
CREATE INDEX "materials_default_uom_id_idx"
  ON "materials"("default_uom_id");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "units_of_measure"
  ADD CONSTRAINT "units_of_measure_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "materials"
  ADD CONSTRAINT "materials_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "materials"
  ADD CONSTRAINT "materials_default_uom_id_fkey"
  FOREIGN KEY ("default_uom_id") REFERENCES "units_of_measure"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
