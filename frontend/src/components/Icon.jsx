const Icon = ({ name, className = '', fill = 0, weight = 300, style = undefined }) => (
  <span
    aria-hidden="true"
    className={`material-symbols-outlined leading-none select-none ${className}`}
    style={{ fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`, ...style }}
  >
    {name}
  </span>
);

export default Icon;
