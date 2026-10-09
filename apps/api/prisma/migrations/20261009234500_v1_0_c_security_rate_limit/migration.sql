CREATE TABLE "login_rate_limit_buckets" (
    "client_key" VARCHAR(64) NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "login_rate_limit_buckets_pkey" PRIMARY KEY ("client_key"),
    CONSTRAINT "login_rate_limit_buckets_attempt_count_check" CHECK ("attempt_count" >= 1)
);

CREATE INDEX "login_rate_limit_buckets_reset_at_idx"
ON "login_rate_limit_buckets"("reset_at");
