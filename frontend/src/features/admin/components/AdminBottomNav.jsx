import { NavLink } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';

/**
 * Phone navigation for the console. Mirrors the member app's floating bottom
 * bar while keeping the five real admin destinations and their permission
 * boundaries untouched.
 */
export default function AdminBottomNav({ items }) {
  return (
    <nav className="adm-bottomnav" aria-label="Admin sections">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          aria-label={item.label}
          className={({ isActive }) => `adm-bottomnav__item${isActive ? ' is-active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <Icon name={item.icon} fill={isActive ? 1 : 0} />
              <span className="adm-bottomnav__label">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
