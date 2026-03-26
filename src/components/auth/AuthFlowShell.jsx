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
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85">
        <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-primary/10 via-amber-50 to-white p-8 dark:from-primary/15 dark:via-slate-900 dark:to-slate-950">
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
            <h1 className="mt-3 font-serif text-4xl leading-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {subtitle}
              </p>
            ) : null}
            {badge ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-primary/30 dark:bg-slate-900/70 dark:text-slate-200">
                {badge}
              </div>
            ) : null}
            {(asideTitle || asideDescription || tips.length > 0) ? (
              <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white/75 p-5 dark:border-slate-800/70 dark:bg-slate-900/70">
                {asideTitle ? (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {asideTitle}
                  </p>
                ) : null}
                {asideDescription ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {asideDescription}
                  </p>
                ) : null}
                {tips.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="p-8 md:p-10">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
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
