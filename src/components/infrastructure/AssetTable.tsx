import { ChevronRight } from 'lucide-react';
import SecurityScoreBadge from './SecurityScoreBadge';
import type { NetworkAsset } from '../../types';

interface AssetTableProps {
  assets: NetworkAsset[];
  onAssetClick: (asset: NetworkAsset) => void;
}

const DEVICE_TYPE_LABELS: Record<NetworkAsset['device_type'], string> = {
  firewall:    'Firewall',
  router:      'Router',
  switch:      'Switch',
  server:      'Linux Server',
  workstation: 'Workstation',
  database:    'Database',
  printer:     'Printer',
  iot:         'IoT Device',
  phone:       'Phone',
  unknown:     'Unknown',
};

function isOnline(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000; // < 5 min
}

const AssetTable = ({ assets, onAssetClick }: AssetTableProps) => {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Detected Assets</h2>
        <p className="text-xs text-gray-500">{assets.length} device{assets.length !== 1 ? 's' : ''} discovered</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Device
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                Type
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                OS / Vendor
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                Score
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                CVEs
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const online = isOnline(asset.last_seen);
              const osLabel = [asset.os_name, asset.os_version].filter(Boolean).join(' ') || 'Unknown';

              return (
                <tr
                  key={asset.id}
                  className="border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/40 transition-colors"
                  onClick={() => onAssetClick(asset)}
                >
                  {/* Device name + IP */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={[
                          'h-2 w-2 shrink-0 rounded-full',
                          online ? 'bg-green-400' : 'bg-red-400',
                        ].join(' ')}
                        title={online ? 'Online' : 'Offline'}
                      />
                      <div>
                        <p className="font-medium text-white">
                          {asset.hostname ?? asset.ip_address}
                        </p>
                        {asset.hostname && (
                          <p className="text-xs text-gray-500">{asset.ip_address}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Device type */}
                  <td className="px-5 py-3 text-center text-gray-400">
                    {DEVICE_TYPE_LABELS[asset.device_type]}
                  </td>

                  {/* OS / vendor */}
                  <td className="px-5 py-3 text-right text-xs text-gray-400">
                    {osLabel}
                  </td>

                  {/* Security score */}
                  <td className="px-5 py-3 text-center">
                    {asset.security_score != null ? (
                      <SecurityScoreBadge score={asset.security_score} />
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>

                  {/* CVE count */}
                  <td className="px-5 py-3 text-center">
                    {asset.cve_count > 0 ? (
                      <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                        {asset.cve_count}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>

                  {/* Chevron */}
                  <td className="pr-3 text-center text-gray-600">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetTable;
