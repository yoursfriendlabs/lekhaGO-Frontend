import { Component } from 'react';
import {
  canAutoRecoverChunkError,
  clearAppRuntime,
  isChunkOrCacheError,
  recoverFromChunkError,
  reloadApp,
} from '../lib/appRecovery.js';

function didResetKeysChange(prevKeys = [], nextKeys = []) {
  if (prevKeys.length !== nextKeys.length) return true;

  for (let index = 0; index < prevKeys.length; index += 1) {
    if (!Object.is(prevKeys[index], nextKeys[index])) {
      return true;
    }
  }

  return false;
}

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

  componentDidUpdate(prevProps) {
    if (!this.state.error) return;

    const previousKeys = Array.isArray(prevProps.resetKeys) ? prevProps.resetKeys : [];
    const nextKeys = Array.isArray(this.props.resetKeys) ? this.props.resetKeys : [];

    if (didResetKeysChange(previousKeys, nextKeys)) {
      this.resetBoundary();
    }
  }

  resetBoundary = () => {
    this.setState({ error: null, isRecovering: false });
    this.props.onReset?.();
  };

  handleRetry = () => {
    this.resetBoundary();
  };

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
    const { scope = 'app' } = this.props;

    if (!error) {
      return this.props.children;
    }

    const isPageScope = scope === 'page';

    if (isRecovering) {
      return (
        <div className={`${isPageScope ? 'rounded-[28px] border border-primary-100 bg-white px-6 py-8 shadow-sm dark:border-primary-900/40 dark:bg-slate-950' : 'flex min-h-screen items-center justify-center bg-mist px-6 py-12 text-ink'}`}>
          <div className={`${isPageScope ? '' : 'w-full max-w-lg rounded-3xl border border-primary-100 bg-white p-8 shadow-sm'} ${isPageScope ? 'text-ink' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">Refreshing PasalManager</p>
            <h1 className={`mt-3 font-serif text-slate-900 ${isPageScope ? 'text-2xl' : 'text-3xl'}`}>Loading the latest version.</h1>
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
    const eyebrow = showHardReset ? 'Quick refresh needed' : isPageScope ? 'Screen issue' : 'We hit a snag';
    const title = showHardReset
      ? 'PasalManager needs a quick refresh.'
      : isPageScope
        ? 'This screen ran into a problem.'
        : 'We could not open this screen.';
    const description = showHardReset
      ? 'A new app version is available. Refresh once to continue working with the latest files.'
      : isPageScope
        ? 'You can try this screen again without leaving the app. If it keeps failing, refresh once to start fresh.'
        : 'Please refresh the app to continue. If this keeps happening, let us know what you were doing before this screen appeared.';
    const reassurance = showHardReset
      ? 'Your saved business data is safe. This only affects the app files stored in the browser.'
      : isPageScope
        ? 'Your current workspace session is still available.'
        : 'Refreshing usually fixes temporary loading problems.';

    return (
      <div className={`${isPageScope ? 'rounded-[28px] border border-secondary-200 bg-white px-6 py-8 shadow-sm dark:border-slate-800/70 dark:bg-slate-950' : 'flex min-h-screen items-center justify-center bg-mist px-6 py-12 text-ink'}`}>
        <div className={`${isPageScope ? '' : 'w-full max-w-lg rounded-3xl border border-secondary-200 bg-white p-8 shadow-sm'}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">{eyebrow}</p>
          <h1 className={`mt-3 font-serif text-slate-900 ${isPageScope ? 'text-2xl' : 'text-3xl'}`}>{title}</h1>
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
            {isPageScope && !showHardReset ? (
              <button className="btn-primary" type="button" onClick={this.handleRetry}>
                Try this screen again
              </button>
            ) : (
              <button className="btn-primary" type="button" onClick={this.handleReload}>
                Refresh now
              </button>
            )}
            {isPageScope && !showHardReset ? (
              <button className="btn-secondary" type="button" onClick={this.handleReload}>
                Refresh app
              </button>
            ) : null}
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
