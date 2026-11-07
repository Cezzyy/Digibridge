ALTER TABLE "kiosk_sessions" DROP CONSTRAINT "kiosk_sessions_facilitator_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "answers" DROP CONSTRAINT "answers_choice_id_choices_id_fk";
--> statement-breakpoint
ALTER TABLE "kiosk_sessions" ALTER COLUMN "facilitator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kiosk_sessions" ADD CONSTRAINT "kiosk_sessions_facilitator_id_profiles_id_fk" FOREIGN KEY ("facilitator_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "choices" ADD CONSTRAINT "choices_question_id_unique" UNIQUE("question_id","id");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_choice_fk" FOREIGN KEY ("question_id","choice_id") REFERENCES "public"."choices"("question_id","id") ON DELETE no action ON UPDATE no action;