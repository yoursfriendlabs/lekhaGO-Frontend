import wordmark from '../assets/branding/pasalmanager-wordmark.png';
import mark from '../assets/branding/pasalmanager-mark.png';

export default function BrandLogo({ className = '', alt = 'PasalManager', variant = 'wordmark' }) {
  const src = variant === 'mark' ? mark : wordmark;
  return (
    <span className={`inline-flex items-center ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        className="block h-full w-auto max-w-full object-contain"
        decoding="async"
      />
    </span>
  );
}
