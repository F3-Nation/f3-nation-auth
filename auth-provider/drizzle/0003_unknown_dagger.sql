DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'user'
			AND column_name = 'phone'
	) THEN
		ALTER TABLE "user" DROP COLUMN "phone";
	END IF;
END $$;
