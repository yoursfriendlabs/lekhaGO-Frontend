import { FileText, ChevronLeft, ChevronRight, X } from "lucide-react";
import { isPdfAttachment } from "./serviceOrderUtils.js";

export function AttachmentPreview({ url, onOpen, size = "sm" }) {
  const sizeClass =
    size === "lg" ? "h-24 w-24" : size === "md" ? "h-14 w-14" : "h-9 w-9";

  return (
    <button
      type="button"
      className={`overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-sm transition hover:opacity-80 dark:border-slate-800 dark:bg-slate-900 ${sizeClass}`}
      onClick={() => onOpen(url)}
    >
      {isPdfAttachment(url) ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900/90 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-secondary-100 dark:text-ink">
          <FileText size={14} />
          PDF
        </div>
      ) : (
        <img
          src={url}
          alt="Attachment"
          className="h-full w-full object-cover"
        />
      )}
    </button>
  );
}

export function AttachmentStrip({ urls = [], onOpen, maxVisible = 3, size = "sm" }) {
  if (!urls.length) return null;

  const visibleUrls = urls.slice(0, maxVisible);
  const hiddenCount = urls.length - visibleUrls.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleUrls.map((url, i) => (
        <AttachmentPreview
          key={url}
          url={url}
          onOpen={() => onOpen(urls, i)}
          size={size}
        />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-secondary-100 px-2 text-xs font-semibold text-secondary-700 transition hover:bg-secondary-200 hover:text-ink dark:bg-slate-800 dark:text-secondary-300 dark:hover:bg-slate-700 dark:hover:text-white"
          onClick={() => onOpen(urls, visibleUrls.length)}
          title="Open more attachments"
        >
          +{hiddenCount}
        </button>
      ) : null}
    </div>
  );
}

export function ServiceAttachmentLightbox({
  lightboxState,
  onClose,
  onPrev,
  onNext,
}) {
  if (!lightboxState) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X size={20} />
      </button>

      <button
        type="button"
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        aria-label="Previous"
      >
        <ChevronLeft size={22} />
      </button>

      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        aria-label="Next"
      >
        <ChevronRight size={22} />
      </button>

      {isPdfAttachment(lightboxState.urls[lightboxState.index]) ? (
        <a
          href={lightboxState.urls[lightboxState.index]}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-white px-6 py-4 text-ink font-semibold"
          onClick={(e) => e.stopPropagation()}
        >
          Open PDF in new tab
        </a>
      ) : (
        <img
          src={lightboxState.urls[lightboxState.index]}
          alt="Attachment"
          className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
