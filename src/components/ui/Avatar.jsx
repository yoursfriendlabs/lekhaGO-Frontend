import { toInitials } from '../../lib/money/formatting';

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-12 w-12 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export default function Avatar({
  src,
  name = '',
  alt,
  size = 'md',
  className = '',
  fallbackClassName = 'bg-slate-400 text-white',
}) {
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;
  const sharedClassName = `shrink-0 overflow-hidden rounded-xl ${sizeClass} ${className}`;
  const photoUrl = String(src || '').trim();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={alt || name || ''}
        className={`${sharedClassName} object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center font-semibold ${sharedClassName} ${fallbackClassName}`}
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
    >
      {String(name || '').trim() ? toInitials(name) : '?'}
    </div>
  );
}
