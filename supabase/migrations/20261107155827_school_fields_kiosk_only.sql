ALTER TABLE "respondents" ALTER COLUMN "student_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "respondents" ALTER COLUMN "course" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "respondents" ALTER COLUMN "year_level" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_school_fields_by_mode" CHECK (("respondents"."mode" = 'kiosk' and "respondents"."student_number" is not null and "respondents"."course" is not null
          and "respondents"."year_level" is not null and "respondents"."profile_id" is null)
        or ("respondents"."mode" = 'online' and "respondents"."student_number" is null and "respondents"."course" is null
          and "respondents"."year_level" is null));