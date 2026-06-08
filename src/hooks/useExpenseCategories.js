import { useEffect, useMemo, useState } from 'react';
import {
  Car,
  Tag,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react';

import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';

export const CUSTOM_EXPENSE_CATEGORY = '__custom__';

const CATEGORY_STYLES = [
  {
    activeColor: 'border-orange-400 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-900/20',
    iconWrap: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  {
    activeColor: 'border-blue-400 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-900/20',
    iconWrap: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    activeColor: 'border-yellow-400 bg-yellow-50 dark:border-yellow-500/50 dark:bg-yellow-900/20',
    iconWrap: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  {
    activeColor: 'border-violet-400 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-900/20',
    iconWrap: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  },
  {
    activeColor: 'border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-900/20',
    iconWrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  {
    activeColor: 'border-slate-400 bg-slate-50 dark:border-slate-500/50 dark:bg-slate-900/20',
    iconWrap: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
];

function getStyleAt(index = 0) {
  return CATEGORY_STYLES[index % CATEGORY_STYLES.length];
}

function normalizeExpenseCategory(category, index = 0) {
  if (!category?.id || !category?.name) return null;
  return {
    id: `expense-category-${category.id}`,
    value: `expense-category-${category.id}`,
    label: category.name,
    rawId: category.id,
    icon: Wallet,
    ...getStyleAt(index),
  };
}

function buildDefaultCategories(t) {
  const defaults = [
    { id: 'food', label: t('quickExpense.categories.food'), icon: Utensils },
    { id: 'transport', label: t('quickEntry.categories.transport'), icon: Car },
    { id: 'utilities', label: t('quickEntry.categories.utilities'), icon: Zap },
  ];

  return defaults.map((category, index) => ({
    ...category,
    value: category.id,
    ...getStyleAt(index),
  }));
}

function dedupeByLabel(categories = []) {
  const seen = new Set();
  return categories.filter((category) => {
    const key = String(category?.label || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveExpenseCategoryLabel(categories, categoryId, customCategory, t) {
  if (categoryId === CUSTOM_EXPENSE_CATEGORY) {
    return String(customCategory || '').trim() || t('quickExpense.customExpense');
  }

  return categories.find((category) => category.id === categoryId)?.label || '';
}

export function useExpenseCategories({ businessId, includeCustom = true } = {}) {
  const { t } = useI18n();
  const [managedCategories, setManagedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    if (!businessId) {
      setManagedCategories([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError('');

    api.listCategories({ type: 'expense', limit: 100, offset: 0 })
      .then((response) => {
        if (!active) return;
        setManagedCategories(response?.items || []);
      })
      .catch((nextError) => {
        if (!active) return;
        setManagedCategories([]);
        setError(nextError?.message || 'Failed to load expense categories');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [businessId]);

  const categories = useMemo(() => {
    const defaults = buildDefaultCategories(t);
    const managed = managedCategories
      .map((category, index) => normalizeExpenseCategory(category, defaults.length + index))
      .filter(Boolean);

    const merged = dedupeByLabel([...managed, ...defaults]);

    if (!includeCustom) return merged;

    return [
      ...merged,
      {
        id: CUSTOM_EXPENSE_CATEGORY,
        value: CUSTOM_EXPENSE_CATEGORY,
        label: t('quickExpense.categories.custom'),
        icon: Tag,
        ...getStyleAt(merged.length),
      },
    ];
  }, [includeCustom, managedCategories, t]);

  return {
    categories,
    loading,
    error,
  };
}
