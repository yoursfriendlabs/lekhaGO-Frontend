import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';

function normalizeId(value) {
  return String(value || '').trim();
}

function getCurrentUserCreatorId(user) {
  return [
    user?.id,
    user?._id,
    user?.userId,
  ]
    .map(normalizeId)
    .find(Boolean) || '';
}

function getCreatorOptionFromMember(member) {
  const memberUser = member?.user && typeof member.user === 'object'
    ? member.user
    : member?.User && typeof member.User === 'object'
      ? member.User
      : {};
  const value = [
    memberUser.id,
    memberUser._id,
    memberUser.userId,
    member.userId,
  ]
    .map(normalizeId)
    .find(Boolean) || '';

  if (!value) return null;

  const label = String(
    memberUser.name ||
    memberUser.email ||
    member.name ||
    member.email ||
    value
  ).trim();

  return label ? { value, label } : null;
}

export default function CreatorFilterSelect({
  value = '',
  onChange,
  className = '',
  placeholder,
}) {
  const { businessId, user } = useAuth();
  const { t } = useI18n();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!businessId) {
      setMembers([]);
      return undefined;
    }

    let isActive = true;

    api.listStaff()
      .then((response) => {
        if (!isActive) return;
        setMembers(Array.isArray(response?.members) ? response.members : []);
      })
      .catch(() => {
        if (!isActive) return;
        setMembers([]);
      });

    return () => {
      isActive = false;
    };
  }, [businessId]);

  const options = useMemo(() => {
    const allOption = { value: '', label: t('filters.allCreators') };
    const seen = new Set(['']);
    const next = [allOption];

    const addOption = (option) => {
      if (!option?.value || seen.has(option.value)) return;
      seen.add(option.value);
      next.push(option);
    };

    members
      .map(getCreatorOptionFromMember)
      .filter(Boolean)
      .sort((left, right) => left.label.localeCompare(right.label))
      .forEach(addOption);

    const currentUserId = getCurrentUserCreatorId(user);
    const currentUserLabel = String(user?.name || user?.email || currentUserId).trim();

    if (currentUserId && currentUserLabel) {
      addOption({ value: currentUserId, label: currentUserLabel });
    }

    return next;
  }, [members, t, user]);

  return (
    <SearchableSelect
      className={className}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder || t('filters.allCreators')}
    />
  );
}
