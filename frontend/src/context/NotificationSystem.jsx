import { useToastStore } from '../stores/toastStore.js';
import Icon from '../components/Icon.jsx';
import './NotificationSystem.css';

// Toast renderer — canonical store is stores/toastStore.js.
// NotificationProvider mounts the ToastContainer once (in AppProviders) so
// every `useToastStore().addToast()` has visible UI.

const ICONS = {
  success: 'check',
  error: 'priority_high',
  info: 'info',
};

function Toast({ id, variant = 'info', message, title, description, duration, onClose }) {
  return (
    <div className={`v-toast is-${variant}`} role="status" aria-live="polite">
      <span className="v-toast-icon" aria-hidden="true">
        <Icon name={ICONS[variant] || ICONS.info} />
      </span>

      <div className="v-toast-body">
        <span className="v-toast-eyebrow">
          {variant === 'success' ? 'Confirmed' : variant === 'error' ? 'Action needed' : 'Vitalis'}
        </span>
        <p className="v-toast-title">{title || message}</p>
        {description ? <p className="v-toast-description">{description}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => onClose(id)}
        aria-label="Dismiss notification"
        className="v-toast-close"
      >
        <Icon name="close" />
      </button>

      {duration ? (
        <span
          id={`v-toast-progress-${id}`}
          className="v-toast-progress"
          style={{ animationDuration: `${duration}ms` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function ToastContainer({ toasts, onClose }) {
  return (
    <div className="v-toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}

export function NotificationProvider({ children }) {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
}
