CREATE TABLE "school_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"school" text NOT NULL,
	"label" text NOT NULL,
	"created_by" uuid,
	"course" text,
	"year_level" smallint,
	"max_responses" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_links_code_unique" UNIQUE("code"),
	CONSTRAINT "school_links_year_level_range" CHECK ("school_links"."year_level" between 1 and 4),
	CONSTRAINT "school_links_max_responses_positive" CHECK ("school_links"."max_responses" > 0)
);
--> statement-breakpoint
ALTER TABLE "school_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attempts" DROP CONSTRAINT "attempts_kiosk_session_id_kiosk_sessions_id_fk";--> statement-breakpoint
DROP TABLE "kiosk_sessions";--> statement-breakpoint
ALTER TABLE "respondents" DROP CONSTRAINT "respondents_school_fields_by_mode";--> statement-breakpoint
ALTER TYPE "public"."mode" RENAME VALUE 'kiosk' TO 'school';--> statement-breakpoint
ALTER TABLE "respondents" ADD COLUMN "access_token_hash" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "school_link_id" uuid;--> statement-breakpoint
ALTER TABLE "school_links" ADD CONSTRAINT "school_links_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_school_link_id_school_links_id_fk" FOREIGN KEY ("school_link_id") REFERENCES "public"."school_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" DROP COLUMN "kiosk_session_id";--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_access_token_hash_unique" UNIQUE("access_token_hash");--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_school_fields_by_mode" CHECK (("respondents"."mode" = 'school' and "respondents"."student_number" is not null and "respondents"."course" is not null
          and "respondents"."year_level" is not null and "respondents"."profile_id" is null and "respondents"."access_token_hash" is not null)
        or ("respondents"."mode" = 'online' and "respondents"."student_number" is null and "respondents"."course" is null
          and "respondents"."year_level" is null and "respondents"."access_token_hash" is null));