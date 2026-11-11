CREATE TYPE "public"."calibration_status" AS ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."competency_category" AS ENUM('CORE', 'FUNCTIONAL', 'LEADERSHIP', 'VALUES');--> statement-breakpoint
CREATE TYPE "public"."confidence" AS ENUM('ON_TRACK', 'NEEDS_ATTENTION', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."cycle_status" AS ENUM('DRAFT', 'SCHEDULED', 'GOAL_SETTING', 'SELF_REVIEW', 'MANAGER_REVIEW', 'CALIBRATION', 'ACKNOWLEDGEMENT', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."cycle_type" AS ENUM('ANNUAL', 'MID_YEAR', 'QUARTERLY', 'PROBATION', 'PROJECT', 'AD_HOC');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('ACTIVE', 'ON_LEAVE', 'NOTICE_PERIOD', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'VENDOR');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('PRAISE', 'CONSTRUCTIVE', 'COACHING', 'RECOGNITION');--> statement-breakpoint
CREATE TYPE "public"."goal_category" AS ENUM('BUSINESS', 'OKR', 'DEVELOPMENT', 'COMPLIANCE', 'PEOPLE');--> statement-breakpoint
CREATE TYPE "public"."goal_metric" AS ENUM('PERCENT', 'NUMERIC', 'CURRENCY', 'BOOLEAN', 'MILESTONE');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('DRAFT', 'NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'ACHIEVED', 'MISSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."one_on_one_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."participant_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'SELF_COMPLETE', 'MANAGER_COMPLETE', 'AWAITING_ACKNOWLEDGEMENT', 'COMPLETE', 'EXCLUDED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'ACKNOWLEDGED', 'LOCKED');--> statement-breakpoint
CREATE TYPE "public"."reviewer_type" AS ENUM('SELF', 'MANAGER', 'PEER', 'SKIP_LEVEL', 'HR');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('ADMIN', 'HR', 'EXEC', 'USER');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('DRAFT', 'PUBLISHED', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('PRIVATE', 'MANAGER', 'TEAM', 'ORGANIZATION');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_email" varchar(320),
	"actor_role" varchar(32),
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(48) NOT NULL,
	"entity_id" varchar(128),
	"target_user_id" uuid,
	"summary" text,
	"metadata" jsonb,
	"ip_address" varchar(64),
	"user_agent" text,
	"request_id" varchar(64),
	"prev_hash" varchar(64) NOT NULL,
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" varchar(128) NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"code_verifier" varchar(256) NOT NULL,
	"return_to" varchar(512),
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibration_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"proposed_rating" numeric(5, 2),
	"agreed_rating" numeric(5, 2),
	"notes_enc" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibration_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"department_id" uuid,
	"facilitator_id" uuid,
	"scheduled_at" timestamp with time zone,
	"status" "calibration_status" DEFAULT 'PLANNED' NOT NULL,
	"notes_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"category" "competency_category" DEFAULT 'CORE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"manager_id" uuid,
	"department_id" uuid,
	"status" "participant_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"goals_score" numeric(5, 2),
	"competencies_score" numeric(5, 2),
	"overall_score" numeric(5, 2),
	"proposed_rating" numeric(5, 2),
	"final_rating" numeric(5, 2),
	"nine_box_performance" integer,
	"nine_box_potential" integer,
	"calibrated_at" timestamp with time zone,
	"calibrated_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(32) NOT NULL,
	"parent_id" uuid,
	"head_id" uuid,
	"cost_center" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giver_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"cycle_id" uuid,
	"type" "feedback_type" DEFAULT 'PRAISE' NOT NULL,
	"visibility" "visibility" DEFAULT 'MANAGER' NOT NULL,
	"message_enc" text NOT NULL,
	"competency_id" uuid,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"cycle_id" uuid,
	"message" text,
	"status" varchar(24) DEFAULT 'PENDING' NOT NULL,
	"due_date" date,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"confidence" "confidence" DEFAULT 'ON_TRACK' NOT NULL,
	"status" "goal_status" DEFAULT 'ON_TRACK' NOT NULL,
	"note_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"cycle_id" uuid,
	"parent_goal_id" uuid,
	"title" varchar(240) NOT NULL,
	"description" text,
	"category" "goal_category" DEFAULT 'BUSINESS' NOT NULL,
	"metric_type" "goal_metric" DEFAULT 'PERCENT' NOT NULL,
	"status" "goal_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"confidence" "confidence" DEFAULT 'ON_TRACK' NOT NULL,
	"visibility" "visibility" DEFAULT 'MANAGER' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"start_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"target_value" numeric(18, 2) DEFAULT '100' NOT NULL,
	"current_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"unit" varchar(24),
	"weight" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"start_date" date,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"created_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(320),
	"ip_address" varchar(64),
	"outcome" varchar(32) NOT NULL,
	"reason" varchar(160),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(48) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"href" varchar(512),
	"actor_id" uuid,
	"entity_type" varchar(48),
	"entity_id" varchar(128),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_on_one_action_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"description" varchar(400) NOT NULL,
	"owner_id" uuid,
	"due_date" date,
	"status" "task_status" DEFAULT 'TODO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "one_on_ones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"status" "one_on_one_status" DEFAULT 'SCHEDULED' NOT NULL,
	"agenda" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes_enc" text,
	"mood" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_scale_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"label" varchar(80) NOT NULL,
	"description" text,
	"color" varchar(16) DEFAULT '#6366f1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"min_value" integer DEFAULT 1 NOT NULL,
	"max_value" integer DEFAULT 5 NOT NULL,
	"distribution_guide" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"description" text,
	"type" "cycle_type" DEFAULT 'ANNUAL' NOT NULL,
	"status" "cycle_status" DEFAULT 'DRAFT' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"self_review_due" date,
	"manager_review_due" date,
	"calibration_due" date,
	"acknowledgement_due" date,
	"template_id" uuid,
	"rating_scale_id" uuid,
	"self_review_enabled" boolean DEFAULT true NOT NULL,
	"peer_review_enabled" boolean DEFAULT true NOT NULL,
	"peer_review_count" integer DEFAULT 3 NOT NULL,
	"skip_level_enabled" boolean DEFAULT false NOT NULL,
	"goals_weight" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"competencies_weight" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"department_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"template_competency_id" uuid NOT NULL,
	"rating_value" integer,
	"comment_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "template_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"reviewer_type" "reviewer_type" NOT NULL,
	"status" "review_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"summary_enc" text,
	"strengths_enc" text,
	"development_enc" text,
	"overall_rating" numeric(5, 2),
	"acknowledgement_comment_enc" text,
	"submitted_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"return_reason" text,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"csrf_hash" varchar(64) NOT NULL,
	"auth_method" varchar(32) DEFAULT 'entra-oidc' NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid,
	"title" varchar(240) NOT NULL,
	"description" text,
	"assignee_id" uuid NOT NULL,
	"created_by" uuid,
	"status" "task_status" DEFAULT 'TODO' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"estimate_hours" numeric(6, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"competency_id" uuid,
	"name" varchar(160) NOT NULL,
	"description" text,
	"category" "competency_category" DEFAULT 'CORE' NOT NULL,
	"weight" numeric(5, 2) DEFAULT '1.00' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"requires_comment" boolean DEFAULT false NOT NULL,
	"applies_to_manager_only" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entra_object_id" varchar(128),
	"tenant_id" varchar(128),
	"email" varchar(320) NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"given_name" varchar(120),
	"surname" varchar(120),
	"job_title" varchar(160),
	"department_id" uuid,
	"manager_id" uuid,
	"employee_code" varchar(64),
	"employment_type" "employment_type" DEFAULT 'FULL_TIME' NOT NULL,
	"status" "employment_status" DEFAULT 'ACTIVE' NOT NULL,
	"system_role" "system_role" DEFAULT 'USER' NOT NULL,
	"hire_date" date,
	"location" varchar(120),
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"locale" varchar(12) DEFAULT 'en-IN' NOT NULL,
	"avatar_url" text,
	"bio" text,
	"extra_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "calibration_entries" ADD CONSTRAINT "calibration_entries_session_id_calibration_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."calibration_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_entries" ADD CONSTRAINT "calibration_entries_participant_id_cycle_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."cycle_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_entries" ADD CONSTRAINT "calibration_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_sessions" ADD CONSTRAINT "calibration_sessions_facilitator_id_users_id_fk" FOREIGN KEY ("facilitator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_participants" ADD CONSTRAINT "cycle_participants_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_participants" ADD CONSTRAINT "cycle_participants_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_updates" ADD CONSTRAINT "goal_updates_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_updates" ADD CONSTRAINT "goal_updates_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_on_one_action_items" ADD CONSTRAINT "one_on_one_action_items_meeting_id_one_on_ones_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."one_on_ones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_on_one_action_items" ADD CONSTRAINT "one_on_one_action_items_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_on_ones" ADD CONSTRAINT "one_on_ones_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "one_on_ones" ADD CONSTRAINT "one_on_ones_employee_id_users_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_scale_levels" ADD CONSTRAINT "rating_scale_levels_scale_id_rating_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."rating_scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_template_id_review_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."review_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_rating_scale_id_rating_scales_id_fk" FOREIGN KEY ("rating_scale_id") REFERENCES "public"."rating_scales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_ratings" ADD CONSTRAINT "review_ratings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_ratings" ADD CONSTRAINT "review_ratings_template_competency_id_template_competencies_id_fk" FOREIGN KEY ("template_competency_id") REFERENCES "public"."template_competencies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_templates" ADD CONSTRAINT "review_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_cycle_id_review_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_participant_id_cycle_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."cycle_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_competencies" ADD CONSTRAINT "template_competencies_template_id_review_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."review_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_competencies" ADD CONSTRAINT "template_competencies_competency_id_competencies_id_fk" FOREIGN KEY ("competency_id") REFERENCES "public"."competencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_occurred_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_states_state_key" ON "auth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "auth_states_expiry_idx" ON "auth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "calibration_entries_key" ON "calibration_entries" USING btree ("session_id","participant_id");--> statement-breakpoint
CREATE INDEX "calibration_sessions_cycle_idx" ON "calibration_sessions" USING btree ("cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competencies_name_key" ON "competencies" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_participants_key" ON "cycle_participants" USING btree ("cycle_id","employee_id");--> statement-breakpoint
CREATE INDEX "cycle_participants_employee_idx" ON "cycle_participants" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "cycle_participants_manager_idx" ON "cycle_participants" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "cycle_participants_status_idx" ON "cycle_participants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_key" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "departments_parent_idx" ON "departments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "feedback_receiver_idx" ON "feedback" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "feedback_giver_idx" ON "feedback" USING btree ("giver_id");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_requests_provider_idx" ON "feedback_requests" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "feedback_requests_requester_idx" ON "feedback_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "goal_updates_goal_idx" ON "goal_updates" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goals_owner_idx" ON "goals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "goals_cycle_idx" ON "goals" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "goals_parent_idx" ON "goals" USING btree ("parent_goal_id");--> statement-breakpoint
CREATE INDEX "goals_status_idx" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "login_attempts_created_idx" ON "login_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "one_on_one_action_items_meeting_idx" ON "one_on_one_action_items" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "one_on_ones_manager_idx" ON "one_on_ones" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "one_on_ones_employee_idx" ON "one_on_ones" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "one_on_ones_scheduled_idx" ON "one_on_ones" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_scale_levels_key" ON "rating_scale_levels" USING btree ("scale_id","value");--> statement-breakpoint
CREATE UNIQUE INDEX "review_cycles_slug_key" ON "review_cycles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "review_cycles_status_idx" ON "review_cycles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "review_ratings_key" ON "review_ratings" USING btree ("review_id","template_competency_id");--> statement-breakpoint
CREATE INDEX "review_ratings_review_idx" ON "review_ratings" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_templates_name_version_key" ON "review_templates" USING btree ("name","version");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_unique_key" ON "reviews" USING btree ("participant_id","reviewer_type","reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_cycle_idx" ON "reviews" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("absolute_expires_at");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tasks_goal_idx" ON "tasks" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "template_competencies_template_idx" ON "template_competencies" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_entra_object_id_key" ON "users" USING btree ("entra_object_id");--> statement-breakpoint
CREATE INDEX "users_manager_idx" ON "users" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "users_department_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");