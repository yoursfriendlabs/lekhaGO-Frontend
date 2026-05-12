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
    <div className="bg-white px-1.5 py-1 dark:bg-slate-950">
      <div className="mx-auto flex w-full max-w-[360px] items-start justify-center">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-start last:flex-none">
              <button
                type="button"
                onClick={() => onStepChange(step.id)}
                aria-current={isActive ? 'step' : undefined}
                className="group flex min-w-[52px] flex-col items-center text-center"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold transition ${
                    isActive
                      ? 'border-slate-950 bg-slate-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-950'
                      : isPast
                        ? 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950'
                        : 'border-slate-400 bg-white text-slate-600 group-hover:border-slate-700 group-hover:text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-300 dark:group-hover:border-slate-300 dark:group-hover:text-white'
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`mt-1 max-w-[68px] text-[10px] font-medium leading-tight ${
                    isActive
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {index < steps.length - 1 ? (
                <div className="mt-3 h-px flex-1 bg-slate-300 dark:bg-slate-700">
                  <div
                    className={`h-px transition-colors ${
                      isPast ? 'bg-slate-950 dark:bg-white' : 'bg-transparent'
                    }`}
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
