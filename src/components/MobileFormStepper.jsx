export default function MobileFormStepper({
  steps = [],
  currentStep,
  onStepChange,
  onNext,
  onBack,
  canProceed = true,
  nextLabel = 'Continue',
  backLabel = 'Back',
  showNavigation = true,
}) {
  const currentIndex = Math.max(steps.findIndex((step) => step.id === currentStep), 0);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;
  const progress = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 100;

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800/70 dark:bg-slate-950/60 dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Step {currentIndex + 1} of {steps.length}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {steps[currentIndex]?.label}
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          {Math.round(progress)}%
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        className="mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              aria-current={isActive ? 'step' : undefined}
              className={`min-w-0 rounded-2xl border px-2.5 py-2 text-left transition ${
                isActive
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : isPast
                    ? 'border-primary-100 bg-primary-50 text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/20 dark:text-primary-200'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                isActive
                  ? 'bg-white/20 text-white'
                  : isPast
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-700'
              }`}>
                {index + 1}
              </span>
              <span className="mt-1 block truncate text-xs font-semibold">{step.label}</span>
            </button>
          );
        })}
      </div>

      {showNavigation ? (
        <div className="mt-4 flex gap-2 border-t border-slate-200/70 pt-3">
          {!isFirstStep && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {backLabel}
            </button>
          )}
          {!isLastStep && (
            <button
              type="button"
              onClick={onNext}
              disabled={!canProceed}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                canProceed
                  ? 'bg-primary text-white hover:bg-primary-600'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {nextLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
