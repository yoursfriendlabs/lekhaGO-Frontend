import wordmarkDark from '../assets/branding/pasalmanager-wordmark-dark.svg';
import wordmarkLight from '../assets/branding/pasalmanager-wordmark-light.svg';

export default function BrandLogo({ className = '', alt = 'PasalManager' }) {
  return (
    <span className={`inline-flex items-center ${className}`.trim()}>
      <img
        src={wordmarkLight}
        alt={alt}
        className="block h-full w-auto max-w-full object-contain dark:hidden"
        decoding="async"
      />
      <img
        src={wordmarkDark}
        alt={alt}
        className="hidden h-full w-auto max-w-full object-contain dark:block"
        decoding="async"
      />
    </span>
  );
}
