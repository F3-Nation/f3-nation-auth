DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'user'
			AND column_name = 'name'
	) AND NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'user'
			AND column_name = 'hospital_name'
	) THEN
		ALTER TABLE "user" RENAME COLUMN "name" TO "hospital_name";
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "f3_name" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false NOT NULL;
