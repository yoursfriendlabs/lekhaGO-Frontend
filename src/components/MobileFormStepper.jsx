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

  return (
    <div className="bg-white px-3 py-3 dark:bg-slate-950 border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-1.5">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <div key={step.id} className="flex flex-1 items-center gap-1.5 last:flex-none">
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                className="flex flex-col items-center group"
                aria-current={isActive ? 'step' : undefined}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/20 ring-2 ring-primary/10'
                      : isPast
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  }`}
                >
                  {isPast ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`mt-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                    isActive
                      ? 'text-primary dark:text-primary-400'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {index < steps.length - 1 ? (
                <div className="mb-3.5 h-[1.5px] flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: isPast ? '100%' : '0%' }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showNavigation ? (
        <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          {!isFirstStep && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {backLabel}
            </button>
          )}
          {!isLastStep && (
            <button
              type="button"
              onClick={onNext}
              disabled={!canProceed}
              className={`flex-1 rounded-md px-3 py-2.5 text-sm font-semibold transition active:scale-95 ${
                canProceed
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
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
