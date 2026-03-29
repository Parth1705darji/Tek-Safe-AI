/**
 * CVE matching via NIST NVD API 2.0
 *
 * Free, no auth required (300 req / 30 sec).
 * Set NVDAPI_KEY env var for 2000 req / 30 sec.
 *
 * Docs: https://nvd.nist.gov/developers/vulnerabilities
 */

import { createClient } from '@supabase/supabase-js';
import { calculateSecurityScore } from './infraScoring.js';

const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

interface NvdCve {
  cve: {
    id: string;
    published: string;
    descriptions: Array<{ lang: string; value: string }>;
    metrics?: {
      cvssMetricV31?: Array<{
        cvssData: { baseScore: number; baseSeverity: string };
      }>;
      cvssMetricV30?: Array<{
        cvssData: { baseScore: number; baseSeverity: string };
      }>;
      cvssMetricV2?: Array<{
        baseSeverity: string;
        cvssData: { baseScore: number };
      }>;
    };
  };
}

interface NvdResponse {
  totalResults: number;
  vulnerabilities: NvdCve[];
}

function buildKeyword(osName: string, osVersion: string, vendor?: string): string {
  const combined = [osName, osVersion].filter(Boolean).join(' ');
  // Trim vendor prefix when it's redundant with osName
  if (vendor && !combined.toLowerCase().includes(vendor.toLowerCase())) {
    return `${vendor} ${combined}`.trim();
  }
  return combined.trim();
}

function parseSeverity(
  metrics: NvdCve['cve']['metrics']
): { score: number; severity: 'critical' | 'high' | 'medium' | 'low' } {
  const v31 = metrics?.cvssMetricV31?.[0]?.cvssData;
  const v30 = metrics?.cvssMetricV30?.[0]?.cvssData;
  const v2  = metrics?.cvssMetricV2?.[0];

  const baseScore = v31?.baseScore ?? v30?.baseScore ?? v2?.cvssData?.baseScore ?? 0;
  const rawSeverity = (v31?.baseSeverity ?? v30?.baseSeverity ?? v2?.baseSeverity ?? 'LOW').toLowerCase();

  const severity: 'critical' | 'high' | 'medium' | 'low' =
    rawSeverity === 'critical' ? 'critical'
    : rawSeverity === 'high'   ? 'high'
    : rawSeverity === 'medium' ? 'medium'
    : 'low';

  return { score: baseScore, severity };
}

export async function matchCVEsForAsset(
  supabase: ReturnType<typeof createClient>,
  assetId: string,
  osName: string,
  osVersion: string,
  vendor?: string
): Promise<void> {
  if (!osName) return;

  const keyword = buildKeyword(osName, osVersion, vendor);
  if (!keyword) return;

  const params = new URLSearchParams({
    keywordSearch: keyword,
    cvssV3SeverityMin: 'MEDIUM',
    resultsPerPage: '20',
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.NVDAPI_KEY) headers['apiKey'] = process.env.NVDAPI_KEY;

  let nvdData: NvdResponse;
  try {
    const res = await fetch(`${NVD_BASE}?${params}`, { headers });
    if (!res.ok) {
      console.warn(`[cveMatch] NVD API returned ${res.status} for keyword: ${keyword}`);
      return;
    }
    nvdData = (await res.json()) as NvdResponse;
  } catch (err) {
    console.warn('[cveMatch] NVD fetch failed (non-fatal):', err);
    return;
  }

  if (!nvdData.vulnerabilities?.length) return;

  const upserts = nvdData.vulnerabilities.map((v) => {
    const { score, severity } = parseSeverity(v.cve.metrics);
    const description =
      v.cve.descriptions.find((d) => d.lang === 'en')?.value ?? '';

    return {
      asset_id:         assetId,
      cve_id:           v.cve.id,
      cvss_score:       score,
      severity,
      description:      description.slice(0, 500),
      published_date:   v.cve.published?.slice(0, 10) ?? null,
      patch_available:  false,
      resolved:         false,
    };
  });

  // Upsert (match on asset_id + cve_id)
  const { error: upsertErr } = await supabase
    .from('asset_vulnerabilities')
    .upsert(upserts, { onConflict: 'asset_id,cve_id', ignoreDuplicates: false });

  if (upsertErr) {
    console.warn('[cveMatch] upsert error (non-fatal):', upsertErr.message);
    return;
  }

  // Fetch all vulns for scoring
  const { data: allVulns } = await supabase
    .from('asset_vulnerabilities')
    .select('severity')
    .eq('asset_id', assetId)
    .eq('resolved', false);

  // Fetch asset for scoring context
  const { data: asset } = await supabase
    .from('network_assets')
    .select('open_ports, os_name, os_version, is_internet_facing, cve_count')
    .eq('id', assetId)
    .single();

  if (!asset) return;

  const { score, risk_level } = calculateSecurityScore({
    open_ports:        asset.open_ports ?? [],
    os_name:           asset.os_name,
    os_version:        asset.os_version,
    is_internet_facing: asset.is_internet_facing,
    cve_count:         upserts.length,
    vulns:             (allVulns ?? []) as Array<{ severity: string }>,
  });

  await supabase
    .from('network_assets')
    .update({
      cve_count:      upserts.length,
      security_score: score,
      risk_level,
    })
    .eq('id', assetId);
}
