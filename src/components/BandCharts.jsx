/**
 * BandCharts
 * Contains:
 *   1. Overview charts side-by-side:
 *      - Left:  Availability Bands per period (stacked bar: green/amber/red = site counts)
 *      - Right: Avg Uptime vs Downtime Hours per period (stacked bar, y-axis 0–24)
 *   2. Per-band sections (green / amber / red) each with a stacked bar chart of
 *      avgUptime vs avgDowntime for that band across all 3 periods.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const C = {
  green: '#16A34A',
  amber: '#D97706',
  red:   '#DC2626',
  navy:  '#0A1628',
  indigo:'#1E3A5F',
  accent:'#2563EB',
  midGray: '#94A3B8',
  lightGray: '#E2E8F0',
};

// ── Custom Tooltip ──────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${C.lightGray}`,
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        fontSize: '0.82rem',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: C.navy }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: '#64748B' }}>{entry.name}:</span>
          <span style={{ fontWeight: 700, color: C.navy }}>
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Overview: Availability Bands chart ─────────────────────
function AvailabilityBandsChart({ data, periodLabels }) {
  const chartData = periodLabels
    .filter((p) => data.periods?.[p])
    .map((p) => {
      const pd = data.periods[p];
      return {
        name: p,
        '≥75% (Green)': pd.bands?.green ?? 0,
        '50–74% (Amber)': pd.bands?.amber ?? 0,
        '<50% (Red)': pd.bands?.red ?? 0,
      };
    });

  return (
    <div className="chart-card">
      <div className="chart-title">Availability Bands — Sites per Period</div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.lightGray} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: C.indigo, fontWeight: 600 }}
            axisLine={{ stroke: C.lightGray }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: C.midGray }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            label={{ value: 'Sites', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: C.midGray } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
          <Bar dataKey="≥75% (Green)" stackId="a" fill={C.green} radius={[0, 0, 0, 0]} />
          <Bar dataKey="50–74% (Amber)" stackId="a" fill={C.amber} radius={[0, 0, 0, 0]} />
          <Bar dataKey="<50% (Red)" stackId="a" fill={C.red} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Overview: Uptime vs Downtime chart ─────────────────────
function UptimeDowntimeChart({ data, periodLabels }) {
  const chartData = periodLabels
    .filter((p) => data.periods?.[p])
    .map((p) => {
      const pd = data.periods[p];
      return {
        name: p,
        'Avg Uptime (h)': pd.avgUptimeHours ?? 0,
        'Avg Downtime (h)': pd.avgDowntimeHours ?? 0,
      };
    });

  return (
    <div className="chart-card">
      <div className="chart-title">Avg Uptime vs Downtime Hours — per Period</div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.lightGray} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: C.indigo, fontWeight: 600 }}
            axisLine={{ stroke: C.lightGray }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 24]}
            ticks={[0, 4, 8, 12, 16, 20, 24]}
            tick={{ fontSize: 11, fill: C.midGray }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: C.midGray } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
          <ReferenceLine y={12} stroke={C.midGray} strokeDasharray="4 4" />
          <Bar dataKey="Avg Uptime (h)" stackId="b" fill={C.green} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Avg Downtime (h)" stackId="b" fill={C.red} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Per-Band Section ────────────────────────────────────────
function BandSection({ band, label, colorClass, bgClass, icon, data, periodLabels }) {
  const bandData = data.bandDetails?.[band];

  const chartData = periodLabels
    .filter((p) => bandData?.[p])
    .map((p) => {
      const bd = bandData[p];
      return {
        name: p,
        'Avg Uptime (h)': bd.avgUptime ?? 0,
        'Avg Downtime (h)': bd.avgDowntime ?? 0,
      };
    });

  // Stats summary
  const counts = periodLabels
    .filter((p) => data.periods?.[p])
    .map((p) => {
      const pd = data.periods[p];
      return pd.bands?.[band] ?? 0;
    });

  return (
    <div className="band-section">
      <div className={`band-section-header ${bgClass}`}>
        <span>{icon}</span>
        <span>{label} — {counts.join(' / ')} sites across periods</span>
      </div>
      <div className="band-section-body">
        <div
          style={{
            fontSize: '0.78rem',
            color: '#64748B',
            marginBottom: 12,
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          {periodLabels
            .filter((p) => bandData?.[p])
            .map((p) => {
              const bd = bandData[p];
              return (
                <span key={p}>
                  <strong style={{ color: '#1E293B' }}>{p}</strong>:{' '}
                  {(bd.count ?? '—')} sites, avg uptime{' '}
                  <span style={{ color: C.green, fontWeight: 700 }}>{(bd.avgUptime ?? 0).toFixed(1)}h</span>
                  {' / '}
                  downtime{' '}
                  <span style={{ color: C.red, fontWeight: 700 }}>{(bd.avgDowntime ?? 0).toFixed(1)}h</span>
                </span>
              );
            })}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.lightGray} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: C.indigo, fontWeight: 600 }}
              axisLine={{ stroke: C.lightGray }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 24]}
              ticks={[0, 6, 12, 18, 24]}
              tick={{ fontSize: 11, fill: C.midGray }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Hours', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: C.midGray } }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
            <ReferenceLine y={12} stroke={C.midGray} strokeDasharray="4 4" />
            <Bar dataKey="Avg Uptime (h)" stackId="c" fill={C.green} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Avg Downtime (h)" stackId="c" fill={C.red} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────
export default function BandCharts({ data, periodLabels }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Overview charts — side by side */}
      <div className="charts-row">
        <AvailabilityBandsChart data={data} periodLabels={periodLabels} />
        <UptimeDowntimeChart data={data} periodLabels={periodLabels} />
      </div>

      {/* Per-band slides */}
      <div className="section-title" style={{ marginBottom: 0 }}>
        Per-Band Breakdown
      </div>
      <div className="band-sections">
        <BandSection
          band="green"
          label="Green Band — ≥75% Availability"
          bgClass="bg-green"
          icon="✓"
          data={data}
          periodLabels={periodLabels}
        />
        <BandSection
          band="amber"
          label="Amber Band — 50–74% Availability"
          bgClass="bg-amber"
          icon="⚠"
          data={data}
          periodLabels={periodLabels}
        />
        <BandSection
          band="red"
          label="Red Band — <50% Availability"
          bgClass="bg-red"
          icon="✕"
          data={data}
          periodLabels={periodLabels}
        />
      </div>
    </div>
  );
}
