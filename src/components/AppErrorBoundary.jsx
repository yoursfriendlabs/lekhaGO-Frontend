import { Component } from 'react';
import {
  canAutoRecoverChunkError,
  clearAppRuntime,
  isChunkOrCacheError,
  recoverFromChunkError,
  reloadApp,
} from '../lib/appRecovery.js';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, isRecovering: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AppErrorBoundary', error, errorInfo);

    if (isChunkOrCacheError(error) && canAutoRecoverChunkError()) {
      this.setState({ isRecovering: true });
      void recoverFromChunkError();
    }
  }

  handleReload = () => {
    reloadApp();
  };

  handleHardReset = async () => {
    this.setState({ isRecovering: true });

    try {
      await clearAppRuntime();
    } finally {
      reloadApp();
    }
  };

  render() {
    const { error, isRecovering } = this.state;

    if (!error) {
      return this.props.children;
    }

    if (isRecovering) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-12 text-ink">
          <div className="w-full max-w-lg rounded-3xl border border-primary-100 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">Refreshing PasalManager</p>
            <h1 className="mt-3 font-serif text-3xl text-slate-900">Loading the latest version.</h1>
            <p className="mt-3 text-sm text-slate-600">
              We&apos;re refreshing the app so your workspace opens on the newest release. Your saved business data is safe.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" type="button" onClick={this.handleReload}>
                Refresh now
              </button>
            </div>
          </div>
        </div>
      );
    }

    const showHardReset = isChunkOrCacheError(error);
    const eyebrow = showHardReset ? 'Quick refresh needed' : 'We hit a snag';
    const title = showHardReset ? 'PasalManager needs a quick refresh.' : 'We could not open this screen.';
    const description = showHardReset
      ? 'A new app version is available. Refresh once to continue working with the latest files.'
      : 'Please refresh the app to continue. If this keeps happening, let us know what you were doing before this screen appeared.';
    const reassurance = showHardReset
      ? 'Your saved business data is safe. This only affects the app files stored in the browser.'
      : 'Refreshing usually fixes temporary loading problems.';

    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-12 text-ink">
        <div className="w-full max-w-lg rounded-3xl border border-secondary-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-3xl text-slate-900">{title}</h1>
          <p className="mt-3 text-sm text-slate-600">
            {description}
          </p>
          <p className="mt-2 text-sm text-slate-500">{reassurance}</p>
          {error?.message ? (
            <details className="mt-4 rounded-2xl border border-secondary-200 bg-secondary-50/70" open={import.meta.env.DEV}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-secondary-900">
                Show technical details
              </summary>
              <pre className="overflow-x-auto border-t border-secondary-200 px-4 py-3 text-xs text-slate-700">
                {error.message}
              </pre>
            </details>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={this.handleReload}>
              Refresh now
            </button>
            {showHardReset ? (
              <button className="btn-secondary" type="button" onClick={this.handleHardReset}>
                Reset app and refresh
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
