-- Seed demo data for PowerChat
-- Creates one demo agent

-- Insert demo agent
INSERT INTO agents (id, name, model_config)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'assistant',
  '{"model": "openai/gpt-5", "temperature": 0.7}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET model_config = EXCLUDED.model_config;
