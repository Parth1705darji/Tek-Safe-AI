/**
 * Consolidated infrastructure API handler.
 * All /api/infrastructure/:action routes are handled here to stay within
 * Vercel Hobby plan's 12-function limit.
 *
 * Routes:
 *   GET  /api/infrastructure/activation      — get/create agent record (Clerk auth)
 *   POST /api/infrastructure/scan            — agent posts scan results (activation_code auth)
 *   GET  /api/infrastructure/map             — get full topology + stats (Clerk auth)
 *   GET  /api/infrastructure/asset           — get asset + CVEs (?id=) (Clerk auth)
 *   POST /api/infrastructure/rescan          — request agent rescan (Clerk auth)
 *   GET  /api/infrastructure/check-commands  — agent polls for commands (activation_code)
 *   POST /api/infrastructure/chat            — infra AI chat (Clerk auth)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { verifyUserRequest, sendAuthError } from '../../lib/userAuth.js';
import { sendEmail } from '../../lib/email.js';
import { matchCVEsForAsset } from '../../lib/cveMatch.js';
import { calculateSecurityScore } from '../../lib/infraScoring.js';
import { buildInfraSystemPrompt } from '../../lib/infraPrompt.js';
import { createChatCompletion } from '../../lib/deepseek.js';

export const config = { api: { bodyParser: true } };

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSupabase() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Shadow IT alert email
async function sendShadowITAlert(
  userEmail: string,
  hostname: string | null,
  ipAddress: string
): Promise<void> {
  const deviceLabel = hostname ? `${hostname} (${ipAddress})` : ipAddress;
  await sendEmail({
    to: userEmail,
    subject: `New device detected on your network — ${deviceLabel}`,
    html: `
<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f1117;color:#e5e7eb;margin:0;padding:40px 20px">
<div style="max-width:520px;margin:0 auto;background:#1a1d2e;border-radius:16px;padding:32px;border:1px solid #2d2f3e">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
    <span style="font-size:28px">🛡️</span>
    <span style="font-size:20px;font-weight:700;color:#ffffff">Tek-Safe AI</span>
  </div>
  <h1 style="font-size:20px;font-weight:600;color:#ffffff;margin:0 0 12px">⚠️ New Device Detected</h1>
  <p style="color:#9ca3af;line-height:1.6;margin:0 0 16px">
    The Tek-Safe AI discovery agent found a new device on your network that was not seen before.
  </p>
  <div style="background:#0f1117;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #374151">
    <p style="margin:0 0 6px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Device</p>
    <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600">${deviceLabel}</p>
  </div>
  <p style="color:#9ca3af;font-size:14px;line-height:1.6;margin:0 0 20px">
    If you don't recognise this device, it may be an unauthorised connection. Review your
    Infrastructure map in Tek-Safe AI for more details.
  </p>
  <a href="${process.env.VITE_APP_URL ?? 'https://tek-safe.ai'}/infrastructure"
     style="display:inline-block;background:#00D4AA;color:#0f1117;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px">
    View Infrastructure Map →
  </a>
  <p style="color:#6b7280;font-size:12px;margin-top:32px;border-top:1px solid #2d2f3e;padding-top:16px">
    Tek-Safe AI · Network Security
  </p>
</div>
</body></html>`,
  });
}

// ── Route: GET /api/infrastructure/activation ─────────────────────────────

async function handleActivation(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let identity: Awaited<ReturnType<typeof verifyUserRequest>>;
  try { identity = await verifyUserRequest(req); }
  catch (err) { return sendAuthError(res, err); }

  const supabase = makeSupabase();

  const { data: existing, error: fetchError } = await supabase
    .from('infrastructure_agents')
    .select('activation_code, status, agent_hostname, last_heartbeat')
    .eq('user_id', identity.userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[activation] fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Failed to query agent status' });
  }

  if (existing) {
    return res.status(200).json({
      status: existing.status,
      activation_code: existing.activation_code,
      agent_hostname: existing.agent_hostname ?? null,
      last_heartbeat: existing.last_heartbeat ?? null,
    });
  }

  const activationCode = randomUUID();
  const { error: insertError } = await supabase
    .from('infrastructure_agents')
    .insert({ user_id: identity.userId, activation_code: activationCode, status: 'pending' });

  if (insertError) {
    console.error('[activation] insert error:', insertError.message);
    return res.status(500).json({ error: 'Failed to create agent record' });
  }

  return res.status(200).json({ status: 'pending', activation_code: activationCode });
}

// ── Route: POST /api/infrastructure/scan ──────────────────────────────────

interface ScanAsset {
  ip_address: string;
  mac_address?: string | null;
  hostname?: string | null;
  device_type?: string;
  vendor?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  open_ports?: number[];
  services?: Record<string, unknown>[];
  is_internet_facing?: boolean;
  connected_to?: string[]; // array of ip_addresses this asset connects to
}

interface ScanBody {
  activation_code?: string;
  agent_version?: string;
  scan_timestamp?: string;
  scan_duration_seconds?: number;
  subnets_scanned?: string[];
  assets?: ScanAsset[];
  agent_hostname?: string;
  agent_platform?: string;
}

async function handleScan(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body as ScanBody;
  const { activation_code, agent_version, scan_timestamp, scan_duration_seconds, subnets_scanned, assets = [] } = body;

  if (!activation_code) return res.status(400).json({ error: 'activation_code is required' });

  const supabase = makeSupabase();

  // 1. Validate activation code
  const { data: agent, error: agentErr } = await supabase
    .from('infrastructure_agents')
    .select('id, user_id, status')
    .eq('activation_code', activation_code)
    .single();

  if (agentErr || !agent) return res.status(401).json({ error: 'Invalid activation code' });

  // 2. Update agent heartbeat + status
  await supabase
    .from('infrastructure_agents')
    .update({
      last_heartbeat: new Date().toISOString(),
      status: 'active',
      agent_version: agent_version ?? null,
      agent_hostname: body.agent_hostname ?? null,
      agent_platform: body.agent_platform ?? null,
    })
    .eq('id', agent.id);

  // Get user email for shadow IT alerts
  const { data: userRecord } = await supabase
    .from('users')
    .select('email')
    .eq('id', agent.user_id)
    .single();

  const scanTs = scan_timestamp ?? new Date().toISOString();
  let newAssetCount = 0;
  const upsertedAssetIds: string[] = [];
  const ipToAssetId: Record<string, string> = [];

  // 3. Upsert each asset
  for (const a of assets) {
    if (!a.ip_address) continue;

    // Check if asset already exists
    const { data: existing } = await supabase
      .from('network_assets')
      .select('id, is_new, os_version')
      .eq('agent_id', agent.id)
      .eq('ip_address', a.ip_address)
      .maybeSingle();

    const { score, risk_level } = calculateSecurityScore({
      open_ports:        a.open_ports ?? [],
      os_name:           a.os_name ?? null,
      os_version:        a.os_version ?? null,
      is_internet_facing: a.is_internet_facing ?? false,
      cve_count:         0,
    });

    let assetId: string;

    if (existing) {
      // Update existing
      await supabase
        .from('network_assets')
        .update({
          hostname:           a.hostname ?? null,
          mac_address:        a.mac_address ?? null,
          device_type:        a.device_type ?? 'unknown',
          vendor:             a.vendor ?? null,
          os_name:            a.os_name ?? null,
          os_version:         a.os_version ?? null,
          open_ports:         a.open_ports ?? [],
          services:           a.services ?? [],
          is_internet_facing: a.is_internet_facing ?? false,
          security_score:     score,
          risk_level,
          last_seen:          scanTs,
          is_new:             false,
        })
        .eq('id', existing.id);

      assetId = existing.id;

      // Trigger CVE re-match if OS version changed
      const osChanged = (a.os_version ?? '') !== (existing.os_version ?? '');
      if (osChanged && a.os_name) {
        // Non-blocking
        void matchCVEsForAsset(supabase, assetId, a.os_name, a.os_version ?? '', a.vendor ?? undefined)
          .catch((e: unknown) => console.warn('[scan] CVE match error (non-fatal):', e));
      }
    } else {
      // Insert new asset
      const { data: inserted, error: insertErr } = await supabase
        .from('network_assets')
        .insert({
          agent_id:           agent.id,
          ip_address:         a.ip_address,
          mac_address:        a.mac_address ?? null,
          hostname:           a.hostname ?? null,
          device_type:        a.device_type ?? 'unknown',
          vendor:             a.vendor ?? null,
          os_name:            a.os_name ?? null,
          os_version:         a.os_version ?? null,
          open_ports:         a.open_ports ?? [],
          services:           a.services ?? [],
          security_score:     score,
          risk_level,
          is_internet_facing: a.is_internet_facing ?? false,
          is_new:             true,
          first_seen:         scanTs,
          last_seen:          scanTs,
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        console.warn('[scan] asset insert error:', insertErr?.message);
        continue;
      }

      assetId = inserted.id;
      newAssetCount++;

      // Shadow IT alert (non-blocking)
      if (userRecord?.email) {
        void sendShadowITAlert(userRecord.email, a.hostname ?? null, a.ip_address)
          .catch((e: unknown) => console.warn('[scan] shadow IT email error (non-fatal):', e));
      }

      // CVE matching (non-blocking)
      if (a.os_name) {
        void matchCVEsForAsset(supabase, assetId, a.os_name, a.os_version ?? '', a.vendor ?? undefined)
          .catch((e: unknown) => console.warn('[scan] CVE match error (non-fatal):', e));
      }
    }

    upsertedAssetIds.push(assetId);
    (ipToAssetId as Record<string, string>)[a.ip_address] = assetId;
  }

  // 4. Build and upsert connections
  await supabase.from('network_connections').delete().eq('agent_id', agent.id);

  const connections = [];
  for (const a of assets) {
    if (!a.connected_to?.length || !a.ip_address) continue;
    const sourceId = (ipToAssetId as Record<string, string>)[a.ip_address];
    if (!sourceId) continue;
    for (const targetIp of a.connected_to) {
      const targetId = (ipToAssetId as Record<string, string>)[targetIp];
      if (targetId) {
        connections.push({
          agent_id:        agent.id,
          source_asset_id: sourceId,
          target_asset_id: targetId,
          connection_type: 'layer3',
        });
      }
    }
  }
  if (connections.length > 0) {
    await supabase.from('network_connections').insert(connections);
  }

  // 5. Log scan event
  await supabase.from('infrastructure_scan_events').insert({
    agent_id:              agent.id,
    asset_count:           assets.length,
    new_assets:            newAssetCount,
    disappeared_assets:    0,
    cve_count:             0,
    scan_duration_seconds: scan_duration_seconds ?? null,
    subnets_scanned:       subnets_scanned ?? [],
    scanned_at:            scanTs,
  });

  return res.status(200).json({ ok: true, assets_processed: upsertedAssetIds.length, new_assets: newAssetCount });
}

// ── Route: GET /api/infrastructure/map ────────────────────────────────────

async function handleMap(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let identity: Awaited<ReturnType<typeof verifyUserRequest>>;
  try { identity = await verifyUserRequest(req); }
  catch (err) { return sendAuthError(res, err); }

  const supabase = makeSupabase();
  const includeVulns = req.query.includeVulns === 'true';

  // Get agent
  const { data: agent } = await supabase
    .from('infrastructure_agents')
    .select('id, status, last_heartbeat, agent_hostname')
    .eq('user_id', identity.userId)
    .maybeSingle();

  if (!agent) return res.status(200).json({ agent: null, stats: null, assets: [], connections: [], recentScan: null, topVulnerabilities: [] });

  // Get assets
  const { data: assets } = await supabase
    .from('network_assets')
    .select('*')
    .eq('agent_id', agent.id)
    .order('last_seen', { ascending: false });

  // Get connections
  const { data: connections } = await supabase
    .from('network_connections')
    .select('*')
    .eq('agent_id', agent.id);

  // Get most recent scan event
  const { data: recentScan } = await supabase
    .from('infrastructure_scan_events')
    .select('*')
    .eq('agent_id', agent.id)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get top vulnerabilities
  let topVulnerabilities: unknown[] = [];
  if (includeVulns && assets && assets.length > 0) {
    const assetIds = assets.map((a: { id: string }) => a.id);
    const { data: vulns } = await supabase
      .from('asset_vulnerabilities')
      .select('*')
      .in('asset_id', assetIds)
      .eq('resolved', false)
      .in('severity', ['critical', 'high'])
      .order('cvss_score', { ascending: false })
      .limit(5);
    topVulnerabilities = vulns ?? [];
  }

  // Calculate stats
  const assetList = assets ?? [];
  const subnets = [...new Set(
    assetList.map((a: { ip_address: string }) => a.ip_address.split('.').slice(0, 3).join('.') + '.0/24')
  )];
  const criticalAlerts = assetList.filter((a: { risk_level: string }) => a.risk_level === 'critical').length;
  const avgScore = assetList.length > 0
    ? Math.round(assetList.reduce((sum: number, a: { security_score: number | null }) => sum + (a.security_score ?? 50), 0) / assetList.length)
    : 0;

  return res.status(200).json({
    agent: { id: agent.id, status: agent.status, last_heartbeat: agent.last_heartbeat, agent_hostname: agent.agent_hostname },
    stats: { totalAssets: assetList.length, subnets, criticalAlerts, networkScore: avgScore },
    assets: assetList,
    connections: connections ?? [],
    recentScan: recentScan ?? null,
    topVulnerabilities,
  });
}

// ── Route: GET /api/infrastructure/asset?id= ──────────────────────────────

async function handleAsset(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let identity: Awaited<ReturnType<typeof verifyUserRequest>>;
  try { identity = await verifyUserRequest(req); }
  catch (err) { return sendAuthError(res, err); }

  const assetId = req.query.id as string | undefined;
  if (!assetId) return res.status(400).json({ error: 'Missing ?id= parameter' });

  const supabase = makeSupabase();

  // Verify asset belongs to user
  const { data: asset } = await supabase
    .from('network_assets')
    .select('*, infrastructure_agents!inner(user_id)')
    .eq('id', assetId)
    .single();

  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const agentOwner = (asset as { infrastructure_agents?: { user_id: string } }).infrastructure_agents;
  if (agentOwner?.user_id !== identity.userId) return res.status(403).json({ error: 'Forbidden' });

  const { data: vulns } = await supabase
    .from('asset_vulnerabilities')
    .select('*')
    .eq('asset_id', assetId)
    .order('cvss_score', { ascending: false });

  return res.status(200).json({ asset, vulnerabilities: vulns ?? [] });
}

// ── Route: POST /api/infrastructure/rescan ────────────────────────────────

async function handleRescan(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let identity: Awaited<ReturnType<typeof verifyUserRequest>>;
  try { identity = await verifyUserRequest(req); }
  catch (err) { return sendAuthError(res, err); }

  const supabase = makeSupabase();

  const { error } = await supabase
    .from('infrastructure_agents')
    .update({ rescan_requested: true, rescan_requested_at: new Date().toISOString() })
    .eq('user_id', identity.userId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

// ── Route: GET /api/infrastructure/check-commands ─────────────────────────

async function handleCheckCommands(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const activationCode = req.query.activation_code as string | undefined;
  if (!activationCode) return res.status(400).json({ error: 'Missing activation_code' });

  const supabase = makeSupabase();

  const { data: agent } = await supabase
    .from('infrastructure_agents')
    .select('id, rescan_requested')
    .eq('activation_code', activationCode)
    .maybeSingle();

  if (!agent) return res.status(401).json({ error: 'Invalid activation code' });

  const shouldRescan = agent.rescan_requested === true;

  if (shouldRescan) {
    // Clear the flag
    await supabase
      .from('infrastructure_agents')
      .update({ rescan_requested: false, rescan_requested_at: null })
      .eq('id', agent.id);
  }

  return res.status(200).json({ rescan: shouldRescan });
}

// ── Route: POST /api/infrastructure/chat ──────────────────────────────────

async function handleChat(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing DEEPSEEK_API_KEY' });
  }

  let identity: Awaited<ReturnType<typeof verifyUserRequest>>;
  try { identity = await verifyUserRequest(req); }
  catch (err) { return sendAuthError(res, err); }

  const body = req.body as { message?: string; agentId?: string };
  const { message, agentId } = body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  if (!agentId)          return res.status(400).json({ error: 'agentId is required' });

  const supabase = makeSupabase();

  // Verify agentId belongs to the authenticated user
  const { data: agent } = await supabase
    .from('infrastructure_agents')
    .select('id, agent_hostname, status, last_heartbeat, user_id')
    .eq('id', agentId)
    .maybeSingle();

  if (!agent || agent.user_id !== identity.userId) {
    return res.status(403).json({ error: 'Forbidden: agent does not belong to you' });
  }

  // Load assets and critical/high vulns
  const { data: assets } = await supabase
    .from('network_assets')
    .select('hostname, ip_address, device_type, os_name, os_version, risk_level, security_score, cve_count, open_ports, is_internet_facing')
    .eq('agent_id', agentId);

  const assetIds = (assets ?? []).map((a: { id?: string }) => a.id).filter(Boolean);
  let vulns: unknown[] = [];
  if (assetIds.length > 0) {
    const { data: v } = await supabase
      .from('asset_vulnerabilities')
      .select('cve_id, cvss_score, severity, description, affected_product')
      .in('asset_id', assetIds)
      .in('severity', ['critical', 'high'])
      .eq('resolved', false)
      .order('cvss_score', { ascending: false })
      .limit(20);
    vulns = v ?? [];
  }

  const systemPrompt = buildInfraSystemPrompt(
    (assets ?? []) as Parameters<typeof buildInfraSystemPrompt>[0],
    vulns as Parameters<typeof buildInfraSystemPrompt>[1],
    { agent_hostname: agent.agent_hostname, status: agent.status, last_heartbeat: agent.last_heartbeat }
  );

  const response = await createChatCompletion(
    {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: message.trim() },
      ],
      temperature: 0.4,
      max_tokens: 1000,
    },
    process.env.DEEPSEEK_API_KEY
  );

  return res.status(200).json({ response });
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: missing Supabase env vars' });
  }

  const action = req.query.action as string;

  switch (action) {
    case 'activation':      return handleActivation(req, res);
    case 'scan':            return handleScan(req, res);
    case 'map':             return handleMap(req, res);
    case 'asset':           return handleAsset(req, res);
    case 'rescan':          return handleRescan(req, res);
    case 'check-commands':  return handleCheckCommands(req, res);
    case 'chat':            return handleChat(req, res);
    default:
      return res.status(404).json({ error: `Unknown infrastructure action: ${action}` });
  }
}
