interface DataPoint {
  date: string;
  count: number;
}

interface MiniLineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
  label?: (d: DataPoint) => string;
}

const MiniLineChart = ({ data, color = '#00D4AA', height = 64, label }: MiniLineChartProps) => {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-gray-600">No data</div>;
  }

  const W = 300;
  const H = height;
  const PAD = 2;
  const max = Math.max(...data.map(d => d.count), 1);

  const toX = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - v / max) * (H - PAD * 2);

  const linePoints = data.map((d, i) => `${toX(i)},${toY(d.count)}`).join(' ');
  const areaPoints = `${toX(0)},${H} ${linePoints} ${toX(data.length - 1)},${H}`;

  const gradId = `mlc-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradId})`} />
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Tooltip on hover — show first + last label */}
      {label && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-0.5 pointer-events-none">
          <span className="text-[10px] text-gray-600">{label(data[0])}</span>
          <span className="text-[10px] text-gray-600">{label(data[data.length - 1])}</span>
        </div>
      )}
    </div>
  );
};

export default MiniLineChart;
