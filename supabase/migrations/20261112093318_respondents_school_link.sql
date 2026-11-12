ALTER TABLE "respondents" DROP CONSTRAINT "respondents_school_fields_by_mode";--> statement-breakpoint
ALTER TABLE "respondents" ADD COLUMN "school_link_id" uuid;--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_school_link_id_school_links_id_fk" FOREIGN KEY ("school_link_id") REFERENCES "public"."school_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "respondents_school_link_id_idx" ON "respondents" USING btree ("school_link_id");--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_school_fields_by_mode" CHECK (("respondents"."mode" = 'school' and "respondents"."student_number" is not null and "respondents"."course" is not null
          and "respondents"."year_level" is not null and "respondents"."profile_id" is null and "respondents"."access_token_hash" is not null
          and "respondents"."school_link_id" is not null)
        or ("respondents"."mode" = 'online' and "respondents"."student_number" is null and "respondents"."course" is null
          and "respondents"."year_level" is null and "respondents"."access_token_hash" is null and "respondents"."school_link_id" is null));