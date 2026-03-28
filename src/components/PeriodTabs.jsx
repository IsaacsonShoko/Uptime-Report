import { useState } from 'react';
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

const PERIODS = ['Sat to Sun', 'Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const C = {
  green: '#16A34A',
  red:   '#DC2626',
  grid:  'rgba(255,255,255,0.06)',
  axis:  '#94A3B8',
};

function availColor(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function Badge({ value }) {
  if (value == null) return <span style={{ color: '#94A3B8' }}>—</span>;
  const cls = availColor(value);
  return <span className={`badge badge-${cls}`}>{value.toFixed(1)}%</span>;
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
      <div style={{ fontWeight: 700, color: '#E2E8F0', marginBottom: 6,
        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
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

/* ── Sortable Table ─────────────────────────────────────────── */
const COLUMNS = [
  { key: '#',           label: '#',             sortKey: 'idx',          numeric: true  },
  { key: 'name',        label: 'Provider',       sortKey: 'name',         numeric: false },
  { key: 'uptime',      label: 'Uptime h',       sortKey: 'uptime',       numeric: true  },
  { key: 'downtime',    label: 'Downtime h',     sortKey: 'downtime',     numeric: true  },
  { key: 'availability',label: 'Availability',   sortKey: 'availability', numeric: true  },
];

function SortableTable({ sites }) {
  const [sortKey, setSortKey] = useState('availability');
  const [sortDir, setSortDir] = useState('desc');

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  const sorted = [...(sites || [])].sort((a, b) => {
    let av = sortKey === 'idx' ? sites.indexOf(a) : a[sortKey];
    let bv = sortKey === 'idx' ? sites.indexOf(b) : b[sortKey];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  if (!sites || sites.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#94A3B8', padding: '32px 0' }}>
        No site data for this period.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={sortKey === col.sortKey ? 'sorted' : ''}
                style={{ textAlign: col.numeric ? 'center' : 'left', cursor: 'pointer' }}
                onClick={() => handleSort(col.sortKey)}
              >
                {col.label}
                {' '}
                {sortKey === col.sortKey ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((site, idx) => (
            <tr key={site.name}>
              <td style={{ color: '#94A3B8', fontWeight: 600, textAlign: 'center', width: 40 }}>
                {idx + 1}
              </td>
              <td className="td-name">{site.name}</td>
              <td style={{ textAlign: 'center', color: '#4ADE80', fontWeight: 600 }}>
                {(site.uptime ?? 0).toFixed(1)}
              </td>
              <td style={{ textAlign: 'center', color: '#F87171', fontWeight: 600 }}>
                {(site.downtime ?? 0).toFixed(1)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <Badge value={site.availability} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Export ─────────────────────────────────────────────── */
export default function PeriodTabs({ data }) {
  const activePeriods = PERIODS.filter((p) => data.periods?.[p]);
  const [activePeriod, setActivePeriod] = useState(activePeriods[0] ?? '');

  if (activePeriods.length === 0) {
    return (
      <div className="card">
        <p style={{ color: '#94A3B8', textAlign: 'center', padding: 24 }}>
          No period data available.
        </p>
      </div>
    );
  }

  const pd       = data.periods?.[activePeriod] ?? {};
  const sites    = pd.sites ?? [];
  const bands    = pd.bands ?? {};

  /* Top 15 sites by uptime hours for horizontal bar chart */
  const top15 = [...sites]
    .sort((a, b) => (b.uptime ?? 0) - (a.uptime ?? 0))
    .slice(0, 15)
    .map((s) => ({
      name:     s.name,
      Uptime:   parseFloat((s.uptime   ?? 0).toFixed(1)),
      Downtime: parseFloat((s.downtime ?? 0).toFixed(1)),
    }));

  const chartHeight = Math.max(top15.length * 34 + 60, 200);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Sub-tabs */}
      <div className="sub-tabs">
        {activePeriods.map((p) => (
          <button
            key={p}
            className={`sub-tab${activePeriod === p ? ' active' : ''}`}
            onClick={() => setActivePeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stats strip */}
      <div className="stats-strip">
        <div className="stat-chip">
          <span className="stat-chip-label">Sites</span>
          <span className="stat-chip-value">{pd.count ?? 0}</span>
          <span className="stat-chip-sub">in this period</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Avg Availability</span>
          <span className="stat-chip-value" style={{
            color: (pd.avgAvailability ?? 0) >= 75 ? '#4ADE80'
                 : (pd.avgAvailability ?? 0) >= 50 ? '#FCD34D' : '#F87171'
          }}>
            {(pd.avgAvailability ?? 0).toFixed(1)}%
          </span>
          <span className="stat-chip-sub">period average</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Avg Uptime</span>
          <span className="stat-chip-value" style={{ color: '#4ADE80' }}>
            {(pd.avgUptimeHours ?? 0).toFixed(1)}h
          </span>
          <span className="stat-chip-sub">per site</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Avg Downtime</span>
          <span className="stat-chip-value" style={{ color: '#F87171' }}>
            {(pd.avgDowntimeHours ?? 0).toFixed(1)}h
          </span>
          <span className="stat-chip-sub">per site</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Bands</span>
          <span className="stat-chip-value" style={{ fontSize: '0.95rem', paddingTop: 4 }}>
            <span style={{ color: '#4ADE80' }}>{bands.green ?? 0}</span>
            {' / '}
            <span style={{ color: '#FCD34D' }}>{bands.amber ?? 0}</span>
            {' / '}
            <span style={{ color: '#F87171' }}>{bands.red ?? 0}</span>
          </span>
          <span className="stat-chip-sub">green / amber / red</span>
        </div>
      </div>

      {/* Horizontal bar chart — top 15 sites by uptime */}
      {top15.length > 0 && (
        <div className="card" style={{ padding: '20px 20px 12px' }}>
          <div className="chart-title">Top {top15.length} Sites by Uptime — {activePeriod}</div>
          <div className="chart-sub">Sorted by uptime hours descending (max 15 shown)</div>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={top15}
              layout="vertical"
              margin={{ top: 4, right: 50, left: 120, bottom: 4 }}
              barSize={12}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 24]}
                ticks={[0, 4, 8, 12, 16, 20, 24]}
                tick={{ fill: C.axis, fontSize: 10 }}
                axisLine={{ stroke: C.grid }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={115}
                tick={{ fill: '#CBD5E1', fontSize: 10, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v.length > 18 ? v.slice(0, 17) + '…' : v}
              />
              <Tooltip content={<DarkTooltip />} />
              <Legend iconType="square" wrapperStyle={{ fontSize: '0.78rem' }} />
              <Bar dataKey="Uptime"   stackId="a" fill={C.green} name="Uptime (h)"   radius={[0, 0, 0, 0]}>
                <LabelList dataKey="Uptime"   position="right" style={{ fill: '#4ADE80', fontSize: 10, fontWeight: 700 }} formatter={(v) => v > 0 ? `${v}h` : ''} />
              </Bar>
              <Bar dataKey="Downtime" stackId="a" fill={C.red}   name="Downtime (h)" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sortable table */}
      <div className="card" style={{ padding: '20px 20px 8px' }}>
        <div className="chart-title" style={{ marginBottom: 14 }}>
          All Sites — {activePeriod}
        </div>
        <SortableTable sites={sites} />
      </div>
    </div>
  );
}
