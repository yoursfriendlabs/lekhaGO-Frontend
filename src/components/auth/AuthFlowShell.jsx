import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthFlowShell({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  badge,
  backTo = '/login',
  backLabel,
  asideTitle,
  asideDescription,
  tips = [],
  children,
  footer,
}) {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-secondary-200/80 bg-surface/90 shadow-soft backdrop-blur">
        <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-primary/10 via-primary-50 to-surface p-8">
            {Icon ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
                <Icon size={28} />
              </div>
            ) : null}
            {eyebrow ? (
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-3 font-serif text-4xl leading-tight text-ink">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-4 text-sm leading-6 text-secondary-600">
                {subtitle}
              </p>
            ) : null}
            {badge ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-surface/80 px-4 py-2 text-sm font-medium text-ink-light shadow-sm">
                {badge}
              </div>
            ) : null}
            {(asideTitle || asideDescription || tips.length > 0) ? (
              <div className="mt-8 rounded-3xl border border-secondary-200/80 bg-surface/75 p-5">
                {asideTitle ? (
                  <p className="text-sm font-semibold text-ink">
                    {asideTitle}
                  </p>
                ) : null}
                {asideDescription ? (
                  <p className="mt-2 text-sm leading-6 text-secondary-600">
                    {asideDescription}
                  </p>
                ) : null}
                {tips.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-secondary-600">
                    {tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="p-8 md:p-10">
            <div className="flex items-center gap-2 text-sm text-secondary-500">
              <ArrowLeft size={16} />
              <Link className="hover:text-primary" to={backTo}>
                {backLabel}
              </Link>
            </div>

            <div className="mt-8 space-y-6">
              {children}
            </div>

            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
