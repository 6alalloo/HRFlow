-- PostgreSQL initialization script for HRFlow stack
-- This script runs automatically on first PostgreSQL container startup

-- Create the n8n database for n8n workflow engine internals
-- (HRFlow database is created via POSTGRES_DB environment variable)
CREATE DATABASE n8n;

-- Grant full privileges to the hrflow user
GRANT ALL PRIVILEGES ON DATABASE n8n TO hrflow;

-- Connect to HRFlow database and create Core schema
\c "HRFlow"
CREATE SCHEMA IF NOT EXISTS "Core";
ALTER SCHEMA "Core" OWNER TO hrflow;
GRANT ALL ON SCHEMA "Core" TO hrflow;
