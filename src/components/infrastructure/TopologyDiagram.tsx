import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { NetworkAsset, NetworkConnection } from '../../types';

interface TopologyDiagramProps {
  assets: NetworkAsset[];
  connections: NetworkConnection[];
  onNodeClick: (asset: NetworkAsset) => void;
}

// Risk-level → colors
const RISK_COLORS: Record<NetworkAsset['risk_level'], { border: string; bg: string }> = {
  critical: { border: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  high:     { border: '#F97316', bg: 'rgba(249,115,22,0.15)' },
  medium:   { border: '#EAB308', bg: 'rgba(234,179,8,0.15)' },
  low:      { border: '#00D4AA', bg: 'rgba(0,212,170,0.12)' },
  unknown:  { border: '#4B5563', bg: 'rgba(30,41,59,0.8)' },
};

// Device-type → emoji shorthand used in SVG text
const DEVICE_ICONS: Record<NetworkAsset['device_type'], string> = {
  firewall:    '🔥',
  router:      '🌐',
  switch:      '🔀',
  server:      '🖥',
  workstation: '💻',
  database:    '🗄',
  printer:     '🖨',
  iot:         '📡',
  phone:       '📱',
  unknown:     '❓',
};

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  asset: NetworkAsset;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  connection: NetworkConnection;
}

const NODE_W = 72;
const NODE_H = 68;

const TopologyDiagram = ({ assets, connections, onNodeClick }: TopologyDiagramProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  });

  const buildDiagram = useCallback(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = svgRef.current?.parentElement;
    const width = container?.clientWidth ?? 900;
    const height = container?.clientHeight ?? 460;

    svg.attr('width', width).attr('height', height);

    // Zoom + pan
    const root = svg.append('g').attr('class', 'root');
    d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => root.attr('transform', event.transform))
      (svg as unknown as d3.Selection<SVGSVGElement, unknown, null, undefined>);

    // Build simulation data
    const nodeMap = new Map<string, SimNode>();
    const nodes: SimNode[] = assets.map((a) => {
      const n: SimNode = { id: a.id, asset: a };
      nodeMap.set(a.id, n);
      return n;
    });

    const links: SimLink[] = connections
      .map((c) => {
        const source = nodeMap.get(c.source_asset_id);
        const target = nodeMap.get(c.target_asset_id);
        if (!source || !target) return null;
        return { source, target, connection: c } as SimLink;
      })
      .filter((l): l is SimLink => l !== null);

    // Draw links first (under nodes)
    const linkSel = root
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#374151')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.5);

    // Node groups
    const nodeSel = root
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .on('click', (_, d) => onNodeClickRef.current(d.asset));

    // Drag behaviour
    nodeSel.call(
      d3.drag<SVGGElement, SimNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    // Rounded rectangle background
    nodeSel
      .append('rect')
      .attr('width', NODE_W)
      .attr('height', NODE_H)
      .attr('x', -NODE_W / 2)
      .attr('y', -NODE_H / 2)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', (d) => RISK_COLORS[d.asset.risk_level].bg)
      .attr('stroke', (d) => RISK_COLORS[d.asset.risk_level].border)
      .attr('stroke-width', 1.5);

    // Device icon (emoji)
    nodeSel
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', -8)
      .attr('font-size', '22px')
      .text((d) => DEVICE_ICONS[d.asset.device_type]);

    // Hostname label
    nodeSel
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 20)
      .attr('font-size', '10px')
      .attr('fill', '#9CA3AF')
      .text((d) => {
        const name = d.asset.hostname ?? d.asset.ip_address;
        return name.length > 12 ? name.slice(0, 11) + '…' : name;
      });

    // CVE badge (red dot, top-right)
    nodeSel
      .filter((d) => d.asset.cve_count > 0)
      .append('circle')
      .attr('r', 9)
      .attr('cx', NODE_W / 2 - 4)
      .attr('cy', -NODE_H / 2 + 4)
      .attr('fill', '#EF4444');

    nodeSel
      .filter((d) => d.asset.cve_count > 0)
      .append('text')
      .attr('x', NODE_W / 2 - 4)
      .attr('y', -NODE_H / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '8px')
      .attr('font-weight', 'bold')
      .attr('fill', 'white')
      .text((d) => String(d.asset.cve_count));

    // Tooltip
    const tooltip = d3
      .select(svgRef.current?.parentElement ?? document.body)
      .append('div')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', '#1E293B')
      .style('border', '1px solid #374151')
      .style('border-radius', '8px')
      .style('padding', '8px 12px')
      .style('font-size', '12px')
      .style('color', '#E2E8F0')
      .style('z-index', '50')
      .style('opacity', '0')
      .style('transition', 'opacity 0.15s ease');

    nodeSel
      .on('mouseenter', (event, d) => {
        const a = d.asset;
        tooltip
          .html(
            `<strong>${a.hostname ?? a.ip_address}</strong><br/>
             IP: ${a.ip_address}<br/>
             OS: ${a.os_name ?? 'Unknown'} ${a.os_version ?? ''}<br/>
             Risk: <span style="color:${RISK_COLORS[a.risk_level].border}">${a.risk_level.toUpperCase()}</span>`
          )
          .style('opacity', '1')
          .style('left', `${event.offsetX + 14}px`)
          .style('top', `${event.offsetY - 10}px`);
      })
      .on('mouseleave', () => tooltip.style('opacity', '0'));

    // Force simulation
    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(160)
      )
      .force('charge', d3.forceManyBody().strength(-420))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(64))
      .on('tick', () => {
        linkSel
          .attr('x1', (d) => (d.source as SimNode).x ?? 0)
          .attr('y1', (d) => (d.source as SimNode).y ?? 0)
          .attr('x2', (d) => (d.target as SimNode).x ?? 0)
          .attr('y2', (d) => (d.target as SimNode).y ?? 0);

        nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    // Cleanup on unmount
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [assets, connections]);

  useEffect(() => {
    const cleanup = buildDiagram();
    const ro = new ResizeObserver(() => buildDiagram());
    if (svgRef.current?.parentElement) ro.observe(svgRef.current.parentElement);
    return () => {
      cleanup?.();
      ro.disconnect();
    };
  }, [buildDiagram]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-800 bg-[#0F172A]" style={{ minHeight: 420 }}>
      <svg ref={svgRef} className="w-full" />
      <p className="absolute bottom-2 right-3 text-xs text-gray-600 select-none">
        Drag to reposition • Scroll to zoom
      </p>
    </div>
  );
};

export default TopologyDiagram;
