-- Runs once, on an empty data directory. api/common connects as
-- upstat_app: a non-superuser that owns its database, so FORCE row-level
-- security applies to it (S-9). Superusers bypass RLS entirely.
CREATE ROLE upstat_app LOGIN PASSWORD 'upstat_app' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE upstat OWNER upstat_app;
