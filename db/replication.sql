-- PowerSync Replication Setup
-- Run this after enabling logical replication in Neon Console

-- Create replication role for PowerSync Service
CREATE ROLE powersync_role WITH REPLICATION BYPASSRLS LOGIN PASSWORD 'REPLACE_WITH_SECURE_PASSWORD';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO powersync_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;

-- Create publication for PowerSync to stream changes
CREATE PUBLICATION powersync FOR ALL TABLES;

