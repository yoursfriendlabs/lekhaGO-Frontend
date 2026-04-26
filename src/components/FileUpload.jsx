import { useEffect, useMemo, useState } from 'react';
import { api, API_BASE } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';

const EMPTY_URLS = [];
const IMAGE_FILE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)$/i;

function toAbsoluteUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url}`;
}

function normalizeUrls(...values) {
  const next = [];
  const seen = new Set();

  const addValue = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }

    const normalized = String(value).trim();
    if (!normalized || seen.has(normalized)) return;

    seen.add(normalized);
    next.push(normalized);
  };

  values.forEach(addValue);
  return next;
}

function isPdfUrl(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url || ''));
}

function isImageFile(file) {
  if (!file) return false;

  const mimeType = String(file.type || '').toLowerCase();
  if (mimeType.startsWith('image/')) return true;

  return IMAGE_FILE_EXTENSION_PATTERN.test(String(file.name || ''));
}

function areUrlListsEqual(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export default function FileUpload({
  onUpload,
  initialUrl = '',
  initialUrls = EMPTY_URLS,
  label,
  multiple = false,
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const normalizedInitialUrls = useMemo(
    () => normalizeUrls(multiple ? initialUrls : initialUrl),
    [initialUrl, initialUrls, multiple]
  );
  const normalizedInitialUrlsSignature = normalizedInitialUrls.join('|');
  const [uploadedUrls, setUploadedUrls] = useState(() => normalizedInitialUrls);

  useEffect(() => {
    setUploadedUrls((previous) => (
      areUrlListsEqual(previous, normalizedInitialUrls) ? previous : normalizedInitialUrls
    ));
  }, [normalizedInitialUrlsSignature]);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError('');

    if (files.some((file) => !isImageFile(file))) {
      setError(t('common.imageOnlyUploadError') || 'Only image files can be uploaded.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      if (multiple) {
        const response = await api.uploadAttachments(files);
        const nextUrls = normalizeUrls(uploadedUrls, response?.urls || []);
        setUploadedUrls(nextUrls);
        onUpload(nextUrls);
      } else {
        const { url } = await api.uploadAttachment(files[0]);
        const nextUrls = normalizeUrls(url);
        setUploadedUrls(nextUrls);
        onUpload(nextUrls[0] || '');
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      e.target.value = '';
      setUploading(false);
    }
  };

  const handleRemove = (urlToRemove) => {
    const nextUrls = uploadedUrls.filter((url) => url !== urlToRemove);
    setUploadedUrls(nextUrls);
    onUpload(multiple ? nextUrls : nextUrls[0] || '');
  };

  const previewUrls = uploadedUrls.map((url) => toAbsoluteUrl(url));

  if (multiple) {
    return (
      <div className="space-y-3">
        {label && <label className="label">{label}</label>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {previewUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white"
                onClick={() => handleRemove(uploadedUrls[index])}
              >
                {t('common.remove')}
              </button>
              <div className="flex h-28 items-center justify-center">
                {isPdfUrl(url) ? (
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                    PDF
                  </div>
                ) : (
                  <img src={url} alt={`Attachment ${index + 1}`} className="h-full w-full object-cover" />
                )}
              </div>
            </div>
          ))}

          <label className="relative flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center transition hover:border-primary-300 hover:bg-primary-50/40 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-primary-700">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {uploading ? t('common.loading') : t('common.add')}
            </span>
            <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {uploading ? (t('common.uploading') || 'Uploading...') : (t('common.uploadHint') || 'Tap to upload image')}
            </span>
            <input
              type="file"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleFileChange}
              accept="image/*"
              disabled={uploading}
              multiple
              aria-label={label || 'Upload files'}
            />
          </label>
        </div>
        {error ? <p className="text-xs text-red-500">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <div className="h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 flex items-center justify-center">
            {previewUrls[0] ? (
              isPdfUrl(previewUrls[0]) ? (
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                  PDF
                </div>
              ) : (
                <img src={previewUrls[0]} alt="Preview" className="h-full w-full object-cover" />
              )
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
            accept="image/*"
            disabled={uploading}
            aria-label={label || 'Upload file'}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {uploading ? t('common.uploading') || 'Uploading...' : t('common.uploadHint') || 'Tap to upload image'}
          </p>
          {previewUrls[0] ? (
            <button type="button" className="mt-2 text-xs font-medium text-primary-700 hover:text-primary-600" onClick={() => handleRemove(uploadedUrls[0])}>
              {t('common.remove')}
            </button>
          ) : null}
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}
