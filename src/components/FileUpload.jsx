import { useEffect, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';

function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

export default function FileUpload({ onUpload, initialUrl = '', label }) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(initialUrl);

  useEffect(() => {
    setPreview(toAbsoluteUrl(initialUrl));
  }, [initialUrl]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const { url } = await api.uploadAttachment(file);
      setPreview(toAbsoluteUrl(url));
      onUpload(url);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
          <input
            type="file"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={handleFileChange}
            accept="image/*,.pdf"
            disabled={uploading}
            aria-label={label || 'Upload file'}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {uploading ? t('common.uploading') || 'Uploading...' : t('common.uploadHint') || 'Tap to upload image or document'}
          </p>
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
