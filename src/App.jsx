import { useState, useEffect, useRef } from 'react';
import KPICards from './components/KPICards.jsx';
import OverviewCharts from './components/OverviewCharts.jsx';
import BandTab from './components/BandTab.jsx';
import PeriodTabs from './components/PeriodTabs.jsx';
import TopPerformers from './components/TopPerformers.jsx';
import AttentionTable from './components/AttentionTable.jsx';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const TABS = [
  { id: 'overview', label: 'Overview',      dot: '#2563EB' },
  { id: 'green',    label: 'Green Band',    dot: '#16A34A' },
  { id: 'amber',    label: 'Amber Band',    dot: '#D97706' },
  { id: 'red',      label: 'Red Band',      dot: '#DC2626' },
  { id: 'detail',   label: 'Period Detail', dot: '#94A3B8' },
  { id: 'attention',label: 'Attention',     dot: '#DC2626' },
];

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState('');
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

  /* Re-fetch when date changes (skip the initial set) */
  useEffect(() => {
    if (isInitial.current || !selectedDate) return;
    setLoading(true);
    setError(null);
    fetch(`/api/get-dashboard?date=${selectedDate}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedDate]);

  /* ── Render ── */
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

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <KPICards data={data} />
            <OverviewCharts data={data} />
          </>
        );
      case 'green':
        return <BandTab band="green" data={data} />;
      case 'amber':
        return <BandTab band="amber" data={data} />;
      case 'red':
        return <BandTab band="red" data={data} />;
      case 'detail':
        return <PeriodTabs data={data} />;
      case 'attention':
        return (
          <>
            <TopPerformers performers={data.topPerformers} />
            <AttentionTable sites={data.sitesNeedingAttention} periodLabels={PERIODS} />
          </>
        );
      default:
        return null;
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
        {renderTab()}
      </main>
    </>
  );
}
