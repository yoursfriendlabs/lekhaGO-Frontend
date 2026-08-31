import wordmark from '../../assets/branding/pasalmanager-wordmark.png';
import mark from '../../assets/branding/pasalmanager-icon.png';

export default function BrandLogo({ className = '', alt = 'PasalManager', variant = 'wordmark' }) {
  const isMark = variant === 'mark';
  const src = isMark ? mark : wordmark;
  return (
    <span className={`inline-flex items-center ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        className={`block h-full max-w-full object-contain ${isMark ? 'w-full object-center' : 'w-auto object-left'}`}
        decoding="async"
      />
    </span>
  );
}
