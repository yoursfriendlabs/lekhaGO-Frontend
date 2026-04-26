import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appRecoveryMocks = vi.hoisted(() => ({
  canAutoRecoverChunkError: vi.fn(),
  clearAppRuntime: vi.fn(),
  recoverFromChunkError: vi.fn(),
  reloadApp: vi.fn(),
}));

vi.mock('../lib/appRecovery.js', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    ...appRecoveryMocks,
  };
});

import AppErrorBoundary from './AppErrorBoundary.jsx';

function ChunkErrorThrower() {
  throw new Error('Failed to fetch dynamically imported module: https://app.example.com/assets/Inventory.123.js');
}

function GenericErrorThrower() {
  throw new Error('Unexpected payment reconciliation failure');
}

function HealthyScreen() {
  return <div>Recovered screen</div>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    appRecoveryMocks.canAutoRecoverChunkError.mockReset();
    appRecoveryMocks.clearAppRuntime.mockReset();
    appRecoveryMocks.recoverFromChunkError.mockReset();
    appRecoveryMocks.reloadApp.mockReset();

    appRecoveryMocks.canAutoRecoverChunkError.mockReturnValue(true);
    appRecoveryMocks.clearAppRuntime.mockResolvedValue(undefined);
    appRecoveryMocks.recoverFromChunkError.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-recovers from stale chunk errors before showing the raw failure', async () => {
    render(
      <AppErrorBoundary>
        <ChunkErrorThrower />
      </AppErrorBoundary>
    );

    expect(await screen.findByText(/Loading the latest version\./i)).toBeInTheDocument();

    await waitFor(() => {
      expect(appRecoveryMocks.canAutoRecoverChunkError).toHaveBeenCalledTimes(1);
      expect(appRecoveryMocks.recoverFromChunkError).toHaveBeenCalledTimes(1);
    });
  });

  it('shows a friendly fallback when auto-recovery is not available', async () => {
    appRecoveryMocks.canAutoRecoverChunkError.mockReturnValue(false);

    render(
      <AppErrorBoundary>
        <ChunkErrorThrower />
      </AppErrorBoundary>
    );

    expect(await screen.findByText(/PasalManager needs a quick refresh\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset app and refresh/i })).toBeInTheDocument();
    expect(screen.getByText(/Show technical details/i)).toBeInTheDocument();
    expect(appRecoveryMocks.recoverFromChunkError).not.toHaveBeenCalled();
  });

  it('shows calm, plain-language guidance for non-chunk failures', async () => {
    render(
      <AppErrorBoundary>
        <GenericErrorThrower />
      </AppErrorBoundary>
    );

    expect(await screen.findByText(/We could not open this screen\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh now/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reset app and refresh/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Show technical details/i)).toBeInTheDocument();
    expect(appRecoveryMocks.recoverFromChunkError).not.toHaveBeenCalled();
  });

  it('shows a contained retry UI for page-scoped failures', async () => {
    render(
      <AppErrorBoundary scope="page">
        <GenericErrorThrower />
      </AppErrorBoundary>
    );

    expect(await screen.findByText(/This screen ran into a problem\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try this screen again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh app/i })).toBeInTheDocument();
  });

  it('resets the boundary when route reset keys change', async () => {
    const { rerender } = render(
      <AppErrorBoundary scope="page" resetKeys={['/app/sales']}>
        <GenericErrorThrower />
      </AppErrorBoundary>
    );

    expect(await screen.findByText(/This screen ran into a problem\./i)).toBeInTheDocument();

    rerender(
      <AppErrorBoundary scope="page" resetKeys={['/app/services']}>
        <HealthyScreen />
      </AppErrorBoundary>
    );

    expect(await screen.findByText(/Recovered screen/i)).toBeInTheDocument();
  });
});
