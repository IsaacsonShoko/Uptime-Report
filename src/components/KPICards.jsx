import { Monitor, Activity, Calendar, Clock, CheckCircle2, AlertTriangle, XOctagon } from 'lucide-react';

const PERIODS = ['Sat to Sun', 'Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

function availColor(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

export default function KPICards({ data }) {
  const { totalSites, totalDevices, overallAvgAvailability, date, periods } = data;

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
  const avgGreen = Math.round(sumGreen / PERIODS.length);
  const avgAmber = Math.round(sumAmber / PERIODS.length);
  const avgRed   = Math.round(sumRed   / PERIODS.length);

  const avail    = typeof overallAvgAvailability === 'number' ? overallAvgAvailability : 0;
  const availCls = availColor(avail);

  return (
    <div className="kpi-grid">
      {/* 1 — Total Clients */}
      <div className="kpi-card">
        <div className="kpi-icon-row">
          <Monitor size={16} className="kpi-icon kpi-icon--blue" />
          <span className="kpi-label">Total Clients</span>
        </div>
        <span className="kpi-value">{totalSites ?? '—'}</span>
        <span className="kpi-sub">
          {totalDevices != null && totalDevices !== totalSites
            ? `${totalDevices} devices monitored`
            : 'Monitored this report'}
        </span>
      </div>

      {/* 2 — Overall Avg Availability */}
      <div className="kpi-card">
        <div className="kpi-icon-row">
          <Activity size={16} className={`kpi-icon kpi-icon--${availCls}`} />
          <span className="kpi-label">Overall Avg Availability</span>
        </div>
        <span className={`kpi-value c-${availCls}`}>{avail.toFixed(1)}%</span>
        <span className="kpi-sub">
          {avail >= 75 ? 'Above threshold' : avail >= 50 ? 'Moderate — monitor closely' : 'Below threshold — action needed'}
        </span>
      </div>

      {/* 3 — Reporting Date */}
      <div className="kpi-card">
        <div className="kpi-icon-row">
          <Calendar size={16} className="kpi-icon kpi-icon--slate" />
          <span className="kpi-label">Reporting Date</span>
        </div>
        <span className="kpi-value" style={{ fontSize: '1.05rem', letterSpacing: '0.01em', paddingTop: 4 }}>
          {date ?? '—'}
        </span>
        <span className="kpi-sub">Current report date</span>
      </div>

      {/* 4 — Time Periods */}
      <div className="kpi-card">
        <div className="kpi-icon-row">
          <Clock size={16} className="kpi-icon kpi-icon--slate" />
          <span className="kpi-label">Time Periods</span>
        </div>
        <span className="kpi-value">{PERIODS.length}</span>
        <span className="kpi-sub">Sat–Sun · Sun–Mon · Tue–Wed · Thur–Fri</span>
      </div>

      {/* 5 — Green Clients */}
      <div className="kpi-card kpi-green">
        <div className="kpi-icon-row">
          <CheckCircle2 size={16} className="kpi-icon kpi-icon--green" />
          <span className="kpi-label">Green Clients</span>
        </div>
        <span className="kpi-value c-green">{avgGreen}</span>
        <span className="kpi-sub">≥75% avg availability</span>
      </div>

      {/* 6 — Amber Clients */}
      <div className="kpi-card kpi-amber">
        <div className="kpi-icon-row">
          <AlertTriangle size={16} className="kpi-icon kpi-icon--amber" />
          <span className="kpi-label">Amber Clients</span>
        </div>
        <span className="kpi-value c-amber">{avgAmber}</span>
        <span className="kpi-sub">50–74% avg availability</span>
      </div>

      {/* 7 — Red Clients */}
      <div className="kpi-card kpi-red">
        <div className="kpi-icon-row">
          <XOctagon size={16} className="kpi-icon kpi-icon--red" />
          <span className="kpi-label">Red Clients</span>
        </div>
        <span className="kpi-value c-red">{avgRed}</span>
        <span className="kpi-sub">&lt;50% avg availability</span>
      </div>
    </div>
  );
}
