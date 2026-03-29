import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  AlertTriangle,
  Server,
  Network,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import TopologyDiagram from './TopologyDiagram';
import AssetTable from './AssetTable';
import type { NetworkAsset, NetworkConnection } from '../../types';

// ── Static demo data ─────────────────────────────────────────────────────────
// Phase 1: hardcoded. Phase 2 will fetch from /api/infrastructure/assets.

const now = new Date().toISOString();

const DEMO_ASSETS: NetworkAsset[] = [
  {
    id: '1', agent_id: 'demo', ip_address: '192.168.1.1',  mac_address: null,
    hostname: 'Edge-FW-01',   device_type: 'firewall',    vendor: 'Palo Alto',
    os_name: 'Palo Alto PAN-OS', os_version: '10.1',
    open_ports: [443, 22, 80],  services: [], security_score: 91,
    risk_level: 'low',      cve_count: 0, is_new: false, is_internet_facing: true,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '2', agent_id: 'demo', ip_address: '192.168.1.2',  mac_address: null,
    hostname: 'Core-SW-A',    device_type: 'switch',      vendor: 'Cisco',
    os_name: 'Cisco IOS-XE',   os_version: '17.3',
    open_ports: [22, 23, 161],  services: [], security_score: 72,
    risk_level: 'medium',   cve_count: 1, is_new: false, is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '3', agent_id: 'demo', ip_address: '192.168.1.3',  mac_address: null,
    hostname: 'Core-SW-B',    device_type: 'switch',      vendor: 'Cisco',
    os_name: 'Cisco IOS-XE',   os_version: '17.3',
    open_ports: [22, 23, 161],  services: [], security_score: 72,
    risk_level: 'medium',   cve_count: 1, is_new: false, is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '4', agent_id: 'demo', ip_address: '192.168.2.10', mac_address: null,
    hostname: 'App-Svr-01',   device_type: 'server',      vendor: 'Ubuntu',
    os_name: 'Ubuntu',         os_version: '22.04 LTS',
    open_ports: [22, 80, 443],  services: [], security_score: 85,
    risk_level: 'low',      cve_count: 0, is_new: false, is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '5', agent_id: 'demo', ip_address: '192.168.2.11', mac_address: null,
    hostname: 'App-Svr-02',   device_type: 'server',      vendor: 'Ubuntu',
    os_name: 'Ubuntu',         os_version: '22.04 LTS',
    open_ports: [22, 80, 443],  services: [], security_score: 85,
    risk_level: 'low',      cve_count: 0, is_new: false, is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '6', agent_id: 'demo', ip_address: '192.168.2.12', mac_address: null,
    hostname: 'App-Svr-03',   device_type: 'server',      vendor: 'Ubuntu',
    os_name: 'Ubuntu',         os_version: '20.04 LTS',
    open_ports: [22, 80, 443],  services: [], security_score: 65,
    risk_level: 'medium',   cve_count: 2, is_new: false, is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '7', agent_id: 'demo', ip_address: '192.168.2.50', mac_address: null,
    hostname: 'DB-Cluster',   device_type: 'database',    vendor: 'PostgreSQL',
    os_name: 'PostgreSQL 14 / Ubuntu', os_version: '',
    open_ports: [22, 3306, 5432], services: [], security_score: 32,
    risk_level: 'critical', cve_count: 4, is_new: false, is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
  {
    id: '8', agent_id: 'demo', ip_address: '192.168.1.50', mac_address: null,
    hostname: 'WS-Admin-01',  device_type: 'workstation', vendor: 'Microsoft',
    os_name: 'Windows Server', os_version: '2012 R2',
    open_ports: [22, 445, 3389], services: [], security_score: 28,
    risk_level: 'critical', cve_count: 6, is_new: true,  is_internet_facing: false,
    first_seen: now, last_seen: now, created_at: now,
  },
];

// id→id connections matching the spec: 1→2, 1→3, 2→4, 2→5, 2→6, 3→7, 3→8
const DEMO_CONNECTIONS: NetworkConnection[] = [
  { id: 'c1', agent_id: 'demo', source_asset_id: '1', target_asset_id: '2', connection_type: 'layer3', created_at: now },
  { id: 'c2', agent_id: 'demo', source_asset_id: '1', target_asset_id: '3', connection_type: 'layer3', created_at: now },
  { id: 'c3', agent_id: 'demo', source_asset_id: '2', target_asset_id: '4', connection_type: 'layer3', created_at: now },
  { id: 'c4', agent_id: 'demo', source_asset_id: '2', target_asset_id: '5', connection_type: 'layer3', created_at: now },
  { id: 'c5', agent_id: 'demo', source_asset_id: '2', target_asset_id: '6', connection_type: 'layer3', created_at: now },
  { id: 'c6', agent_id: 'demo', source_asset_id: '3', target_asset_id: '7', connection_type: 'layer3', created_at: now },
  { id: 'c7', agent_id: 'demo', source_asset_id: '3', target_asset_id: '8', connection_type: 'layer3', created_at: now },
];

const DEMO_STATS = { totalAssets: 8, subnets: 2, criticalAlerts: 2, networkScore: 67 };

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  valueClass = 'text-white',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-800">
        <Icon className="h-4 w-4 text-[#00D4AA]" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}

// ── InfrastructureMap ─────────────────────────────────────────────────────────
const InfrastructureMap = () => {
  const [selectedAsset, setSelectedAsset] = useState<NetworkAsset | null>(null);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 p-4 min-h-full">
      {/* Demo mode banner */}
      <div className="flex items-center gap-2.5 rounded-xl border border-yellow-700/50 bg-yellow-900/20 px-4 py-2.5 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
        <span className="text-yellow-300">
          <strong>DEMO MODE</strong> — Install the agent to see your real infrastructure.{' '}
          <button
            onClick={() => navigate('/infrastructure')}
            className="underline decoration-yellow-500 hover:text-yellow-200"
          >
            Go to setup →
          </button>
        </span>
      </div>

      {/* Scan status bar */}
      <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
          </span>
          <span className="font-medium text-green-400">Live Discovery Active</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-400 text-xs">Last scan: 2 mins ago</span>
        </div>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
          onClick={() => {/* Phase 2: trigger rescan */}}
        >
          <RefreshCw className="h-3 w-3" />
          Force Rescan
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Server}      label="Total Assets"     value={DEMO_STATS.totalAssets} />
        <StatCard icon={Network}     label="Subnets"          value={DEMO_STATS.subnets} />
        <StatCard
          icon={AlertTriangle}
          label="Critical Alerts"
          value={DEMO_STATS.criticalAlerts}
          valueClass="text-red-400"
        />
        <StatCard
          icon={ShieldAlert}
          label="Network Score"
          value={`${DEMO_STATS.networkScore}/100`}
          valueClass={DEMO_STATS.networkScore >= 70 ? 'text-[#00D4AA]' : 'text-yellow-400'}
        />
      </div>

      {/* Topology diagram */}
      <div className="flex-1">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-300">Network Topology</h2>
        </div>
        <TopologyDiagram
          assets={DEMO_ASSETS}
          connections={DEMO_CONNECTIONS}
          onNodeClick={setSelectedAsset}
        />
      </div>

      {/* Asset table */}
      <AssetTable
        assets={DEMO_ASSETS}
        onAssetClick={setSelectedAsset}
      />

      {/* Simple selected-asset drawer (inline for Phase 1) */}
      {selectedAsset && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-gray-800 bg-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <h3 className="font-semibold text-white">
              {selectedAsset.hostname ?? selectedAsset.ip_address}
            </h3>
            <button
              onClick={() => setSelectedAsset(null)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
            <Row label="IP Address"   value={selectedAsset.ip_address} />
            <Row label="Hostname"     value={selectedAsset.hostname ?? '—'} />
            <Row label="OS"           value={[selectedAsset.os_name, selectedAsset.os_version].filter(Boolean).join(' ') || '—'} />
            <Row label="Risk Level"   value={selectedAsset.risk_level.toUpperCase()} />
            <Row label="Score"        value={String(selectedAsset.security_score ?? '—')} />
            <Row label="CVEs"         value={String(selectedAsset.cve_count)} />
            <Row label="Open Ports"   value={selectedAsset.open_ports.length > 0 ? selectedAsset.open_ports.join(', ') : '—'} />
            <Row label="Internet Facing" value={selectedAsset.is_internet_facing ? 'Yes' : 'No'} />
          </div>
        </div>
      )}
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-200 font-medium">{value}</span>
    </div>
  );
}

export default InfrastructureMap;
