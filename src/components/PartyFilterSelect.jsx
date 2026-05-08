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
  const normalizedType = type && type !== 'both' ? type : undefined;

  const mapPartyOptions = (items = []) => items
    .map((party) => toPartyLookupOption(party))
    .filter((option) => option?.value)
    .sort((left, right) => left.label.localeCompare(right.label));

  const loadPartyOptions = async (search) => {
    const normalizedSearch = String(search || '').trim();

    if (!normalizedSearch) {
      const list = await api.listParties({
        ...(normalizedType ? { type: normalizedType } : {}),
      });
      const listItems = Array.isArray(list?.items) ? list.items : [];

      if (listItems.length > 0 || !normalizedType) {
        return mapPartyOptions(listItems);
      }

      const fallbackList = await api.listParties();
      return mapPartyOptions(Array.isArray(fallbackList?.items) ? fallbackList.items : []);
    }

    const primary = await api.lookupParties({
      search: normalizedSearch,
      ...(normalizedType ? { type: normalizedType } : {}),
      limit: 10,
    });
    const primaryItems = Array.isArray(primary?.items) ? primary.items : [];

    if (primaryItems.length > 0 || !normalizedType) {
      return mapPartyOptions(primaryItems);
    }

    const fallback = await api.lookupParties({ search: normalizedSearch, limit: 10 });
    return mapPartyOptions(Array.isArray(fallback?.items) ? fallback.items : []);
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
