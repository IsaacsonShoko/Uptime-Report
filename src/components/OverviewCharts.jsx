import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from 'recharts';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const C = {
  green:  '#16A34A',
  amber:  '#D97706',
  red:    '#DC2626',
  green2: '#4ADE80',
  red2:   '#F87171',
  grid:   'rgba(255,255,255,0.06)',
  axis:   '#94A3B8',
  navy:   '#0F2040',
};

function availColor(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function Badge({ value }) {
  const cls = availColor(value);
  return (
    <span className={`badge badge-${cls}`}>{value.toFixed(1)}%</span>
  );
}

/* ── Custom Tooltip ─────────────────────────────────────────── */
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
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
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Executive Summary Table ────────────────────────────────── */
function SummaryTable({ data }) {
  const rows = PERIODS
    .filter((p) => data.periods?.[p])
    .map((p) => {
      const pd = data.periods[p];
      return {
        period:      p,
        sites:       pd.count         ?? 0,
        avgAvail:    pd.avgAvailability  ?? 0,
        avgUptime:   pd.avgUptimeHours   ?? 0,
        avgDowntime: pd.avgDowntimeHours ?? 0,
        green:       pd.bands?.green ?? 0,
        amber:       pd.bands?.amber ?? 0,
        red:         pd.bands?.red   ?? 0,
      };
    });

  const n = rows.length || 1;
  const overall = {
    sites:       rows.length ? Math.max(...rows.map((r) => r.sites)) : 0,
    avgAvail:    rows.reduce((s, r) => s + r.avgAvail,    0) / n,
    avgUptime:   rows.reduce((s, r) => s + r.avgUptime,   0) / n,
    avgDowntime: rows.reduce((s, r) => s + r.avgDowntime, 0) / n,
    green:       rows.reduce((s, r) => s + r.green, 0),
    amber:       rows.reduce((s, r) => s + r.amber, 0),
    red:         rows.reduce((s, r) => s + r.red,   0),
  };

  return (
    <div className="card">
      <div className="card-title">Executive Summary</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th className="td-c">Sites</th>
              <th className="td-c">Avg Avail</th>
              <th className="td-c">Avg Uptime h</th>
              <th className="td-c">Avg Downtime h</th>
              <th className="td-c" style={{ color: '#4ADE80' }}>≥75%</th>
              <th className="td-c" style={{ color: '#FCD34D' }}>50–74%</th>
              <th className="td-c" style={{ color: '#F87171' }}>&lt;50%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.period}>
                <td className="td-name">{row.period}</td>
                <td className="td-c">{row.sites}</td>
                <td className="td-c"><Badge value={row.avgAvail} /></td>
                <td className="td-c" style={{ color: '#4ADE80', fontWeight: 600 }}>
                  {row.avgUptime.toFixed(1)}
                </td>
                <td className="td-c" style={{ color: '#F87171', fontWeight: 600 }}>
                  {row.avgDowntime.toFixed(1)}
                </td>
                <td className="td-c" style={{ color: '#4ADE80', fontWeight: 700 }}>{row.green}</td>
                <td className="td-c" style={{ color: '#FCD34D', fontWeight: 700 }}>{row.amber}</td>
                <td className="td-c" style={{ color: '#F87171', fontWeight: 700 }}>{row.red}</td>
              </tr>
            ))}
            {/* Overall row */}
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <td className="td-name" style={{ fontWeight: 700, color: '#E2E8F0' }}>Overall</td>
              <td className="td-c" style={{ fontWeight: 700 }}>{overall.sites}</td>
              <td className="td-c"><Badge value={overall.avgAvail} /></td>
              <td className="td-c" style={{ color: '#4ADE80', fontWeight: 700 }}>
                {overall.avgUptime.toFixed(1)}
              </td>
              <td className="td-c" style={{ color: '#F87171', fontWeight: 700 }}>
                {overall.avgDowntime.toFixed(1)}
              </td>
              <td className="td-c" style={{ color: '#4ADE80', fontWeight: 700 }}>{overall.green}</td>
              <td className="td-c" style={{ color: '#FCD34D', fontWeight: 700 }}>{overall.amber}</td>
              <td className="td-c" style={{ color: '#F87171', fontWeight: 700 }}>{overall.red}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Donut Chart ────────────────────────────────────────────── */
function DonutChart({ data }) {
  /* Sum across all periods */
  let totalGreen = 0;
  let totalAmber = 0;
  let totalRed   = 0;

  PERIODS.forEach((p) => {
    const pd = data.periods?.[p];
    if (pd?.bands) {
      totalGreen += pd.bands.green ?? 0;
      totalAmber += pd.bands.amber ?? 0;
      totalRed   += pd.bands.red   ?? 0;
    }
  });

  const total = totalGreen + totalAmber + totalRed;

  const pieData = [
    { name: '≥75% Green',   value: totalGreen, color: C.green },
    { name: '50–74% Amber', value: totalAmber, color: C.amber },
    { name: '<50% Red',     value: totalRed,   color: C.red   },
  ].filter((d) => d.value > 0);

  return (
    <div className="chart-card">
      <div className="chart-title">Site Distribution — All Periods</div>
      <div className="chart-sub">Total band counts summed across 3 periods</div>
      <div className="donut-wrapper" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              dataKey="value"
              strokeWidth={2}
              stroke="rgba(0,0,0,0.3)"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{
                    background: '#0A1628',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '8px 13px',
                    fontSize: '0.78rem',
                    color: '#E2E8F0',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.name}</div>
                    <div>Count: <strong>{d.value}</strong></div>
                    <div>Share: <strong>{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</strong></div>
                  </div>
                );
              }}
            />
            <Legend
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ fontSize: '0.78rem', paddingTop: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label overlaid */}
        <div className="donut-center" style={{ pointerEvents: 'none', top: 0, bottom: 0, left: 0, right: 0, position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginTop: -24 }}>
            <div className="donut-big">{data.totalSites ?? total}</div>
            <div className="donut-small">Sites</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stacked Bar Chart ──────────────────────────────────────── */
function UptimeBar({ data }) {
  const chartData = PERIODS
    .filter((p) => data.periods?.[p])
    .map((p) => {
      const pd = data.periods[p];
      return {
        name:    p,
        Uptime:  parseFloat((pd.avgUptimeHours   ?? 0).toFixed(1)),
        Downtime: parseFloat((pd.avgDowntimeHours ?? 0).toFixed(1)),
      };
    });

  return (
    <div className="chart-card">
      <div className="chart-title">Avg Uptime vs Downtime — Hours per Period</div>
      <div className="chart-sub">Stacked to 24 h. Green = uptime, Red = downtime.</div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
          <XAxis
            dataKey="name"
            tick={{ fill: C.axis, fontSize: 11 }}
            axisLine={{ stroke: C.grid }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 24]}
            ticks={[0, 4, 8, 12, 16, 20, 24]}
            tick={{ fill: C.axis, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<DarkTooltip />} />
          <Legend iconType="square" wrapperStyle={{ fontSize: '0.78rem' }} />
          <Bar dataKey="Uptime" stackId="a" fill={C.green} name="Avg Uptime (h)" radius={[0, 0, 0, 0]}>
            <LabelList
              dataKey="Uptime"
              position="center"
              style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}
              formatter={(v) => v > 0.5 ? v.toFixed(1) : ''}
            />
          </Bar>
          <Bar dataKey="Downtime" stackId="a" fill={C.red} name="Avg Downtime (h)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="Downtime"
              position="center"
              style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}
              formatter={(v) => v > 0.5 ? v.toFixed(1) : ''}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Main Export ────────────────────────────────────────────── */
export default function OverviewCharts({ data }) {
  return (
    <>
      <SummaryTable data={data} />
      <div className="charts-row">
        <DonutChart data={data} />
        <UptimeBar  data={data} />
      </div>
    </>
  );
}
