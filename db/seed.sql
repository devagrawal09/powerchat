-- Seed demo data for PowerChat
-- Creates one demo agent and one demo channel

-- Insert demo agent
INSERT INTO agents (id, name, model_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'assistant',
  '{"model": "gpt-5", "temperature": 0.7}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

-- Note: Demo channel and memberships will be created when the first user creates a channel

