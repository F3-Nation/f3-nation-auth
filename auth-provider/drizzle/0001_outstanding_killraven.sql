DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'user'
			AND column_name = 'phone'
	) THEN
		ALTER TABLE "user" ADD COLUMN "phone" text;
	END IF;
END $$;
