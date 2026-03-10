import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const C = {
  green: '#16A34A',
  red:   '#DC2626',
  grid:  'rgba(255,255,255,0.06)',
  axis:  '#94A3B8',
};

function availColor(pct) {
  if (pct == null) return 'green';
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function Badge({ value, bold }) {
  if (value == null) return <span style={{ color: '#94A3B8' }}>—</span>;
  const cls = availColor(value);
  return (
    <span
      className={`badge badge-${cls}`}
      style={bold ? { fontWeight: 700, fontSize: '0.8rem' } : {}}
    >
      {value.toFixed(1)}%
    </span>
  );
}

/* ── Dark Tooltip ─────────────────────────────────────────── */
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0A1628',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: '0.78rem',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontWeight: 700, color: '#E2E8F0', marginBottom: 6 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: entry.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: '#94A3B8' }}>{entry.name}:</span>
          <span style={{ fontWeight: 700, color: '#E2E8F0' }}>
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}h
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Period Cell ─────────────────────────────────────────────── */
function PeriodCell({ period }) {
  if (!period) {
    return <span style={{ color: '#64748B', fontSize: '0.75rem' }}>—</span>;
  }
  const { uptime, downtime, availability } = period;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <div style={{ fontSize: '0.72rem', display: 'flex', gap: 5 }}>
        <span style={{ color: '#4ADE80', fontWeight: 600 }}>{(uptime ?? 0).toFixed(1)}h</span>
        <span style={{ color: '#64748B' }}>/</span>
        <span style={{ color: '#F87171', fontWeight: 600 }}>{(downtime ?? 0).toFixed(1)}h</span>
      </div>
      <Badge value={availability} />
    </div>
  );
}

/* ── Main Export ─────────────────────────────────────────────── */
export default function AttentionTable({ sites, periodLabels }) {
  const [sortKey, setSortKey] = useState('avgAvailability');
  const [sortDir, setSortDir] = useState('asc'); // worst first by default

  if (!sites || sites.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>✓</div>
        <p className="muted">No sites require immediate attention.</p>
      </div>
    );
  }

  /* Stats */
  const allAvail = sites.map((s) => s.avgAvailability ?? 0);
  const lowestAvg  = Math.min(...allAvail);
  const highestAvg = Math.max(...allAvail);

  /* Sort */
  const sorted = [...sites].sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'asc');
    }
  }

  /* Bar chart data — avg uptime/downtime per site (truncate name to 10 chars) */
  const chartData = sorted.map((site) => {
    /* average uptime/downtime across periods */
    const pts = PERIODS.map((p) => site.periods?.[p]).filter(Boolean);
    const avgUp   = pts.length ? pts.reduce((s, p) => s + (p.uptime   ?? 0), 0) / pts.length : 0;
    const avgDown = pts.length ? pts.reduce((s, p) => s + (p.downtime ?? 0), 0) / pts.length : 0;
    return {
      name:     site.name.length > 10 ? site.name.slice(0, 10) + '…' : site.name,
      fullName: site.name,
      Uptime:   parseFloat(avgUp.toFixed(1)),
      Downtime: parseFloat(avgDown.toFixed(1)),
    };
  });

  const thStyle = (key) => ({
    cursor: 'pointer',
    color: sortKey === key ? 'var(--accent)' : undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats strip */}
      <div className="stats-strip">
        <div className="stat-chip">
          <span className="stat-chip-label">Sites in Attention</span>
          <span className="stat-chip-value" style={{ color: '#F87171' }}>{sites.length}</span>
          <span className="stat-chip-sub">avg avail &lt;50%</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Lowest Avg</span>
          <span className="stat-chip-value" style={{ color: '#F87171' }}>{lowestAvg.toFixed(1)}%</span>
          <span className="stat-chip-sub">worst performing</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Highest in Group</span>
          <span className="stat-chip-value" style={{ color: '#FCD34D' }}>{highestAvg.toFixed(1)}%</span>
          <span className="stat-chip-sub">closest to amber band</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="card" style={{ padding: '20px 20px 12px' }}>
        <div className="chart-title">Avg Uptime vs Downtime — Sites Needing Attention</div>
        <div className="chart-sub">Average hours per site across all periods</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
            <XAxis
              dataKey="name"
              tick={{ fill: C.axis, fontSize: 10 }}
              axisLine={{ stroke: C.grid }}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              domain={[0, 24]}
              ticks={[0, 4, 8, 12, 16, 20, 24]}
              tick={{ fill: C.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<DarkTooltip />} />
            <Legend iconType="square" wrapperStyle={{ fontSize: '0.78rem' }} />
            <Bar dataKey="Uptime"   stackId="a" fill={C.green} name="Avg Uptime (h)"   radius={[0, 0, 0, 0]}>
              <LabelList dataKey="Uptime"   position="center" style={{ fill: '#fff', fontSize: 10, fontWeight: 700 }} formatter={(v) => v > 1 ? `${v}h` : ''} />
            </Bar>
            <Bar dataKey="Downtime" stackId="a" fill={C.red}   name="Avg Downtime (h)" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="Downtime" position="center" style={{ fill: '#fff', fontSize: 10, fontWeight: 700 }} formatter={(v) => v > 1 ? `${v}h` : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Sortable table */}
      <div className="card" style={{ padding: '20px 20px 0' }}>
        <div className="chart-title" style={{ marginBottom: 14 }}>
          Attention Sites Detail
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={thStyle('name')} onClick={() => handleSort('name')}>
                  Client {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
                <th className="td-c">Sun to Mon<br /><span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.65rem' }}>uptime / avail</span></th>
                <th className="td-c">Tue to Wed<br /><span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.65rem' }}>uptime / avail</span></th>
                <th className="td-c">Thur to Fri<br /><span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.65rem' }}>uptime / avail</span></th>
                <th
                  className="td-c sorted"
                  style={thStyle('avgAvailability')}
                  onClick={() => handleSort('avgAvailability')}
                >
                  Avg Avail {sortKey === 'avgAvailability' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((site) => (
                <tr key={site.name}>
                  <td className="td-name">{site.name}</td>
                  {PERIODS.map((p) => (
                    <td key={p} className="td-c">
                      <PeriodCell period={site.periods?.[p]} />
                    </td>
                  ))}
                  <td className="td-c">
                    <Badge value={site.avgAvailability} bold />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warning footer */}
        <div style={{
          margin: '0 -20px',
          marginTop: 16,
          background: 'rgba(220,38,38,0.08)',
          borderTop: '1px solid rgba(220,38,38,0.2)',
          padding: '10px 20px',
          fontSize: '0.78rem',
          color: '#F87171',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: '0 0 12px 12px',
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <strong>{sites.length} client{sites.length !== 1 ? 's' : ''}</strong>
          {' '}with average availability below 50% — immediate attention recommended.
        </div>
      </div>
    </div>
  );
}
