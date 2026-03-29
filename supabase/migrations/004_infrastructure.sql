-- ============================================================
-- Tek-Safe AI — Infrastructure Discovery Migration (004)
-- Run AFTER 001, 002, 003 migrations in Supabase SQL Editor
-- ============================================================

-- ----------------------------------------------------------------
-- 1. infrastructure_agents
--    One record per user — stores the activation code and agent status.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS infrastructure_agents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activation_code    TEXT UNIQUE NOT NULL,
  agent_version      TEXT,
  agent_hostname     TEXT,
  agent_platform     TEXT,
  last_heartbeat     TIMESTAMPTZ,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'active', 'offline')),
  scan_interval_min  INT NOT NULL DEFAULT 15,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_infrastructure_agents_user_id         ON infrastructure_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_infrastructure_agents_activation_code ON infrastructure_agents(activation_code);
CREATE INDEX IF NOT EXISTS idx_infrastructure_agents_status          ON infrastructure_agents(status);

-- ----------------------------------------------------------------
-- 2. network_assets
--    Every device discovered on the network by the agent.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES infrastructure_agents(id) ON DELETE CASCADE,
  ip_address          TEXT NOT NULL,
  mac_address         TEXT,
  hostname            TEXT,
  device_type         TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (device_type IN (
                          'firewall','router','switch','server',
                          'workstation','database','printer','iot','phone','unknown'
                        )),
  vendor              TEXT,
  os_name             TEXT,
  os_version          TEXT,
  open_ports          INT[] DEFAULT ARRAY[]::INT[],
  services            JSONB NOT NULL DEFAULT '[]'::JSONB,
  security_score      INT CHECK (security_score BETWEEN 0 AND 100),
  risk_level          TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (risk_level IN ('critical','high','medium','low','unknown')),
  cve_count           INT NOT NULL DEFAULT 0,
  is_new              BOOLEAN NOT NULL DEFAULT true,
  is_internet_facing  BOOLEAN NOT NULL DEFAULT false,
  first_seen          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_assets_agent_id   ON network_assets(agent_id);
CREATE INDEX IF NOT EXISTS idx_network_assets_ip         ON network_assets(ip_address);
CREATE INDEX IF NOT EXISTS idx_network_assets_risk_level ON network_assets(risk_level);
CREATE INDEX IF NOT EXISTS idx_network_assets_last_seen  ON network_assets(last_seen DESC);

-- ----------------------------------------------------------------
-- 3. network_connections
--    Edges between discovered assets (for the topology diagram).
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS network_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID NOT NULL REFERENCES infrastructure_agents(id) ON DELETE CASCADE,
  source_asset_id  UUID NOT NULL REFERENCES network_assets(id) ON DELETE CASCADE,
  target_asset_id  UUID NOT NULL REFERENCES network_assets(id) ON DELETE CASCADE,
  connection_type  TEXT NOT NULL DEFAULT 'inferred'
                     CHECK (connection_type IN ('layer2','layer3','inferred')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_connections_agent_id ON network_connections(agent_id);

-- ----------------------------------------------------------------
-- 4. asset_vulnerabilities
--    CVE records linked to a specific network asset.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_vulnerabilities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id          UUID NOT NULL REFERENCES network_assets(id) ON DELETE CASCADE,
  cve_id            TEXT NOT NULL,
  cvss_score        FLOAT,
  severity          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (severity IN ('critical','high','medium','low')),
  description       TEXT,
  affected_product  TEXT,
  published_date    DATE,
  patch_available   BOOLEAN NOT NULL DEFAULT false,
  resolved          BOOLEAN NOT NULL DEFAULT false,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_vulns_asset_id ON asset_vulnerabilities(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_vulns_cve_id   ON asset_vulnerabilities(cve_id);

-- ----------------------------------------------------------------
-- 5. infrastructure_scan_events
--    Log of every network scan performed by the agent.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS infrastructure_scan_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id               UUID NOT NULL REFERENCES infrastructure_agents(id) ON DELETE CASCADE,
  asset_count            INT NOT NULL DEFAULT 0,
  new_assets             INT NOT NULL DEFAULT 0,
  disappeared_assets     INT NOT NULL DEFAULT 0,
  cve_count              INT NOT NULL DEFAULT 0,
  scan_duration_seconds  INT,
  subnets_scanned        TEXT[] DEFAULT ARRAY[]::TEXT[],
  scanned_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_events_agent_id   ON infrastructure_scan_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_scan_events_scanned_at ON infrastructure_scan_events(scanned_at DESC);

-- ----------------------------------------------------------------
-- Row-Level Security
-- ----------------------------------------------------------------
ALTER TABLE infrastructure_agents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_connections        ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_vulnerabilities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_scan_events ENABLE ROW LEVEL SECURITY;

-- Helper: resolve JWT sub claim → users.id
-- Pattern matches 003_rbac.sql

-- infrastructure_agents: user sees own row only; admin sees all
CREATE POLICY "Users can read own agents"
  ON infrastructure_agents FOR SELECT
  USING (
    user_id = (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Users can insert own agent"
  ON infrastructure_agents FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Users can update own agent"
  ON infrastructure_agents FOR UPDATE
  USING (
    user_id = (
      SELECT id FROM users
      WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Admins can read all agents"
  ON infrastructure_agents FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- network_assets: user sees assets belonging to their agent
CREATE POLICY "Users can read own assets"
  ON network_assets FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM infrastructure_agents
      WHERE user_id = (
        SELECT id FROM users
        WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  );

CREATE POLICY "Admins can read all assets"
  ON network_assets FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- network_connections
CREATE POLICY "Users can read own connections"
  ON network_connections FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM infrastructure_agents
      WHERE user_id = (
        SELECT id FROM users
        WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  );

CREATE POLICY "Admins can read all connections"
  ON network_connections FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- asset_vulnerabilities
CREATE POLICY "Users can read own vulnerabilities"
  ON asset_vulnerabilities FOR SELECT
  USING (
    asset_id IN (
      SELECT na.id FROM network_assets na
      JOIN infrastructure_agents ia ON ia.id = na.agent_id
      WHERE ia.user_id = (
        SELECT id FROM users
        WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  );

CREATE POLICY "Admins can read all vulnerabilities"
  ON asset_vulnerabilities FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );

-- infrastructure_scan_events
CREATE POLICY "Users can read own scan events"
  ON infrastructure_scan_events FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM infrastructure_agents
      WHERE user_id = (
        SELECT id FROM users
        WHERE clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
      )
    )
  );

CREATE POLICY "Admins can read all scan events"
  ON infrastructure_scan_events FOR SELECT
  USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
  );
