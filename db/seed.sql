-- Seed demo data for PowerChat
-- Creates one demo agent

-- Insert demo agent
INSERT INTO agents (id, name, model_config, system_instructions, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Assistant',
  '{"model": "openai/gpt-5", "temperature": 0.7}'::jsonb,
  'You are a helpful assistant in a chat channel.',
  'A general-purpose assistant that helps users with their questions and tasks.'
)
ON CONFLICT (name) DO UPDATE SET 
  model_config = EXCLUDED.model_config,
  system_instructions = COALESCE(EXCLUDED.system_instructions, agents.system_instructions),
  description = COALESCE(EXCLUDED.description, agents.description);
