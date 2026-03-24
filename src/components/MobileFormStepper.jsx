export default function MobileFormStepper({ steps = [], currentStep, onStepChange, onNext, onBack, canProceed = true, nextLabel = 'Continue', backLabel = 'Back' }) {
  const currentIndex = Math.max(steps.findIndex((step) => step.id === currentStep), 0);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm shadow-slate-200/30 dark:border-slate-800/60 dark:bg-slate-950/50 dark:shadow-none md:hidden">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
        <span>{currentIndex + 1} / {steps.length}</span>
        <span>{steps[currentIndex]?.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = index < currentIndex;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepChange(step.id)}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : isPast
                    ? 'bg-primary-50 text-primary-700'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step.label}
            </button>
          );
        })}
      </div>
      
      {/* Navigation buttons */}
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
    </div>
  );
}
