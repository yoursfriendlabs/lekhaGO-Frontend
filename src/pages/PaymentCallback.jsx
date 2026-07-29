import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';

export default function PaymentCallback() {
  const { provider, status } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { updateSubscription } = useAuth();

  const [verifyState, setVerifyState] = useState('verifying'); // verifying | success | failed
  const [errorMessage, setErrorMessage] = useState('');
  const [txCode, setTxCode] = useState('');
  const verificationInitiated = useRef(false);

  const performVerification = async () => {
    setVerifyState('verifying');
    setErrorMessage('');

    try {
      if (status === 'failure') {
        throw new Error(t('payment.errors.cancelled') || 'Payment was cancelled or failed at checkout.');
      }

      let payload = {};
      if (provider === 'esewa') {
        const data = searchParams.get('data');
        if (!data) {
          throw new Error(t('payment.errors.missingData') || 'Verification payload from eSewa is missing.');
        }
        payload = { provider: 'esewa', data };
      } else if (provider === 'khalti') {
        const pidx = searchParams.get('pidx');
        if (!pidx) {
          throw new Error(t('payment.errors.missingPidx') || 'Verification transaction ID (pidx) from Khalti is missing.');
        }
        payload = { provider: 'khalti', pidx };
      } else {
        throw new Error(t('payment.errors.invalidProvider') || 'Unsupported payment provider.');
      }

      // 1. Call Backend to Verify Payment
      const verifyResponse = await api.verifySubscriptionPayment(payload);
      setTxCode(verifyResponse?.transactionCode || '');

      // 2. Fetch the fresh Subscription to sync state
      const freshSubscription = await api.getSubscription();
      updateSubscription(freshSubscription);

      setVerifyState('success');
    } catch (error) {
      console.error('Payment verification failed:', error);
      setVerifyState('failed');
      setErrorMessage(error.message || t('auth.errors.generic'));
    }
  };

  useEffect(() => {
    if (verificationInitiated.current) return;
    verificationInitiated.current = true;
    performVerification();
  }, [provider, status, searchParams]);

  const providerLabel = provider === 'esewa' ? 'eSewa' : provider === 'khalti' ? 'Khalti' : provider;
  const brandColorClass = provider === 'esewa' ? 'text-emerald-600' : provider === 'khalti' ? 'text-violet-700' : 'text-primary';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 text-center">
        
        {verifyState === 'verifying' && (
          <div className="space-y-6 py-6">
            <div className="flex justify-center">
              <Loader2 className={`h-16 w-16 animate-spin ${brandColorClass}`} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                Verifying Payment
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Confirming transaction status with {providerLabel}. Please do not refresh the page or go back.
              </p>
            </div>
          </div>
        )}

        {verifyState === 'success' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-16 w-16 text-emerald-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                Payment Successful!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Your subscription has been activated successfully via {providerLabel}.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/40 text-left text-sm space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Plan Activated</span>
                <span className="font-semibold text-slate-950 dark:text-white flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Growth Plan
                </span>
              </div>
              {txCode && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID</span>
                  <span className="font-mono font-semibold text-slate-850 dark:text-slate-200">{txCode}</span>
                </div>
              )}
            </div>

            <div className="grid gap-3 pt-4">
              <Link to="/" className="btn-primary w-full justify-center py-3 text-base">
                Go to Dashboard
              </Link>
              <Link to="/app/settings?tab=subscription" className="btn-secondary w-full justify-center py-3 text-base">
                View Subscription
              </Link>
            </div>
          </div>
        )}

        {verifyState === 'failed' && (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-rose-50 p-4 dark:bg-rose-950/30">
                <XCircle className="h-16 w-16 text-rose-600" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                Payment Verification Failed
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                We could not complete your upgrade request with {providerLabel}.
              </p>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-left text-sm text-rose-800 dark:border-rose-900/30 dark:bg-rose-950/10 dark:text-rose-300">
              <p className="font-semibold">Reason:</p>
              <p className="mt-1 leading-relaxed">{errorMessage}</p>
            </div>

            <div className="grid gap-3 pt-4">
              <button 
                type="button" 
                onClick={performVerification}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                Retry Verification
              </button>
              <Link to="/app/settings?tab=subscription" className="btn-secondary w-full justify-center py-3 text-base">
                Back to Subscription Settings
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
