import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { MoreVertical } from 'lucide-react';

export default function ActionMenu({ actions = [], align = 'right', label = 'Actions' }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setMenuStyle({
        top: rect.bottom + 6,
        ...(align === 'left'
          ? { left: rect.left }
          : { right: Math.max(window.innerWidth - rect.right, 8) }),
      });
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!rootRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    updateMenuPosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [align, open]);

  const enabledActions = actions.filter(Boolean);
  const dropdown = open && menuStyle ? (
    <div
      ref={dropdownRef}
      className="fixed z-[1000] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl shadow-slate-900/15 dark:border-slate-800 dark:bg-slate-950"
      style={menuStyle}
    >
      {enabledActions.map((action) => {
        const Icon = action.icon;
        const toneClass = action.tone === 'danger'
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40'
          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900';
        const className = `flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition ${toneClass} disabled:cursor-not-allowed disabled:opacity-60`;
        const content = (
          <>
            {Icon ? <Icon size={14} /> : null}
            <span>{action.label}</span>
          </>
        );

        if (action.to) {
          return (
            <Link key={action.label} className={className} to={action.to} onClick={() => setOpen(false)}>
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
    <div ref={rootRef} className="relative inline-flex text-left">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreVertical size={16} />
      </button>
      {dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
