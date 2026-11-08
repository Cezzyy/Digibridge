ALTER TABLE "respondents" DROP CONSTRAINT "respondents_age_range";--> statement-breakpoint
ALTER TABLE "respondents" ADD COLUMN "birth_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "respondents" DROP COLUMN "age";--> statement-breakpoint
ALTER TABLE "respondents" ADD CONSTRAINT "respondents_birth_date_range" CHECK ("respondents"."birth_date" <= ("respondents"."consented_at" at time zone 'Asia/Manila')::date - interval '10 years'
        and "respondents"."birth_date" > ("respondents"."consented_at" at time zone 'Asia/Manila')::date - interval '100 years');