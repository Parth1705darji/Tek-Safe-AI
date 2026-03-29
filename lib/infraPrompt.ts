/**
 * System prompt builder for Infrastructure Chat.
 * Injects real network topology and CVE data into the LLM context.
 */

interface AssetSummary {
  hostname: string | null;
  ip_address: string;
  device_type: string;
  os_name: string | null;
  os_version: string | null;
  risk_level: string;
  security_score: number | null;
  cve_count: number;
  open_ports: number[];
  is_internet_facing: boolean;
}

interface VulnSummary {
  cve_id: string;
  cvss_score: number | null;
  severity: string;
  description: string | null;
  affected_product?: string | null;
}

interface AgentSummary {
  agent_hostname: string | null;
  status: string;
  last_heartbeat: string | null;
}

function formatAsset(a: AssetSummary): string {
  const name = a.hostname ?? a.ip_address;
  const os   = [a.os_name, a.os_version].filter(Boolean).join(' ') || 'Unknown';
  const ports = a.open_ports.length ? a.open_ports.slice(0, 8).join(', ') : 'none detected';
  return `• ${name} (${a.ip_address}) — ${a.device_type}, ${os}, risk=${a.risk_level}, score=${a.security_score ?? '?'}/100, CVEs=${a.cve_count}, ports=[${ports}]${a.is_internet_facing ? ', INTERNET-FACING' : ''}`;
}

export function buildInfraSystemPrompt(
  assets: AssetSummary[],
  vulns: VulnSummary[],
  agent: AgentSummary
): string {
  const assetList  = assets.map(formatAsset).join('\n');
  const criticalVulns = vulns
    .filter(v => v.severity === 'critical' || v.severity === 'high')
    .slice(0, 10)
    .map(v => `  • ${v.cve_id} (CVSS ${v.cvss_score ?? '?'}, ${v.severity}): ${(v.description ?? '').slice(0, 120)}`)
    .join('\n') || '  None detected';

  const criticalAssets = assets
    .filter(a => a.risk_level === 'critical')
    .map(a => a.hostname ?? a.ip_address)
    .join(', ') || 'None';

  const heartbeat = agent.last_heartbeat
    ? new Date(agent.last_heartbeat).toLocaleString()
    : 'Unknown';

  return `You are an expert network security analyst assistant embedded in Tek-Safe AI's Infrastructure Discovery module.

NETWORK OVERVIEW
────────────────
Agent host: ${agent.agent_hostname ?? 'Unknown'} | Status: ${agent.status} | Last scan: ${heartbeat}
Total assets: ${assets.length}
Critical-risk assets: ${criticalAssets}

DETECTED ASSETS (${assets.length} total)
${assetList || '  No assets detected yet.'}

TOP CRITICAL/HIGH CVEs
${criticalVulns}

YOUR ROLE
─────────
• Answer questions about the network topology, specific devices, and vulnerabilities.
• Provide concrete, prioritised remediation advice (patch X, disable port Y, segment Z).
• When asked about a specific device, focus on its CVEs, open ports, and risk level.
• Cite CVE IDs when discussing vulnerabilities.
• Be concise but actionable — security teams need clear next steps.
• Do NOT reveal raw activation codes, API keys, or internal credentials.
• If you don't have enough context to answer precisely, say so and suggest what to look for.`;
}
