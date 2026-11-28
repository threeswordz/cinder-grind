-- Forward-only: preserve every previously recorded posted correction unchanged.
ALTER TABLE "movement_correction_requests" ALTER COLUMN "source_posted_at" DROP NOT NULL,
 ADD COLUMN "source_approval_instance_id" UUID,
 ADD COLUMN "source_submitted_at" TIMESTAMPTZ(6);
ALTER TABLE "movement_correction_requests"
 ADD CONSTRAINT "movement_correction_original_approval_fk" FOREIGN KEY ("source_approval_instance_id")
 REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "movement_correction_exact_source_pin" CHECK (
   ("source_posted_at" IS NOT NULL AND "source_approval_instance_id" IS NULL AND "source_submitted_at" IS NULL)
   OR ("source_posted_at" IS NULL AND "source_approval_instance_id" IS NOT NULL AND "source_submitted_at" IS NOT NULL
       AND "source_approval_instance_id" <> "approval_instance_id")
 );
