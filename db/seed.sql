-- Seed demo data for PowerChat
-- Creates one demo agent and 10 pre-seeded user profiles

-- Add claimed_at column for tracking user assignments
ALTER TABLE users ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Insert 10 pre-seeded users
INSERT INTO users (id, display_name, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Alice', now()),
  ('00000000-0000-0000-0000-000000000002', 'Bob', now()),
  ('00000000-0000-0000-0000-000000000003', 'Charlie', now()),
  ('00000000-0000-0000-0000-000000000004', 'Diana', now()),
  ('00000000-0000-0000-0000-000000000005', 'Eve', now()),
  ('00000000-0000-0000-0000-000000000006', 'Frank', now()),
  ('00000000-0000-0000-0000-000000000007', 'Grace', now()),
  ('00000000-0000-0000-0000-000000000008', 'Henry', now()),
  ('00000000-0000-0000-0000-000000000009', 'Iris', now()),
  ('00000000-0000-0000-0000-000000000010', 'Jack', now())
ON CONFLICT (id) DO NOTHING;

-- Insert demo agent
INSERT INTO agents (id, name, model_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'assistant',
  '{"model": "openai/gpt-5", "temperature": 0.7}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET model_config = EXCLUDED.model_config;

-- Note: Demo channel and memberships will be created when the first user creates a channel

