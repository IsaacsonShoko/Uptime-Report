import { useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Building2, Monitor } from 'lucide-react';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

function bandOf(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function Badge({ value }) {
  if (value == null) return <span style={{ color: '#94A3B8' }}>—</span>;
  const cls = bandOf(value);
  return <span className={`badge badge-${cls}`}>{value.toFixed(1)}%</span>;
}

function DeviceRows({ devices }) {
  return devices.map(d => (
    <tr key={d.name} className="device-detail-row">
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 36 }}>
          <Monitor size={12} style={{ color: '#475569', flexShrink: 0 }} />
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
            {d.name}
          </span>
        </div>
      </td>
      <td style={{ textAlign: 'center', color: '#4ADE80', fontWeight: 600, fontSize: '0.82rem' }}>
        {d.uptime.toFixed(1)}h
      </td>
      <td style={{ textAlign: 'center', color: '#F87171', fontWeight: 600, fontSize: '0.82rem' }}>
        {d.downtime.toFixed(1)}h
      </td>
      <td style={{ textAlign: 'center' }}>
        <Badge value={d.availability} />
      </td>
    </tr>
  ));
}

function ClientRow({ client }) {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = client.devices && client.devices.length > 1;
  const bandCls     = bandOf(client.availability);

  return (
    <>
      <tr
        className={`client-row band-bg-${bandCls}`}
        onClick={() => hasMultiple && setExpanded(e => !e)}
        style={hasMultiple ? { cursor: 'pointer' } : {}}
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasMultiple ? (
              expanded
                ? <ChevronDown size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 14 }} />
            )}
            <Building2 size={13} style={{ color: '#60A5FA', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{client.clientName}</span>
            {hasMultiple && (
              <span style={{ fontSize: '0.7rem', color: '#64748B', marginLeft: 2 }}>
                ({client.devices.length} devices)
              </span>
            )}
          </div>
        </td>
        <td style={{ textAlign: 'center', color: '#4ADE80', fontWeight: 600 }}>
          {client.uptime.toFixed(1)}h
        </td>
        <td style={{ textAlign: 'center', color: '#F87171', fontWeight: 600 }}>
          {client.downtime.toFixed(1)}h
        </td>
        <td style={{ textAlign: 'center' }}>
          <Badge value={client.availability} />
        </td>
      </tr>
      {expanded && hasMultiple && <DeviceRows devices={client.devices} />}
    </>
  );
}

function LocationSection({ location, sites }) {
  const [collapsed, setCollapsed] = useState(false);
  const sorted    = [...sites].sort((a, b) => b.availability - a.availability);
  const avgAvail  = parseFloat((sites.reduce((s, c) => s + c.availability, 0) / sites.length).toFixed(1));
  const bandCls   = bandOf(avgAvail);
  const green = sites.filter(s => bandOf(s.availability) === 'green').length;
  const amber = sites.filter(s => bandOf(s.availability) === 'amber').length;
  const red   = sites.filter(s => bandOf(s.availability) === 'red').length;

  return (
    <div className="location-section card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="location-section-header"
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed
          ? <ChevronRight size={15} style={{ color: '#64748B' }} />
          : <ChevronDown  size={15} style={{ color: '#64748B' }} />
        }
        <MapPin size={15} style={{ color: '#60A5FA' }} />
        <span className="location-section-name">{location}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '0.78rem', color: '#64748B', marginRight: 8 }}>
          {sites.length} client{sites.length !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#4ADE80', fontWeight: 600, marginRight: 4 }}>{green}G</span>
        <span style={{ fontSize: '0.75rem', color: '#FCD34D', fontWeight: 600, marginRight: 4 }}>{amber}A</span>
        <span style={{ fontSize: '0.75rem', color: '#F87171', fontWeight: 600, marginRight: 10 }}>{red}R</span>
        <span className={`badge badge-${bandCls}`}>{avgAvail.toFixed(1)}%</span>
      </div>

      {!collapsed && (
        <div className="table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th className="td-c">Avg Uptime</th>
                <th className="td-c">Avg Downtime</th>
                <th className="td-c">Availability</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(site => (
                <ClientRow key={site.clientName} client={site} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LocationsTab({ data }) {
  const activePeriods = PERIODS.filter(p => data.periods?.[p]);
  const [activePeriod, setActivePeriod] = useState(activePeriods[0] ?? '');

  if (activePeriods.length === 0) {
    return (
      <div className="card">
        <p style={{ color: '#94A3B8', textAlign: 'center', padding: 24 }}>No period data available.</p>
      </div>
    );
  }

  const pd    = data.periods?.[activePeriod] ?? {};
  const sites = pd.sites ?? [];

  // Group by location
  const locationMap = {};
  for (const site of sites) {
    const loc = site.location || 'Unknown';
    if (!locationMap[loc]) locationMap[loc] = [];
    locationMap[loc].push(site);
  }
  const sortedLocations = Object.keys(locationMap).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Period sub-tabs */}
      <div className="sub-tabs">
        {activePeriods.map(p => (
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
          <span className="stat-chip-label">Clients</span>
          <span className="stat-chip-value">{pd.count ?? 0}</span>
          <span className="stat-chip-sub">in this period</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Avg Availability</span>
          <span className="stat-chip-value" style={{
            color: (pd.avgAvailability ?? 0) >= 75 ? '#4ADE80'
                 : (pd.avgAvailability ?? 0) >= 50 ? '#FCD34D' : '#F87171',
          }}>
            {(pd.avgAvailability ?? 0).toFixed(1)}%
          </span>
          <span className="stat-chip-sub">period average</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Locations</span>
          <span className="stat-chip-value">{sortedLocations.filter(l => l !== 'Unknown').length}</span>
          <span className="stat-chip-sub">active this period</span>
        </div>
        <div className="stat-chip">
          <span className="stat-chip-label">Bands</span>
          <span className="stat-chip-value" style={{ fontSize: '0.95rem', paddingTop: 4 }}>
            <span style={{ color: '#4ADE80' }}>{pd.bands?.green ?? 0}</span>
            {' / '}
            <span style={{ color: '#FCD34D' }}>{pd.bands?.amber ?? 0}</span>
            {' / '}
            <span style={{ color: '#F87171' }}>{pd.bands?.red ?? 0}</span>
          </span>
          <span className="stat-chip-sub">green / amber / red</span>
        </div>
      </div>

      {/* Location sections */}
      {sortedLocations.map(loc => (
        <LocationSection key={loc} location={loc} sites={locationMap[loc]} />
      ))}
    </div>
  );
}
