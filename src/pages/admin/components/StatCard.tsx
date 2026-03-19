import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: string;
}

export const StatCard = ({ title, value, subtitle, icon: Icon, iconColor = 'text-[#00D4AA]', trend }: StatCardProps) => (
  <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
    <div className="flex items-start justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
        <p className="mt-1.5 text-3xl font-bold text-white">{value}</p>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
        {trend && <p className="mt-1 text-xs text-[#00D4AA]">{trend}</p>}
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-800">
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  </div>
);
