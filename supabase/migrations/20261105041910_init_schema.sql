CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'expired', 'voided');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('basic', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."lesson_tier" AS ENUM('foundations', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('beginner', 'basic', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."mode" AS ENUM('online', 'kiosk');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('respondent', 'facilitator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'prefer_not_to_say');--> statement-breakpoint
CREATE TABLE "kiosk_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facilitator_id" uuid NOT NULL,
	"device_label" text NOT NULL,
	"pin_hash" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kiosk_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"role" "role" DEFAULT 'respondent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sign_in_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "respondents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid,
	"student_number" text NOT NULL,
	"full_name" text NOT NULL,
	"course" text NOT NULL,
	"year_level" smallint NOT NULL,
	"age" smallint NOT NULL,
	"sex" "sex" NOT NULL,
	"devices" text[] DEFAULT '{}' NOT NULL,
	"internet_access" text[] DEFAULT '{}' NOT NULL,
	"show_identity" boolean DEFAULT false NOT NULL,
	"mode" "mode" NOT NULL,
	"consent_version" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "respondents_profile_id_unique" UNIQUE("profile_id"),
	CONSTRAINT "respondents_student_number_unique" UNIQUE("student_number"),
	CONSTRAINT "respondents_student_number_upper" CHECK ("respondents"."student_number" = upper("respondents"."student_number")),
	CONSTRAINT "respondents_year_level_range" CHECK ("respondents"."year_level" between 1 and 4)
);
--> statement-breakpoint
ALTER TABLE "respondents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "choices_question_position_unique" UNIQUE("question_id","position"),
	CONSTRAINT "choices_position_range" CHECK ("choices"."position" between 0 and 3)
);
--> statement-breakpoint
ALTER TABLE "choices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "competency_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "competency_areas_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "competency_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_id" uuid NOT NULL,
	"tier" "lesson_tier" NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body_md" text NOT NULL,
	"image_url" text,
	"video_url" text,
	"resources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_id" uuid NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"stem" text NOT NULL,
	"image_url" text,
	"is_scenario" boolean DEFAULT false NOT NULL,
	"explanation" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "answers" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"choice_id" uuid NOT NULL,
	"points" smallint,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answers_attempt_id_question_id_pk" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "area_results" (
	"attempt_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"points" smallint NOT NULL,
	"max_points" smallint NOT NULL,
	"pct" numeric(5, 2) NOT NULL,
	"level" "level" NOT NULL,
	CONSTRAINT "area_results_attempt_id_area_id_pk" PRIMARY KEY("attempt_id","area_id")
);
--> statement-breakpoint
ALTER TABLE "area_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"respondent_id" uuid NOT NULL,
	"kiosk_session_id" uuid,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"question_order" uuid[] NOT NULL,
	"choice_order" jsonb NOT NULL,
	"total_points" smallint,
	"overall_pct" numeric(5, 2),
	"overall_level" "level",
	"results_token" text,
	"void_reason" text,
	"voided_by" uuid,
	CONSTRAINT "attempts_results_token_unique" UNIQUE("results_token")
);
--> statement-breakpoint
ALTER TABLE "attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sus_responses" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"q1" smallint NOT NULL,
	"q2" smallint NOT NULL,
	"q3" smallint NOT NULL,
	"q4" smallint NOT NULL,
	"q5" smallint NOT NULL,
	"q6" smallint NOT NULL,
	"q7" smallint NOT NULL,
	"q8" smallint NOT NULL,
	"q9" smallint NOT NULL,
	"q10" smallint NOT NULL,
	"score" numeric(4, 1) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sus_responses_answers_range" CHECK (least("sus_responses"."q1", "sus_responses"."q2", "sus_responses"."q3", "sus_responses"."q4", "sus_responses"."q5", "sus_responses"."q6", "sus_responses"."q7", "sus_responses"."q8", "sus_responses"."q9", "sus_responses"."q10") >= 1
        and greatest("sus_responses"."q1", "sus_responses"."q2", "sus_responses"."q3", "sus_responses"."q4", "sus_responses"."q5", "sus_responses"."q6", "sus_responses"."q7", "sus_responses"."q8", "sus_responses"."q9", "sus_responses"."q10") <= 5),
	CONSTRAINT "sus_responses_score_range" CHECK ("sus_responses"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "sus_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "kiosk_sessions" ADD CONSTRAINT "kiosk_sessions_facilitator_id_profiles_id_fk" FOREIGN KEY ("facilitator_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choices" ADD CONSTRAINT "choices_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_area_id_competency_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."competency_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_area_id_competency_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."competency_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_choice_id_choices_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."choices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_results" ADD CONSTRAINT "area_results_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_results" ADD CONSTRAINT "area_results_area_id_competency_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."competency_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_respondent_id_respondents_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."respondents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_kiosk_session_id_kiosk_sessions_id_fk" FOREIGN KEY ("kiosk_session_id") REFERENCES "public"."kiosk_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_voided_by_profiles_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sus_responses" ADD CONSTRAINT "sus_responses_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "respondents_course_year_level_idx" ON "respondents" USING btree ("course","year_level");--> statement-breakpoint
CREATE UNIQUE INDEX "choices_one_correct_idx" ON "choices" USING btree ("question_id") WHERE "choices"."is_correct";--> statement-breakpoint
CREATE INDEX "answers_question_id_idx" ON "answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_per_respondent_idx" ON "attempts" USING btree ("respondent_id") WHERE "attempts"."status" <> 'voided';--> statement-breakpoint
CREATE INDEX "attempts_status_submitted_at_idx" ON "attempts" USING btree ("status","submitted_at");