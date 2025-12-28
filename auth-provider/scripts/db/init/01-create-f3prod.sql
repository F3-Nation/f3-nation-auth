-- Create second user and database for F3_DATABASE_URL (local development)
-- This script runs automatically when the PostgreSQL container initializes with an empty data volume

CREATE USER f3prod WITH PASSWORD 'f3prod_local_dev';
CREATE DATABASE f3prod_dev OWNER f3prod;
GRANT ALL PRIVILEGES ON DATABASE f3prod_dev TO f3prod;

-- Connect to f3prod_dev and create required extensions and types
\c f3prod_dev
CREATE EXTENSION IF NOT EXISTS citext;

-- Create custom types used by the users table
CREATE TYPE public.user_status AS ENUM ('active', 'inactive');

-- Create trigger function for updated timestamps (used by triggers)
CREATE OR REPLACE FUNCTION public.set_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also add citext to the main database for consistency
\c f3auth_dev
CREATE EXTENSION IF NOT EXISTS citext;
