-- V0.1-A initial Foundation schema.
-- Generated to match the approved Prisma Company model.

CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "company_code" VARCHAR(50) NOT NULL,
    "company_name" VARCHAR(200) NOT NULL,
    "base_currency_code" VARCHAR(3) NOT NULL DEFAULT 'SGD',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_company_code_key" ON "companies"("company_code");
