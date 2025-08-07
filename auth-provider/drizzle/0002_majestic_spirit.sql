ALTER TABLE "user" RENAME COLUMN "name" TO "hospital_name";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "f3_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;