-- SS16 draft: additive immutable request, separate from original posting approval.
CREATE TABLE "movement_correction_requests" (
 "id" UUID NOT NULL,
 "company_id" UUID NOT NULL,
 "source_kind" VARCHAR(30) NOT NULL CHECK ("source_kind" IN ('GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER')),
 "source_id" UUID NOT NULL,
 "source_posted_at" TIMESTAMPTZ(6) NOT NULL,
 "request_key" VARCHAR(120) NOT NULL CHECK (length(btrim("request_key")) > 0),
 "reason" TEXT NOT NULL CHECK (length(btrim("reason")) BETWEEN 1 AND 1000),
 "requested_by_user_id" UUID NOT NULL,
 "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "approval_instance_id" UUID NOT NULL,
 CONSTRAINT "movement_correction_requests_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "movement_correction_company_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "movement_correction_requester_fk" FOREIGN KEY ("company_id","requested_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "movement_correction_approval_fk" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "movement_correction_requests_approval_instance_id_key" ON "movement_correction_requests"("approval_instance_id");
CREATE UNIQUE INDEX "movement_correction_request_replay_key" ON "movement_correction_requests"("company_id","source_kind","source_id","request_key");
CREATE INDEX "movement_correction_source_idx" ON "movement_correction_requests"("company_id","source_kind","source_id");
CREATE FUNCTION ss16_immutable_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Movement correction request is immutable' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER ss16_immutable_request BEFORE UPDATE OR DELETE ON "movement_correction_requests"
 FOR EACH ROW EXECUTE FUNCTION ss16_immutable_request();
