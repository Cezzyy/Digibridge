CREATE TYPE "public"."void_reason" AS ENUM('technical', 'wrong_person', 'duplicate', 'retake_requested', 'test_entry', 'not_eligible', 'other');--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "void_reason_code" "void_reason";--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_void_fields_by_status" CHECK (case when "attempts"."status" = 'voided'
          then "attempts"."void_reason_code" is not null and "attempts"."voided_at" is not null
          else "attempts"."void_reason_code" is null and "attempts"."void_reason" is null and "attempts"."voided_at" is null
            and "attempts"."voided_by" is null end);--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_void_note_for_other" CHECK ("attempts"."void_reason_code" <> 'other' or "attempts"."void_reason" is not null);