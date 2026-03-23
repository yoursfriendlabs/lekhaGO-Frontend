export default function MobileFormStepper({ steps = [], currentStep, onStepChange }) {
  const currentIndex = Math.max(steps.findIndex((step) => step.id === currentStep), 0);

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
    </div>
  );
}
