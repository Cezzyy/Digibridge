DROP INDEX "respondents_course_year_level_idx";--> statement-breakpoint
CREATE INDEX "respondents_course_year_level_idx" ON "respondents" USING btree ("course","year_level") WHERE "respondents"."course" is not null;--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_age_range" CHECK ("respondents"."age" between 10 and 99);