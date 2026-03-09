const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

function availColor(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

export default function KPICards({ data }) {
  const { totalSites, overallAvgAvailability, date, periods } = data;

  /* Sum green/amber/red counts across all 3 periods then average */
  let sumGreen = 0;
  let sumAmber = 0;
  let sumRed   = 0;

  PERIODS.forEach((p) => {
    const period = periods?.[p];
    if (period?.bands) {
      sumGreen += period.bands.green ?? 0;
      sumAmber += period.bands.amber ?? 0;
      sumRed   += period.bands.red   ?? 0;
    }
  });

  const avgGreen = Math.round(sumGreen / 3);
  const avgAmber = Math.round(sumAmber / 3);
  const avgRed   = Math.round(sumRed   / 3);

  const avail    = typeof overallAvgAvailability === 'number'
    ? overallAvgAvailability
    : 0;
  const availStr = avail.toFixed(1);
  const availCls = availColor(avail);

  return (
    <div className="kpi-grid">
      {/* 1 — Total Sites */}
      <div className="kpi-card">
        <span className="kpi-label">Total Sites</span>
        <span className="kpi-value">{totalSites ?? '—'}</span>
        <span className="kpi-sub">Monitored this report</span>
      </div>

      {/* 2 — Overall Avg Availability */}
      <div className="kpi-card">
        <span className="kpi-label">Overall Avg Availability</span>
        <span className={`kpi-value c-${availCls}`}>{availStr}%</span>
        <span className="kpi-sub">
          {avail >= 75 ? 'Above threshold' : avail >= 50 ? 'Moderate — monitor closely' : 'Below threshold — action needed'}
        </span>
      </div>

      {/* 3 — Reporting Date */}
      <div className="kpi-card">
        <span className="kpi-label">Reporting Date</span>
        <span className="kpi-value" style={{ fontSize: '1.05rem', letterSpacing: '0.01em', paddingTop: 4 }}>
          {date ?? '—'}
        </span>
        <span className="kpi-sub">Current report date</span>
      </div>

      {/* 4 — Time Periods */}
      <div className="kpi-card">
        <span className="kpi-label">Time Periods</span>
        <span className="kpi-value">3</span>
        <span className="kpi-sub">Sun–Mon · Tue–Wed · Thur–Fri</span>
      </div>

      {/* 5 — Green Sites */}
      <div className="kpi-card kpi-green">
        <span className="kpi-label">Green Sites</span>
        <span className="kpi-value c-green">{avgGreen}</span>
        <span className="kpi-sub">≥75% avg availability</span>
      </div>

      {/* 6 — Amber Sites */}
      <div className="kpi-card kpi-amber">
        <span className="kpi-label">Amber Sites</span>
        <span className="kpi-value c-amber">{avgAmber}</span>
        <span className="kpi-sub">50–74% avg availability</span>
      </div>

      {/* 7 — Red Sites */}
      <div className="kpi-card kpi-red">
        <span className="kpi-label">Red Sites</span>
        <span className="kpi-value c-red">{avgRed}</span>
        <span className="kpi-sub">&lt;50% avg availability</span>
      </div>
    </div>
  );
}
