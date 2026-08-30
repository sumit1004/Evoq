export function CompetitionViewTabs({
  activeView = 'groups',
  onSelectView,
  groupCount = 0,
  matchCount = 0,
  qualifiedCount = 0,
  isScout = false,
  permissions = new Set(),
}) {
  const views = [
    { id: 'groups', label: 'Groups', count: groupCount },
    { id: 'matches', label: 'Matches', count: matchCount },
    { id: 'standings', label: 'Standings' },
    {
      id: 'qualification',
      label: 'Qualification',
      count: qualifiedCount > 0 ? `${qualifiedCount} Qualified` : null,
      locked: isScout && !permissions.has('MANAGE_QUALIFICATIONS') && !permissions.has('VIEW_ROUNDS'),
    },
  ];

  return (
    <div className="comp-view-nav-wrapper">
      <nav className="comp-view-nav" role="tablist" aria-label="Round sub-views">
        {views.map((v) => {
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              role="tab"
              aria-selected={isActive}
              className={`comp-view-tab ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(v.id)}
              type="button"
            >
              <span>{v.label}</span>
              {v.count !== undefined && v.count !== null && (
                <span className="comp-view-pill">{v.count}</span>
              )}
              {v.locked && <span style={{ fontSize: '11px', color: '#8b949e' }}>🔒</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
