-- ============================================================
-- Tek-Safe AI — Infrastructure rescan columns (005)
-- Run AFTER 004_infrastructure.sql
-- ============================================================

ALTER TABLE infrastructure_agents
  ADD COLUMN IF NOT EXISTS rescan_requested     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rescan_requested_at  TIMESTAMPTZ;
