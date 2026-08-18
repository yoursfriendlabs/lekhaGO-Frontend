import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useBusinessSettings } from '../lib/businessSettings';
import { adISOToBsParts, formatBsParts, isValidAdISODate } from '../lib/nepaliDate';
import { useI18n } from '../lib/i18n.jsx';

/**
 * Renders a date in AD and BS formats.
 * Utilizes the business preference settings (AD or BS default).
 */
export default function DateDisplay({
  date,
  mode = 'tooltip', // 'tooltip' | 'inline' | 'stacked'
  format = 'D MMM YYYY',
  className = '',
}) {
  const { language } = useI18n();
  const { settings } = useBusinessSettings();

  const defaultCalendar = settings?.uiPreferences?.defaultCalendar || 'ad';

  const dateInfo = useMemo(() => {
    if (!date) return { primary: '—', secondary: '' };

    const parsedAd = dayjs(date);
    if (!parsedAd.isValid()) return { primary: String(date), secondary: '' };

    const adISO = parsedAd.format('YYYY-MM-DD');
    const adFormatted = parsedAd.format(format);

    // Get BS Parts
    let bsFormatted = '';
    if (isValidAdISODate(adISO)) {
      const bsParts = adISOToBsParts(adISO);
      if (bsParts) {
        bsFormatted = formatBsParts(bsParts, { 
          withLabel: false, 
          withMonthName: false 
        });
      }
    }

    if (defaultCalendar === 'bs' && bsFormatted) {
      return {
        primary: bsFormatted,
        secondary: `AD: ${adFormatted}`,
      };
    }

    return {
      primary: adFormatted,
      secondary: bsFormatted || '',
    };
  }, [date, format, defaultCalendar, language]);

  if (!dateInfo.secondary) {
    return <span className={className}>{dateInfo.primary}</span>;
  }

  if (mode === 'inline') {
    return (
      <span className={`${className} inline-flex items-center gap-1.5`}>
        <span>{dateInfo.primary}</span>
        <span className="text-[11px] text-secondary-500 font-medium dark:text-secondary-400">
          ({dateInfo.secondary})
        </span>
      </span>
    );
  }

  if (mode === 'stacked') {
    return (
      <div className="flex flex-col items-start leading-tight">
        <span className={className}>{dateInfo.primary}</span>
        <span className="text-[10px] text-secondary-500 font-medium dark:text-secondary-400">
          {dateInfo.secondary}
        </span>
      </div>
    );
  }

  // Default: 'tooltip'
  return (
    <span 
      className={`${className} group relative inline-block cursor-help border-b border-dashed border-slate-300 dark:border-slate-700`}
      title={dateInfo.secondary} // Fallback for accessibility/mobile
    >
      {dateInfo.primary}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 scale-75 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100 bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap dark:bg-slate-800 border border-slate-700 dark:border-slate-600">
        {dateInfo.secondary}
      </span>
    </span>
  );
}
