import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { Building2, Upload, X, CheckCircle } from 'lucide-react';

const EMPTY = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  panVat: '',
  logoUrl: '',
};

export default function Settings() {
  const { businessId } = useAuth();
  const { settings, saveSettings, reloadSettings } = useBusinessSettings();
  const [form, setForm] = useState({ ...EMPTY, ...settings });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef(null);

  // Sync when businessId changes (user switches business)
  useEffect(() => {
    reloadSettings(businessId);
  }, [businessId, reloadSettings]);

  // Keep local form in sync when settings reload
  useEffect(() => {
    setForm({ ...EMPTY, ...settings });
  }, [settings]);

  const handleChange = (field, value) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP).');
      return;
    }
    setLogoUploading(true);
    setError('');
    try {
      const result = await api.uploadAttachment(file);
      const url = result?.url || result?.path || result?.filePath || '';
      handleChange('logoUrl', url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    setError('');
    saveSettings(form, businessId);
    setSaved(true);
  };

  const logoSrc = form.logoUrl
    ? form.logoUrl.startsWith('http')
      ? form.logoUrl
      : `${API_BASE}${form.logoUrl}`
    : null;

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="Business Settings"
        subtitle="Company details shown on invoices and receipts"
      />

      {error ? <Notice title={error} tone="error" /> : null}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo */}
        <div className="card space-y-4">
          <h2 className="font-serif text-lg text-slate-900 dark:text-white">Company Logo</h2>

          <div className="flex items-start gap-5">
            {/* Preview */}
            <div className="relative h-24 w-24 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 overflow-hidden flex items-center justify-center">
              {logoUploading ? (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              ) : logoSrc ? (
                <>
                  <img
                    src={logoSrc}
                    alt="Company logo"
                    className="h-full w-full object-contain p-1"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-slate-500 hover:text-rose-600 shadow-sm"
                    onClick={() => { handleChange('logoUrl', ''); if (fileRef.current) fileRef.current.value = ''; }}
                    title="Remove logo"
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                <Building2 size={28} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>

            {/* Upload controls */}
            <div className="flex-1 space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Upload your company logo. Recommended: square image, PNG or JPG, at least 200×200 px.
              </p>
              <button
                type="button"
                className="btn-secondary gap-2"
                onClick={() => fileRef.current?.click()}
                disabled={logoUploading}
              >
                <Upload size={15} />
                {logoUploading ? 'Uploading…' : logoSrc ? 'Replace Logo' : 'Upload Logo'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleLogoChange}
              />
            </div>
          </div>
        </div>

        {/* Company details */}
        <div className="card space-y-5">
          <h2 className="font-serif text-lg text-slate-900 dark:text-white">Company Details</h2>

          <div className="space-y-1">
            <label className="label" htmlFor="companyName">Company / Shop Name</label>
            <input
              id="companyName"
              className="input"
              placeholder="e.g. Sharma Electronics"
              value={form.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="label" htmlFor="address">Address</label>
            <textarea
              id="address"
              className="input resize-none"
              rows={3}
              placeholder="Street, City, State / Province"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="label" htmlFor="phone">Phone</label>
              <input
                id="phone"
                className="input"
                type="tel"
                placeholder="+977 98XXXXXXXX"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                placeholder="shop@example.com"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tax info */}
        <div className="card space-y-5">
          <h2 className="font-serif text-lg text-slate-900 dark:text-white">Tax Information</h2>

          <div className="space-y-1">
            <label className="label" htmlFor="panVat">PAN / VAT Number</label>
            <input
              id="panVat"
              className="input"
              placeholder="e.g. 123456789"
              value={form.panVat}
              onChange={(e) => handleChange('panVat', e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              This number will appear on all printed invoices.
            </p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary px-8">
            Save Settings
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              <CheckCircle size={16} /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
