-- Create second user and database for F3_DATABASE_URL (local development)
-- This script runs automatically when the PostgreSQL container initializes with an empty data volume

CREATE USER f3prod WITH PASSWORD 'f3prod_local_dev';
CREATE DATABASE f3prod_dev OWNER f3prod;
GRANT ALL PRIVILEGES ON DATABASE f3prod_dev TO f3prod;
