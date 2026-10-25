/**
 * The one page header used by every app screen.
 *
 * Mirrors the dashboard intro band: a dotted eyebrow, a large display
 * headline with an optional accent phrase, supporting copy and actions.
 * Pages pass real content; this component owns only presentation.
 */
export default function PageHeader({
  eyebrow = undefined,
  title,
  description = undefined,
  actions = undefined,
  children = undefined,
  className = '',
}) {
  return (
    <header className={`app-page-head ${className}`.trim()}>
      <div className="app-page-head-copy">
        {eyebrow && <span className="app-eyebrow">{eyebrow}</span>}
        <h1 className="app-page-title">{title}</h1>
        {description && <p className="app-page-sub">{description}</p>}
        {children}
      </div>
      {actions && <div className="app-page-actions">{actions}</div>}
    </header>
  );
}
