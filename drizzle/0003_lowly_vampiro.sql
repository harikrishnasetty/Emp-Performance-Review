CREATE TYPE "public"."goal_type" AS ENUM('INDIVIDUAL', 'COLLABORATIVE');--> statement-breakpoint
ALTER TABLE "cycle_participants" ADD COLUMN "employee_signature_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "goal_type" "goal_type" DEFAULT 'INDIVIDUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "individual_goal_weight" numeric(5, 2) DEFAULT '70.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "collaborative_goal_weight" numeric(5, 2) DEFAULT '30.00' NOT NULL;--> statement-breakpoint
CREATE INDEX "cycle_participants_signature_idx" ON "cycle_participants" USING btree ("employee_signature_at");