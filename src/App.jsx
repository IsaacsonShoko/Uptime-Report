import { useState, useEffect, useRef } from 'react';
import KPICards from './components/KPICards.jsx';
import OverviewCharts from './components/OverviewCharts.jsx';
import BandTab from './components/BandTab.jsx';
import LocationsTab from './components/LocationsTab.jsx';
import TopPerformers from './components/TopPerformers.jsx';
import AttentionTable from './components/AttentionTable.jsx';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const TABS = [
  { id: 'overview',  label: 'Overview',       dot: '#2563EB' },
  { id: 'green',     label: 'Green Band',     dot: '#16A34A' },
  { id: 'amber',     label: 'Amber Band',     dot: '#D97706' },
  { id: 'red',       label: 'Red Band',       dot: '#DC2626' },
  { id: 'locations', label: 'Locations',      dot: '#60A5FA' },
  { id: 'attention', label: 'Attention',      dot: '#DC2626' },
];

function bandOf(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function filterByLocation(data, location) {
  if (!location) return data;

  const periods = {};
  for (const [period, pData] of Object.entries(data.periods || {})) {
    const sites = pData.sites.filter(s => s.location === location);
    if (!sites.length) continue;

    const bands = { green: 0, amber: 0, red: 0 };
    sites.forEach(s => bands[bandOf(s.availability)]++);

    periods[period] = {
      ...pData,
      sites,
      bands,
      count:           sites.length,
      avgAvailability: parseFloat((sites.reduce((s, r) => s + r.availability, 0) / sites.length).toFixed(1)),
      avgUptimeHours:  parseFloat((sites.reduce((s, r) => s + r.uptime,       0) / sites.length).toFixed(2)),
      avgDowntimeHours:parseFloat((sites.reduce((s, r) => s + r.downtime,     0) / sites.length).toFixed(2)),
    };
  }

  const bandDetails = { green: {}, amber: {}, red: {} };
  for (const period of Object.keys(periods)) {
    for (const band of ['green', 'amber', 'red']) {
      const bs = periods[period].sites.filter(s => bandOf(s.availability) === band);
      if (!bs.length) { bandDetails[band][period] = { count: 0, avgUptime: 0, avgDowntime: 0 }; continue; }
      bandDetails[band][period] = {
        count:      bs.length,
        avgUptime:  parseFloat((bs.reduce((s, r) => s + r.uptime,   0) / bs.length).toFixed(2)),
        avgDowntime:parseFloat((bs.reduce((s, r) => s + r.downtime, 0) / bs.length).toFixed(2)),
      };
    }
  }

  const activePeriods = Object.keys(periods);
  const siteNames     = [...new Set(activePeriods.flatMap(p => periods[p].sites.map(s => s.name)))];
  const allAvails     = activePeriods.flatMap(p => periods[p].sites.map(s => s.availability));
  const overallAvgAvailability = allAvails.length
    ? parseFloat((allAvails.reduce((s, v) => s + v, 0) / allAvails.length).toFixed(1))
    : 0;

  return {
    ...data,
    periods,
    bandDetails,
    totalSites: siteNames.length,
    overallAvgAvailability,
    topPerformers:         (data.topPerformers         || []).filter(n    => siteNames.includes(n)),
    sitesNeedingAttention: (data.sitesNeedingAttention || []).filter(s    => siteNames.includes(s.name)),
  };
}

export default function App() {
  const [data,             setData]             = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [activeTab,        setActiveTab]        = useState('overview');
  const [selectedDate,     setSelectedDate]     = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const isInitial = useRef(true);

  /* Initial load */
  useEffect(() => {
    fetch('/api/get-dashboard')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        setData(json);
        setSelectedDate(json.availableDates?.[0] ?? json.date ?? '');
        setLoading(false);
        isInitial.current = false;
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
        isInitial.current = false;
      });
  }, []);

  /* Re-fetch when date changes */
  useEffect(() => {
    if (isInitial.current || !selectedDate) return;
    setLoading(true);
    setError(null);
    setSelectedLocation('');
    fetch(`/api/get-dashboard?date=${selectedDate}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err)  => { setError(err.message); setLoading(false); });
  }, [selectedDate]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner-ring" />
        <span>Loading dashboard data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <span style={{ fontSize: '2rem' }}>⚠</span>
        <strong>Failed to load dashboard</strong>
        <p>{error}</p>
      </div>
    );
  }

  const viewData = filterByLocation(data, selectedLocation);

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <KPICards data={viewData} />
            <OverviewCharts data={viewData} />
          </>
        );
      case 'green':     return <BandTab band="green" data={viewData} />;
      case 'amber':     return <BandTab band="amber" data={viewData} />;
      case 'red':       return <BandTab band="red"   data={viewData} />;
      case 'locations': return <LocationsTab data={viewData} />;
      case 'attention':
        return (
          <>
            <TopPerformers performers={viewData.topPerformers} />
            <AttentionTable sites={viewData.sitesNeedingAttention} periodLabels={PERIODS} />
          </>
        );
      default: return null;
    }
  }

  return (
    <>
      {/* ── Sticky Header ── */}
      <header className="app-header">
        <h1>
          <span className="header-dot" />
          ISP Uptime Monitor
        </h1>
        <div className="header-right">
          <span className="date-label">Location</span>
          <select
            className="date-select"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="">All Locations</option>
            {(data.locations ?? []).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <span className="date-label">Report Date</span>
          <select
            className="date-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          >
            {(data.availableDates ?? [data.date]).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </header>

      {/* ── Sticky Tab Nav ── */}
      <nav className="tab-nav">
        <a href="/capture" className="tab-btn tab-btn--capture">
          <span className="tab-dot" style={{ background: '#2563EB' }} />
          Capture Data
        </a>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="tab-dot" style={{ background: t.dot }} />
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      <main className="app-main">
        {selectedLocation && (
          <div className="location-banner">
            Showing: <strong>{selectedLocation}</strong>
            <button className="location-clear" onClick={() => setSelectedLocation('')}>✕ All Locations</button>
          </div>
        )}
        {renderTab()}
      </main>
    </>
  );
}
