import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { buildSettingsTabPath, SUBSCRIPTION_SETTINGS_TAB } from '../lib/settingsTabs';
import {
  buildEsewaVerifyPayload,
  buildKhaltiVerifyPayload,
  getPaymentProviderLabel,
} from '../lib/subscriptionPayments';

function getVerifyPayload(provider, searchParams) {
  if (provider === 'esewa') {
    return buildEsewaVerifyPayload(searchParams);
  }

  return buildKhaltiVerifyPayload(searchParams);
}

export default function PaymentCallback({ provider, outcome = 'return' }) {
  const { t } = useI18n();
  const { token, businessId, updateSubscription } = useAuth();
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const providerLabel = getPaymentProviderLabel(provider);
  const payload = useMemo(
    () => getVerifyPayload(provider, searchParams),
    [provider, searchParams]
  );

  useEffect(() => {
    let active = true;

    async function verifyPayment() {
      if (!token || !businessId) {
        setError(t('paymentCallback.missingSession'));
        setVerifying(false);
        return;
      }

      if (!payload) {
        setError(t('paymentCallback.missingParams', { provider: providerLabel }));
        setVerifying(false);
        return;
      }

      try {
        const verifyResponse = await api.verifyPayment(payload);
        if (!active) return;

        setResult(verifyResponse);

        if (verifyResponse?.success) {
          try {
            const subscriptionResponse = await api.getSubscription();
            if (!active) return;
            updateSubscription(subscriptionResponse);
          } catch {
            // Verification succeeded, so keep the success UI even if the refresh misses.
          }
        }
      } catch (verifyError) {
        if (!active) return;
        setResult(verifyError?.payload || null);
        setError(verifyError.message || t('auth.errors.generic'));
      } finally {
        if (!active) return;
        setVerifying(false);
      }
    }

    verifyPayment();

    return () => {
      active = false;
    };
  }, [businessId, payload, providerLabel, t, token, updateSubscription]);

  const isSuccess = result?.success === true;
  const hasResult = Boolean(result);
  const title = verifying
    ? t('paymentCallback.verifyingTitle', { provider: providerLabel })
    : isSuccess
      ? t('paymentCallback.successTitle', { provider: providerLabel })
      : outcome === 'failure'
        ? t('paymentCallback.failureTitle', { provider: providerLabel })
        : t('paymentCallback.returnTitle', { provider: providerLabel });
  const subtitle = verifying
    ? t('paymentCallback.verifyingSubtitle')
    : isSuccess
      ? t('paymentCallback.successSubtitle')
      : t('paymentCallback.failureSubtitle');
  const noticeTitle = result?.status || (verifying
    ? t('paymentCallback.verifyingStatus')
    : isSuccess
      ? t('paymentCallback.verifiedStatus')
      : t('paymentCallback.failedStatus'));
  const noticeDescription = result?.message || error || t('paymentCallback.genericFailure');
  const noticeTone = verifying
    ? 'info'
    : isSuccess
      ? 'success'
      : 'error';

  return (
    <div className="min-h-screen gradient-bg bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title={title} subtitle={subtitle} />

        <div className="card space-y-5">
          <Notice title={noticeTitle} description={noticeDescription} tone={noticeTone} />

          {verifying ? (
            <div className="flex items-center gap-3 py-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              {t('paymentCallback.verifyingSpinner')}
            </div>
          ) : null}

          {!verifying ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t('paymentCallback.providerLabel')}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {providerLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t('paymentCallback.statusLabel')}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {result?.status || t('paymentCallback.statusUnavailable')}
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="btn-primary justify-center" to={token ? buildSettingsTabPath(SUBSCRIPTION_SETTINGS_TAB) : '/login'}>
              {token ? t('paymentCallback.backToSubscription') : t('paymentCallback.backToLogin')}
            </Link>
            <Link className="btn-secondary justify-center" to={token ? '/app' : '/'}>
              {t('paymentCallback.backToApp')}
            </Link>
          </div>

          {!hasResult && !verifying && error ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('paymentCallback.retryHint')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
