import { describe, expect, it } from 'vitest';
import {
  AUTO_RECOVERY_ATTEMPT_KEY,
  AUTO_RECOVERY_COOLDOWN_MS,
  canAutoRecoverChunkError,
  isChunkOrCacheError,
} from './appRecovery.js';

describe('appRecovery', () => {
  it('detects stale chunk and module fetch failures', () => {
    expect(isChunkOrCacheError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkOrCacheError(new Error('Loading chunk 19 failed'))).toBe(true);
    expect(isChunkOrCacheError(new Error('Regular form validation failed'))).toBe(false);
  });

  it('blocks repeated recovery attempts during the cooldown window', () => {
    window.sessionStorage.setItem(AUTO_RECOVERY_ATTEMPT_KEY, String(Date.now()));

    expect(canAutoRecoverChunkError()).toBe(false);
  });

  it('allows recovery again after the cooldown expires', () => {
    const now = Date.now();
    window.sessionStorage.setItem(
      AUTO_RECOVERY_ATTEMPT_KEY,
      String(now - AUTO_RECOVERY_COOLDOWN_MS - 1000)
    );

    expect(canAutoRecoverChunkError(now)).toBe(true);
  });
});
