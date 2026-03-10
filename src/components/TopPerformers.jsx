import { Trophy, Award } from 'lucide-react';

export default function TopPerformers({ performers }) {
  if (!performers || performers.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <Trophy size={32} style={{ color: '#64748B', marginBottom: 10 }} />
        <p className="muted">No clients achieved 100% availability across all periods.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Trophy size={18} style={{ color: '#FCD34D' }} />
        <span className="count-badge">
          {performers.length} client{performers.length !== 1 ? 's' : ''} with 100% availability across all periods
        </span>
      </div>
      <div className="performers-grid">
        {performers.map((name) => (
          <div key={name} className="performer-chip">
            <Award size={13} style={{ color: '#FCD34D', flexShrink: 0 }} />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
