-- PowerChat Database Schema
-- Creates tables for users, agents, channels, memberships, messages

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (username-based authentication)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Agents available to invite into channels
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  model_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  system_instructions TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add columns to existing agents table if they don't exist
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_instructions TEXT NOT NULL DEFAULT '';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Memberships: users or agents
CREATE TABLE IF NOT EXISTS channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  member_type TEXT NOT NULL CHECK (member_type IN ('user','agent')),
  member_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, member_type, member_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('user','agent')),
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_channel_members_member ON channel_members (member_type, member_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages (channel_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_messages_author ON messages (author_type, author_id);
