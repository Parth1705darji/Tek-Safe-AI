import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import {
  RefreshCw,
  AlertTriangle,
  Server,
  Network,
  ShieldAlert,
  Activity,
  Loader2,
} from 'lucide-react';
import TopologyDiagram from './TopologyDiagram';
import AssetTable from './AssetTable';
import AssetDetailDrawer from './AssetDetailDrawer';
import InfraChat from './InfraChat';
import { useInfrastructure } from '../../hooks/useInfrastructure';
import type { NetworkAsset, NetworkConnection } from '../../types';

// ── Static demo data (shown only when no real agent is active) ───────────────
const _now = new Date().toISOString();
const DEMO_ASSETS: NetworkAsset[] = [
  { id:'1',agent_id:'demo',ip_address:'192.168.1.1', mac_address:null,hostname:'Edge-FW-01',  device_type:'firewall',   vendor:'Palo Alto',os_name:'Palo Alto PAN-OS',os_version:'10.1', open_ports:[443,22,80], services:[],security_score:91,risk_level:'low',     cve_count:0,is_new:false,is_internet_facing:true, first_seen:_now,last_seen:_now,created_at:_now},
  { id:'2',agent_id:'demo',ip_address:'192.168.1.2', mac_address:null,hostname:'Core-SW-A',   device_type:'switch',     vendor:'Cisco',    os_name:'Cisco IOS-XE',    os_version:'17.3', open_ports:[22,23,161],services:[],security_score:72,risk_level:'medium',  cve_count:1,is_new:false,is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
  { id:'3',agent_id:'demo',ip_address:'192.168.1.3', mac_address:null,hostname:'Core-SW-B',   device_type:'switch',     vendor:'Cisco',    os_name:'Cisco IOS-XE',    os_version:'17.3', open_ports:[22,23,161],services:[],security_score:72,risk_level:'medium',  cve_count:1,is_new:false,is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
  { id:'4',agent_id:'demo',ip_address:'192.168.2.10',mac_address:null,hostname:'App-Svr-01',  device_type:'server',     vendor:'Ubuntu',   os_name:'Ubuntu',           os_version:'22.04',open_ports:[22,80,443], services:[],security_score:85,risk_level:'low',     cve_count:0,is_new:false,is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
  { id:'5',agent_id:'demo',ip_address:'192.168.2.11',mac_address:null,hostname:'App-Svr-02',  device_type:'server',     vendor:'Ubuntu',   os_name:'Ubuntu',           os_version:'22.04',open_ports:[22,80,443], services:[],security_score:85,risk_level:'low',     cve_count:0,is_new:false,is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
  { id:'6',agent_id:'demo',ip_address:'192.168.2.12',mac_address:null,hostname:'App-Svr-03',  device_type:'server',     vendor:'Ubuntu',   os_name:'Ubuntu',           os_version:'20.04',open_ports:[22,80,443], services:[],security_score:65,risk_level:'medium',  cve_count:2,is_new:false,is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
  { id:'7',agent_id:'demo',ip_address:'192.168.2.50',mac_address:null,hostname:'DB-Cluster',  device_type:'database',   vendor:'PostgreSQL',os_name:'PostgreSQL 14 / Ubuntu',os_version:'',open_ports:[22,3306,5432],services:[],security_score:32,risk_level:'critical',cve_count:4,is_new:false,is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
  { id:'8',agent_id:'demo',ip_address:'192.168.1.50',mac_address:null,hostname:'WS-Admin-01', device_type:'workstation',vendor:'Microsoft',os_name:'Windows Server',    os_version:'2012 R2',open_ports:[22,445,3389],services:[],security_score:28,risk_level:'critical',cve_count:6,is_new:true, is_internet_facing:false,first_seen:_now,last_seen:_now,created_at:_now},
];
const DEMO_CONNECTIONS: NetworkConnection[] = [
  {id:'c1',agent_id:'demo',source_asset_id:'1',target_asset_id:'2',connection_type:'layer3',created_at:_now},
  {id:'c2',agent_id:'demo',source_asset_id:'1',target_asset_id:'3',connection_type:'layer3',created_at:_now},
  {id:'c3',agent_id:'demo',source_asset_id:'2',target_asset_id:'4',connection_type:'layer3',created_at:_now},
  {id:'c4',agent_id:'demo',source_asset_id:'2',target_asset_id:'5',connection_type:'layer3',created_at:_now},
  {id:'c5',agent_id:'demo',source_asset_id:'2',target_asset_id:'6',connection_type:'layer3',created_at:_now},
  {id:'c6',agent_id:'demo',source_asset_id:'3',target_asset_id:'7',connection_type:'layer3',created_at:_now},
  {id:'c7',agent_id:'demo',source_asset_id:'3',target_asset_id:'8',connection_type:'layer3',created_at:_now},
];

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, valueClass = 'text-white' }: {
  icon: React.ElementType; label: string; value: string | number; valueClass?: string;
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

// ── Main component ────────────────────────────────────────────────────────────
const InfrastructureMap = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { mapData, loading, refetch } = useInfrastructure();

  const [selectedAsset, setSelectedAsset] = useState<NetworkAsset | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState<string | undefined>();
  const [rescanPending, setRescanPending] = useState(false);

  const isDemo = !mapData || mapData.assets.length === 0;
  const assets      = isDemo ? DEMO_ASSETS : mapData.assets;
  const connections = isDemo ? DEMO_CONNECTIONS : mapData.connections;
  const stats = isDemo
    ? { totalAssets: 8, subnets: ['192.168.1.0/24', '192.168.2.0/24'], criticalAlerts: 2, networkScore: 67 }
    : mapData.stats;
  const agentId = mapData?.agent?.id ?? null;

  const lastScanLabel = mapData?.recentScan
    ? `Last scan: ${new Date(mapData.recentScan.scanned_at).toLocaleTimeString()}`
    : isDemo ? 'Last scan: 2 mins ago' : 'No scan yet';

  const handleRescan = useCallback(async () => {
    if (!agentId) return;
    setRescanPending(true);
    try {
      const token = await getToken();
      await fetch('/api/infrastructure/rescan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      const event = new CustomEvent('show-toast', { detail: { message: 'Rescan requested — agent will scan within 5 minutes', type: 'success' } });
      window.dispatchEvent(event);
    } catch { /* non-fatal */ }
    setTimeout(() => setRescanPending(false), 60_000);
  }, [agentId, getToken]);

  const handleAskAI = useCallback((asset: NetworkAsset) => {
    const msg = `Tell me about ${asset.hostname ?? asset.ip_address} at ${asset.ip_address}. It has ${asset.cve_count} CVEs and risk level ${asset.risk_level}.`;
    setSelectedAsset(null);
    setChatMessage(msg);
    setChatOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#00D4AA]" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">

        {/* Demo mode banner */}
        {isDemo && (
          <div className="flex items-center gap-2.5 rounded-xl border border-yellow-700/50 bg-yellow-900/20 px-4 py-2.5 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
            <span className="text-yellow-300">
              <strong>DEMO MODE</strong> — Install the agent to see your real infrastructure.{' '}
              <button onClick={() => navigate('/infrastructure')} className="underline decoration-yellow-500 hover:text-yellow-200">
                Go to setup →
              </button>
            </span>
          </div>
        )}

        {/* Scan status bar */}
        <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
            </span>
            <span className="font-medium text-green-400">Live Discovery Active</span>
            <span className="text-gray-500">•</span>
            <span className="text-xs text-gray-400">{lastScanLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-200"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            <button
              onClick={handleRescan}
              disabled={rescanPending || isDemo || !agentId}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-600 hover:text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${rescanPending ? 'animate-spin' : ''}`} />
              Force Rescan
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Server}      label="Total Assets"     value={stats.totalAssets} />
          <StatCard icon={Network}     label="Subnets"          value={stats.subnets.length} />
          <StatCard icon={AlertTriangle} label="Critical Alerts" value={stats.criticalAlerts} valueClass={stats.criticalAlerts > 0 ? 'text-red-400' : 'text-white'} />
          <StatCard icon={ShieldAlert}  label="Network Score"   value={`${stats.networkScore}/100`}
            valueClass={stats.networkScore >= 70 ? 'text-[#00D4AA]' : stats.networkScore >= 50 ? 'text-yellow-400' : 'text-red-400'} />
        </div>

        {/* Topology diagram */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-300">Network Topology</h2>
          </div>
          <TopologyDiagram assets={assets} connections={connections} onNodeClick={setSelectedAsset} />
        </div>

        {/* Asset table */}
        <AssetTable assets={assets} onAssetClick={setSelectedAsset} />
      </div>

      {/* InfraChat sidebar */}
      {agentId && (
        <InfraChat
          agentId={agentId}
          isOpen={chatOpen}
          onToggle={() => setChatOpen(o => !o)}
          initialMessage={chatMessage}
          onInitialMessageConsumed={() => setChatMessage(undefined)}
        />
      )}

      {/* Asset detail drawer */}
      <AssetDetailDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onAskAI={handleAskAI}
      />
    </div>
  );
};

export default InfrastructureMap;
