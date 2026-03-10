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

const BAND_CONFIG = {
  green: { label: '≥75% — Good',     color: '#16A34A', cls: 'green', textColor: '#4ADE80' },
  amber: { label: '50–74% — Moderate', color: '#D97706', cls: 'amber', textColor: '#FCD34D' },
  red:   { label: '<50% — Critical',  color: '#DC2626', cls: 'red',   textColor: '#F87171' },
};

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

/* ── Collect all sites in this band across all periods ──────── */
function collectBandSites(band, data) {
  /* Build map: siteName -> { 'Sun to Mon': avail, ... } */
  const map = {};

  PERIODS.forEach((p) => {
    const pd = data.periods?.[p];
    if (!pd?.sites) return;
    pd.sites.forEach((site) => {
      const col = availColor(site.availability);
      if (col !== band) return;
      if (!map[site.name]) map[site.name] = {};
      map[site.name][p] = site.availability;
    });
  });

  return Object.entries(map).map(([name, periods]) => {
    const values = Object.values(periods).filter((v) => v != null);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { name, periods, avg };
  }).sort((a, b) => b.avg - a.avg);
}

export default function BandTab({ band, data }) {
  const cfg = BAND_CONFIG[band];
  const bandDetails = data.bandDetails?.[band] ?? {};

  /* ── Stats strip data ── */
  const stripChips = PERIODS.map((p) => {
    const bd = bandDetails[p] ?? {};
    return {
      period:      p,
      count:       bd.count     ?? 0,
      avgUptime:   bd.avgUptime  ?? 0,
      avgDowntime: bd.avgDowntime ?? 0,
    };
  });

  /* ── Bar chart data ── */
  const chartData = PERIODS
    .filter((p) => bandDetails[p])
    .map((p) => {
      const bd = bandDetails[p];
      return {
        name:     p,
        Uptime:   parseFloat((bd.avgUptime   ?? 0).toFixed(1)),
        Downtime: parseFloat((bd.avgDowntime ?? 0).toFixed(1)),
      };
    });

  /* ── Site table ── */
  const sites = collectBandSites(band, data);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Band header pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className={`band-pill ${cfg.cls}`}>{cfg.label}</span>
        <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
          {sites.length} unique site{sites.length !== 1 ? 's' : ''} in this band
        </span>
      </div>

      {/* Stats Strip */}
      <div className="stats-strip">
        {stripChips.map((chip) => (
          <div key={chip.period} className="stat-chip">
            <span className="stat-chip-label">{chip.period}</span>
            <span className="stat-chip-value">{chip.count}</span>
            <span className="stat-chip-sub">
              <span style={{ color: '#4ADE80', fontWeight: 600 }}>{chip.avgUptime.toFixed(1)}h up</span>
              {' · '}
              <span style={{ color: '#F87171', fontWeight: 600 }}>{chip.avgDowntime.toFixed(1)}h down</span>
            </span>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="card" style={{ padding: '20px 20px 12px' }}>
        <div className="chart-title">Avg Uptime vs Downtime — {cfg.label}</div>
        <div className="chart-sub">Hours per period for sites in this band</div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
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
                formatter={(v) => v > 0.8 ? v.toFixed(1) : ''}
              />
            </Bar>
            <Bar dataKey="Downtime" stackId="a" fill={C.red} name="Avg Downtime (h)" radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="Downtime"
                position="center"
                style={{ fill: '#fff', fontSize: 11, fontWeight: 700 }}
                formatter={(v) => v > 0.8 ? v.toFixed(1) : ''}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Site Table */}
      <div className="card" style={{ padding: '20px 20px 0' }}>
        <div className="chart-title" style={{ marginBottom: 14 }}>
          Sites in {cfg.label} Band
        </div>
        {sites.length === 0 ? (
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', paddingBottom: 16 }}>
            No sites in this band for the selected date.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="td-c">Sun to Mon</th>
                  <th className="td-c">Tue to Wed</th>
                  <th className="td-c">Thur to Fri</th>
                  <th className="td-c">Avg</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.name}>
                    <td className="td-name">{site.name}</td>
                    {PERIODS.map((p) => (
                      <td key={p} className="td-c">
                        <Badge value={site.periods[p] ?? null} />
                      </td>
                    ))}
                    <td className="td-c">
                      <Badge value={parseFloat(site.avg.toFixed(1))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
