export default function TopPerformers({ performers }) {
  if (!performers || performers.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>🏆</div>
        <p className="muted">No sites achieved 100% availability across all periods.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 16 }}>
        <span className="count-badge">
          {performers.length} site{performers.length !== 1 ? 's' : ''} with 100% availability across all periods
        </span>
      </div>
      <div className="performers-grid">
        {performers.map((name) => (
          <div key={name} className="performer-chip">
            <span className="performer-dot" />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
