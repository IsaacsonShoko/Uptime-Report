/**
 * SummaryTable
 * Executive Summary table:
 * Period | Sites | Avg Avail | Avg Uptime h | Avg Downtime h | ≥75% | 50–74% | <50%
 */

function availBadge(pct) {
  if (pct == null) return null;
  let cls = 'avail-red';
  if (pct >= 75) cls = 'avail-green';
  else if (pct >= 50) cls = 'avail-amber';
  return (
    <span className={`avail-badge ${cls}`}>{pct.toFixed(1)}%</span>
  );
}

export default function SummaryTable({ data, periodLabels }) {
  const { periods } = data;

  // Build rows: one per period + an "Overall" row
  const rows = periodLabels
    .filter((p) => periods?.[p])
    .map((p) => {
      const pd = periods[p];
      return {
        period: p,
        sites: pd.count ?? 0,
        avgAvail: pd.avgAvailability ?? 0,
        avgUptime: pd.avgUptimeHours ?? 0,
        avgDowntime: pd.avgDowntimeHours ?? 0,
        green: pd.bands?.green ?? 0,
        amber: pd.bands?.amber ?? 0,
        red: pd.bands?.red ?? 0,
      };
    });

  // Compute overall aggregate
  const activeRows = rows.filter(() => true);
  const overallAvgAvail =
    activeRows.length > 0
      ? activeRows.reduce((s, r) => s + r.avgAvail, 0) / activeRows.length
      : 0;
  const overallAvgUptime =
    activeRows.length > 0
      ? activeRows.reduce((s, r) => s + r.avgUptime, 0) / activeRows.length
      : 0;
  const overallAvgDowntime =
    activeRows.length > 0
      ? activeRows.reduce((s, r) => s + r.avgDowntime, 0) / activeRows.length
      : 0;
  const overallGreen  = activeRows.reduce((s, r) => s + r.green, 0);
  const overallAmber  = activeRows.reduce((s, r) => s + r.amber, 0);
  const overallRed    = activeRows.reduce((s, r) => s + r.red, 0);
  const maxSites      = activeRows.length > 0 ? Math.max(...activeRows.map((r) => r.sites)) : 0;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th className="num">Sites</th>
            <th className="num">Avg Availability</th>
            <th className="num">Avg Uptime (h)</th>
            <th className="num">Avg Downtime (h)</th>
            <th className="num" style={{ color: '#6EE7B7' }}>≥75% (Green)</th>
            <th className="num" style={{ color: '#FCD34D' }}>50–74% (Amber)</th>
            <th className="num" style={{ color: '#FCA5A5' }}>&lt;50% (Red)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.period}>
              <td style={{ fontWeight: 600 }}>{row.period}</td>
              <td className="num">{row.sites}</td>
              <td className="num">{availBadge(row.avgAvail)}</td>
              <td className="num" style={{ color: '#16A34A', fontWeight: 600 }}>
                {row.avgUptime.toFixed(1)}
              </td>
              <td className="num" style={{ color: '#DC2626', fontWeight: 600 }}>
                {row.avgDowntime.toFixed(1)}
              </td>
              <td className="num summary-band-green">{row.green}</td>
              <td className="num summary-band-amber">{row.amber}</td>
              <td className="num summary-band-red">{row.red}</td>
            </tr>
          ))}

          {/* Overall row */}
          <tr
            style={{
              background: '#F1F5F9',
              borderTop: '2px solid #CBD5E1',
              fontWeight: 700,
            }}
          >
            <td style={{ fontWeight: 700, color: '#0A1628' }}>Overall</td>
            <td className="num">{maxSites}</td>
            <td className="num">{availBadge(overallAvgAvail)}</td>
            <td className="num" style={{ color: '#16A34A', fontWeight: 700 }}>
              {overallAvgUptime.toFixed(1)}
            </td>
            <td className="num" style={{ color: '#DC2626', fontWeight: 700 }}>
              {overallAvgDowntime.toFixed(1)}
            </td>
            <td className="num summary-band-green">{overallGreen}</td>
            <td className="num summary-band-amber">{overallAmber}</td>
            <td className="num summary-band-red">{overallRed}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
