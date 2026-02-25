-- Insert default workspace limit for the default workspace if it doesn't exist
INSERT INTO public.workspace_limits (workspace_id, connection_limit)
VALUES ('00000000-0000-0000-0000-000000000000', 1)
ON CONFLICT (workspace_id) DO NOTHING;