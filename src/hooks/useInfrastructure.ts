import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/react';
import type { NetworkAsset, NetworkConnection, InfrastructureScanEvent, AssetVulnerability } from '../types';

export interface InfrastructureAgent {
  id: string;
  status: 'pending' | 'active' | 'offline';
  last_heartbeat: string | null;
  agent_hostname: string | null;
}

export interface InfraStats {
  totalAssets: number;
  subnets: string[];
  criticalAlerts: number;
  networkScore: number;
}

export interface MapData {
  agent: InfrastructureAgent;
  stats: InfraStats;
  assets: NetworkAsset[];
  connections: NetworkConnection[];
  recentScan: InfrastructureScanEvent | null;
  topVulnerabilities: AssetVulnerability[];
}

export function useInfrastructure(pollIntervalMs = 60_000) {
  const { getToken } = useAuth();
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMap = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/infrastructure/map?includeVulns=true', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as MapData & { agent: InfrastructureAgent | null };
      setMapData(data.agent ? data : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load infrastructure data');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchMap();
    intervalRef.current = setInterval(() => fetchMap(true), pollIntervalMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMap, pollIntervalMs]);

  const refetch = useCallback(() => fetchMap(), [fetchMap]);

  return { mapData, loading, error, refetch };
}
