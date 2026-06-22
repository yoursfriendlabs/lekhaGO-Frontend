import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';

export default function ActionMenu({
  actions = [],
  label = 'Actions',
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      const dropdown = dropdownRef.current;

      if (!rect) return;

      const padding = 8;
      const dropdownWidth = 176;

      // real height (no guessing)
      const dropdownHeight = dropdown?.offsetHeight || 0;

      let left = rect.left;
      let top = rect.bottom + 4;

      // horizontal clamp
      if (left + dropdownWidth > window.innerWidth) {
        left = window.innerWidth - dropdownWidth - padding;
      }
      left = Math.max(padding, left);

      // space checks
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const shouldOpenUp =
        dropdownHeight > 0 &&
        spaceBelow < dropdownHeight + 8 &&
        spaceAbove > dropdownHeight + 8;

      if (shouldOpenUp) {
        top = rect.top - dropdownHeight - 4;
      }

      setMenuStyle({ left, top });
    };

    // run after render so height exists
    requestAnimationFrame(updatePosition);

    const handleOutside = (e) => {
      if (
        !rootRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const enabledActions = actions.filter(Boolean);

  const dropdown =
    open && menuStyle ? (
      <div
        ref={dropdownRef}
        className="fixed w-44 rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-900/15 dark:border-slate-800 dark:bg-slate-950 z-[9999]"
        style={menuStyle}
      >
        {enabledActions.map((action) => {
          const Icon = action.icon;

          const base =
            'flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed';

          const tone =
            action.tone === 'danger'
              ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40'
              : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900';

          const className = `${base} ${tone}`;

          const content = (
            <>
              {Icon && <Icon size={14} />}
              <span>{action.label}</span>
            </>
          );

          if (action.to) {
            return (
              <Link
                key={action.label}
                to={action.to}
                className={className}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={action.label}
              type="button"
              className={className}
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onClick?.();
              }}
            >
              {content}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={16} />
      </button>

      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
