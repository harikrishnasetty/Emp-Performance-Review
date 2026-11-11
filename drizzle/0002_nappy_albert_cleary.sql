CREATE TYPE "public"."goal_approval_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'RETURNED');--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "approval_status" "goal_approval_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "approval_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "approval_decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "approval_comment" text;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_approval_idx" ON "goals" USING btree ("approval_status");--> statement-breakpoint
UPDATE "goals" SET "approval_status" = 'APPROVED', "approval_decided_at" = now() WHERE "approval_status" = 'DRAFT';