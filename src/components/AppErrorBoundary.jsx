import { Component } from 'react';

function isChunkOrCacheError(error) {
  const message = String(error?.message || '').toLowerCase();

  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('loading chunk')
    || message.includes('importing a module script failed')
    || message.includes('a.filter is not a function')
  );
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHardReset = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }
    } catch (error) {
      console.error('AppErrorBoundary hard reset failed', error);
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const showHardReset = isChunkOrCacheError(this.state.error);

    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-12 text-ink">
        <div className="w-full max-w-lg rounded-3xl border border-rose-200/80 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">Application error</p>
          <h1 className="mt-3 font-serif text-3xl text-slate-900">Something unexpected happened.</h1>
          <p className="mt-3 text-sm text-slate-600">
            The app hit an unrecoverable state. Reload to restore the latest working version.
          </p>
          {this.state.error?.message ? (
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs text-slate-100">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={this.handleReload}>
              Reload app
            </button>
            {showHardReset ? (
              <button className="btn-secondary" type="button" onClick={this.handleHardReset}>
                Clear cached app
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
