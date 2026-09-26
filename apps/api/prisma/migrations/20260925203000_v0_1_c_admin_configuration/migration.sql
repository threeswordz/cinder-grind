-- V0.1-C Administration configuration foundation.

CREATE TABLE "status_definitions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "status_code" VARCHAR(80) NOT NULL,
    "status_label" VARCHAR(150) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "status_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "number_sequences" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "sequence_code" VARCHAR(80) NOT NULL,
    "format_template" VARCHAR(120) NOT NULL,
    "reset_rule" VARCHAR(30) NOT NULL,
    "last_period_key" VARCHAR(20),
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "number_sequences_next_value_check" CHECK ("next_value" >= 1)
);

CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "setting_key" VARCHAR(150) NOT NULL,
    "setting_value" JSONB NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "status_definitions_company_entity_status_key"
    ON "status_definitions"("company_id", "entity_type", "status_code");
CREATE INDEX "status_definitions_company_entity_active_sort_idx"
    ON "status_definitions"("company_id", "entity_type", "is_active", "sort_order");

CREATE UNIQUE INDEX "number_sequences_company_sequence_key"
    ON "number_sequences"("company_id", "sequence_code");
CREATE INDEX "number_sequences_company_entity_idx"
    ON "number_sequences"("company_id", "entity_type");

CREATE UNIQUE INDEX "system_settings_company_setting_key"
    ON "system_settings"("company_id", "setting_key");

ALTER TABLE "status_definitions"
    ADD CONSTRAINT "status_definitions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "number_sequences"
    ADD CONSTRAINT "number_sequences_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "system_settings"
    ADD CONSTRAINT "system_settings_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
