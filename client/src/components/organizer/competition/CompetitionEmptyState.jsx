export function CompetitionEmptyState({
  title = 'No competition items found',
  description = 'There is no data to display for this section.',
  actionLabel = '',
  onAction = null,
}) {
  return (
    <div className="comp-empty-state">
      <h3 className="comp-empty-state-title">{title}</h3>
      <p className="comp-empty-state-desc">{description}</p>
      {actionLabel && onAction && (
        <button className="button primary-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
