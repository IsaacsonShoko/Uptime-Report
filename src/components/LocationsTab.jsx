import { useState } from 'react';
import { MapPin, Building2, Monitor } from 'lucide-react';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

function bandOf(pct) {
  if (pct >= 75) return 'green';
  if (pct >= 50) return 'amber';
  return 'red';
}

function Badge({ value }) {
  if (value == null) return <span style={{ color: '#94A3B8' }}>—</span>;
  return <span className={`badge badge-${bandOf(value)}`}>{value.toFixed(1)}%</span>;
}

function GARLabel({ green, amber, red }) {
  return (
    <span style={{ fontSize: '0.68rem', letterSpacing: '0.02em' }}>
      <span style={{ color: '#4ADE80', fontWeight: 700 }}>{green}</span>
      <span style={{ color: '#475569' }}> / </span>
      <span style={{ color: '#FCD34D', fontWeight: 700 }}>{amber}</span>
      <span style={{ color: '#475569' }}> / </span>
      <span style={{ color: '#F87171', fontWeight: 700 }}>{red}</span>
    </span>
  );
}

export default function LocationsTab({ data }) {
  const [selectedLoc, setSelectedLoc] = useState(null);

  const activePeriods = PERIODS.filter(p => data.periods?.[p]);

  if (activePeriods.length === 0) {
    return (
      <div className="card">
        <p style={{ color: '#94A3B8', textAlign: 'center', padding: 24 }}>No period data available.</p>
      </div>
    );
  }

  // Build per-location, per-period stats from all active periods
  const locationMap = {};
  for (const period of activePeriods) {
    for (const site of data.periods[period]?.sites ?? []) {
      const loc = site.location || 'Unknown';
      if (!locationMap[loc]) locationMap[loc] = { periods: {}, clientNames: new Set() };
      locationMap[loc].clientNames.add(site.clientName);
      if (!locationMap[loc].periods[period]) locationMap[loc].periods[period] = { sites: [] };
      locationMap[loc].periods[period].sites.push(site);
    }
  }

  const locations = Object.entries(locationMap).map(([name, d]) => {
    const periodStats = {};
    for (const [p, pd] of Object.entries(d.periods)) {
      const avail = parseFloat((pd.sites.reduce((s, r) => s + r.availability, 0) / pd.sites.length).toFixed(1));
      periodStats[p] = {
        avgAvail: avail,
        count:    pd.sites.length,
        green:    pd.sites.filter(s => bandOf(s.availability) === 'green').length,
        amber:    pd.sites.filter(s => bandOf(s.availability) === 'amber').length,
        red:      pd.sites.filter(s => bandOf(s.availability) === 'red').length,
        sites:    pd.sites,
      };
    }
    const allAvails = Object.values(periodStats).flatMap(ps => ps.sites.map(s => s.availability));
    const overallAvg = allAvails.length
      ? parseFloat((allAvails.reduce((s, v) => s + v, 0) / allAvails.length).toFixed(1))
      : 0;
    return { name, periodStats, overallAvg, clientCount: d.clientNames.size };
  }).sort((a, b) => b.overallAvg - a.overallAvg);

  // Build cross-period client table for the selected location
  const selectedData = locations.find(l => l.name === selectedLoc) ?? null;
  const clientRows = selectedData ? (() => {
    const clientMap = {};
    for (const [period, ps] of Object.entries(selectedData.periodStats)) {
      for (const site of ps.sites) {
        if (!clientMap[site.clientName])
          clientMap[site.clientName] = { clientName: site.clientName, devices: site.devices ?? [], periods: {} };
        clientMap[site.clientName].periods[period] = {
          availability: site.availability,
          uptime:       site.uptime,
          downtime:     site.downtime,
        };
      }
    }
    return Object.values(clientMap).sort((a, b) => {
      const avgA = Object.values(a.periods).reduce((s, v) => s + v.availability, 0) / Object.values(a.periods).length;
      const avgB = Object.values(b.periods).reduce((s, v) => s + v.availability, 0) / Object.values(b.periods).length;
      return avgB - avgA;
    });
  })() : [];

  const TH = ({ children, center }) => (
    <th style={{
      padding: '9px 14px', textAlign: center ? 'center' : 'left',
      background: '#1E3A5F', color: '#CCDDEE',
      fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap',
      borderBottom: '2px solid #0A1628',
    }}>
      {children}
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Location × Period matrix ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <TH>Location</TH>
                <TH center>Clients</TH>
                {activePeriods.map(p => <TH key={p} center>{p}</TH>)}
                <TH center>Overall</TH>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => {
                const isSelected = selectedLoc === loc.name;
                const bg = isSelected ? '#EFF6FF' : i % 2 === 0 ? '#fff' : '#F8FAFC';
                return (
                  <tr
                    key={loc.name}
                    onClick={() => setSelectedLoc(isSelected ? null : loc.name)}
                    style={{
                      background:   bg,
                      cursor:       'pointer',
                      borderLeft:   isSelected ? '3px solid #2563EB' : '3px solid transparent',
                      transition:   'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <MapPin size={13} style={{ color: '#60A5FA', flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1E293B' }}>{loc.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748B', fontSize: '0.85rem', borderBottom: '1px solid #E2E8F0' }}>
                      {loc.clientCount}
                    </td>
                    {activePeriods.map(p => {
                      const ps = loc.periodStats[p];
                      if (!ps) return (
                        <td key={p} style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8', borderBottom: '1px solid #E2E8F0' }}>—</td>
                      );
                      return (
                        <td key={p} style={{ padding: '8px 14px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <Badge value={ps.avgAvail} />
                            <GARLabel green={ps.green} amber={ps.amber} red={ps.red} />
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>
                      <span className={`badge badge-${bandOf(loc.overallAvg)}`} style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {loc.overallAvg.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '6px 14px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', fontSize: '0.72rem', color: '#94A3B8' }}>
          Click a row to see client breakdown · G&nbsp;/&nbsp;A&nbsp;/&nbsp;R = Green&nbsp;/&nbsp;Amber&nbsp;/&nbsp;Red clients
        </div>
      </div>

      {/* ── Client drill-down for selected location ── */}
      {selectedData && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#1E3A5F', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} style={{ color: '#60A5FA' }} />
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.92rem' }}>{selectedLoc}</span>
            <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
              — {selectedData.clientCount} client{selectedData.clientCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Client', 'Devices', ...activePeriods, 'Avg'].map((h, i) => (
                    <th key={h} style={{
                      padding: '8px 14px', textAlign: i === 0 ? 'left' : 'center',
                      color: '#475569', fontSize: '0.75rem', fontWeight: 700,
                      borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientRows.map((client, i) => {
                  const pVals  = Object.values(client.periods).map(p => p.availability);
                  const avgVal = pVals.length
                    ? parseFloat((pVals.reduce((s, v) => s + v, 0) / pVals.length).toFixed(1))
                    : null;
                  const bg = i % 2 === 0 ? '#fff' : '#F8FAFC';
                  return (
                    <tr key={client.clientName} style={{ background: bg }}>
                      <td style={{ padding: '9px 14px', borderBottom: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <Building2 size={12} style={{ color: '#60A5FA', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '0.86rem', color: '#1E293B' }}>{client.clientName}</span>
                        </div>
                        {client.devices.length > 1 && (
                          <div style={{ paddingLeft: 19, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '2px 8px' }}>
                            {client.devices.map(d => (
                              <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'monospace' }}>
                                <Monitor size={9} style={{ color: '#475569' }} />
                                {d.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8', borderBottom: '1px solid #E2E8F0' }}>
                        {client.devices.length || 1}
                      </td>
                      {activePeriods.map(p => {
                        const v = client.periods[p];
                        return (
                          <td key={p} style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>
                            {v ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <Badge value={v.availability} />
                                <span style={{ fontSize: '0.67rem', color: '#94A3B8' }}>
                                  {v.uptime.toFixed(1)}h&nbsp;up
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: '#94A3B8' }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '9px 14px', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>
                        <Badge value={avgVal} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
