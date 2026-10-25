import { Component } from 'react';

// never blanks the whole PWA shell. Use at App + route level.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '', isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const msg = error?.message || 'Something went wrong.';
    // Lazy-chunk failures (new deploy, stale PWA) can't be fixed by state reset.
    const isChunkError =
      /dynamically imported module|chunk|Loading chunk/i.test(msg);
    return { hasError: true, message: msg, isChunkError };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    }
  }

  handleRetry = () => {
    // Stale lazy chunk (new deploy) needs a hard reload, not a state reset.
    if (this.state.isChunkError) {
      try { window.location.reload(); } catch { /* noop */ }
      return;
    }
    this.setState({ hasError: false, message: '', isChunkError: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div role="alert" className="min-h-[40dvh] flex flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="material-symbols-outlined text-[length:var(--fs-36)] text-[var(--text-muted)]">error</span>
          <p className="text-sm font-bold text-[var(--text-primary)]">Something went wrong</p>
          <p className="text-xs text-[var(--text-muted)] max-w-[36ch]">{this.state.message}</p>
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--text-inverse)] text-xs font-black uppercase tracking-widest"
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/dashboard')}
              className="px-4 py-2 rounded-xl border border-[var(--border-light)] text-xs font-bold text-[var(--text-secondary)]"
            >
              Go home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
