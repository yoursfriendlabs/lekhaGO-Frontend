import AsyncSearchableSelect from './AsyncSearchableSelect.jsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { toPartyLookupOption } from '../lib/lookups.js';

export default function PartyFilterSelect({
  value = '',
  selectedOption = null,
  onChange,
  className = '',
  type = 'both',
  placeholder,
  searchPlaceholder,
}) {
  const { t } = useI18n();

  const loadPartyOptions = async (search) => {
    const primary = await api.lookupParties({ search, type, limit: 10 });
    const primaryItems = Array.isArray(primary?.items) ? primary.items : [];

    if (primaryItems.length > 0 || type === 'both') {
      return primaryItems.map((party) => toPartyLookupOption(party));
    }

    const fallback = await api.lookupParties({ search, type: 'both', limit: 10 });
    return (fallback?.items || []).map((party) => toPartyLookupOption(party));
  };

  const renderPartyOption = (option) => {
    const party = option?.entity || {};
    const name = party.name || option.label;
    const phone = party.phone || '';

    return (
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{name}</p>
        {phone ? <p className="truncate text-xs text-slate-500">{phone}</p> : null}
      </div>
    );
  };

  return (
    <AsyncSearchableSelect
      className={className}
      value={value}
      selectedOption={selectedOption}
      onChange={onChange}
      loadOptions={loadPartyOptions}
      placeholder={placeholder || t('services.allParties')}
      searchPlaceholder={searchPlaceholder || t('parties.searchPlaceholder')}
      noResultsLabel={t('common.noData')}
      loadingLabel={t('common.loading')}
      minQueryLength={0}
      dropdownMinWidth={320}
      renderOption={renderPartyOption}
    />
  );
}
