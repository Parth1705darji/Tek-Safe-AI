-- ============================================================
-- Tek-Safe AI — RBAC Migration
-- Run AFTER 001 and 002 migrations in Supabase SQL Editor
-- ============================================================

-- Add role column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT
    DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update RLS policies to allow admin queries
-- Admins can read all users (for user management dashboard)
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- Admins can update user roles and tiers
CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );
