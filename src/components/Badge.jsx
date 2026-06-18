import React from "react";

/**
 * @typedef {'default'|'active'|'inactive'|'success'|'warning'|'error'|'pending'} BadgeVariant
 * @typedef {'sm'|'md'|'lg'} BadgeSize
 */

const variantStyles = {
  default:
    "bg-slate-100/80 text-slate-600 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:ring-slate-800",
  active:
    "bg-emerald-50/80 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800",
  inactive:
    "bg-slate-100/80 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  error: "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400",
  pending:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const dotColors = {
  default: "bg-slate-400",
  active: "bg-emerald-500 shadow-sm shadow-emerald-500/30",
  inactive: "bg-slate-400",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
  pending: "bg-slate-400",
};

const sizeStyles = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

/**
 * Unified badge component with semantic color variants.
 *
 * @param {Object} props
 * @param {BadgeVariant} [props.variant='default']
 * @param {BadgeSize} [props.size='md']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 * @param {React.ReactNode} [props.icon]
 * @param {boolean} [props.dot]
 */
export function Badge({
  variant = "default",
  size = "md",
  children,
  className = "",
  icon,
  dot,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 backdrop-blur-sm transition-all duration-200 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${dotColors[variant]}`}
        />
      )}
      {icon && (
        <span className="flex items-center justify-center">{icon}</span>
      )}
      {children}
    </span>
  );
}
