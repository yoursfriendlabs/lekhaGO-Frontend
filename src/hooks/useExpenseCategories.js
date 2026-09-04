import { useEffect, useMemo, useState } from 'react';
import {
  Car,
  Tag,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react';

const DEFAULT_CATEGORY_IDS = ['food', 'transport', 'utilities'];

import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';

export const CUSTOM_EXPENSE_CATEGORY = '__custom__';
export const SAVED_CUSTOM_PREFIX = 'saved-custom-';

function isSavedCustomId(id) {
  return String(id || '').startsWith(SAVED_CUSTOM_PREFIX);
}

function readStoredArray(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeStoredArray(key, values) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore storage errors
  }
}

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
    activeColor: 'border-secondary-400 bg-mist',
    iconWrap: 'bg-secondary-100 text-ink-light',
    badge: 'bg-secondary-100 text-ink-light',
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
    backendKey: String(
      category.categoryKey || category.key || category.slug || category.id,
    ),
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
  if (categoryId === CUSTOM_EXPENSE_CATEGORY || isSavedCustomId(categoryId)) {
    const saved = isSavedCustomId(categoryId)
      ? categories.find((category) => category.id === categoryId)
      : null;
    return String(customCategory?.trim() || saved?.label || '').trim() || t('quickExpense.customExpense');
  }

  return categories.find((category) => category.id === categoryId)?.label || '';
}

function toSlug(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveExpenseCategoryPayload(categories, categoryId, customCategory, t) {
  const selectedCategory = categories.find((category) => category.id === categoryId) || null;
  const customName = String(customCategory || '').trim();
  const categoryName = resolveExpenseCategoryLabel(
    categories,
    categoryId,
    customCategory,
    t,
  );

  if (!categoryName) {
    return {
      categoryKey: '',
      categoryName: '',
      categoryType: '',
      categoryId: null,
    };
  }

  if (categoryId === CUSTOM_EXPENSE_CATEGORY || isSavedCustomId(categoryId)) {
    const slug = toSlug(categoryId === CUSTOM_EXPENSE_CATEGORY ? customName : (selectedCategory?.label || customName));
    return {
      categoryKey: slug ? `custom-${slug}` : CUSTOM_EXPENSE_CATEGORY,
      categoryName,
      categoryType: 'custom',
      categoryId: null,
    };
  }

  return {
    categoryKey: String(selectedCategory?.backendKey || categoryId || ''),
    categoryName,
    categoryType: selectedCategory?.rawId ? 'managed' : 'preset',
    categoryId: selectedCategory?.rawId || null,
  };
}

export function useExpenseCategories({ businessId, includeCustom = true } = {}) {
  const { t } = useI18n();
  const [managedCategories, setManagedCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const removedKey = `mms_expense_categories_removed_${businessId || 'none'}`;
  const customKey = `mms_expense_categories_custom_${businessId || 'none'}`;

  const [removedDefaults, setRemovedDefaults] = useState(
    () => new Set(readStoredArray(removedKey)),
  );
  const [customCategories, setCustomCategories] = useState(() =>
    readStoredArray(customKey).filter((c) => c && c.id && c.name),
  );

  useEffect(() => {
    setRemovedDefaults(new Set(readStoredArray(removedKey)));
    setCustomCategories(
      readStoredArray(customKey).filter((c) => c && c.id && c.name),
    );
  }, [removedKey, customKey]);


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
    const defaults = buildDefaultCategories(t).filter(
      (category) => !removedDefaults.has(category.id),
    );
    const managed = managedCategories
      .map((category, index) => normalizeExpenseCategory(category, defaults.length + index))
      .filter(Boolean);

    const merged = dedupeByLabel([...managed, ...defaults]);

    const savedCustoms = customCategories.map((custom, index) => ({
      id: `${SAVED_CUSTOM_PREFIX}${custom.id}`,
      value: `${SAVED_CUSTOM_PREFIX}${custom.id}`,
      label: custom.name,
      rawId: custom.id,
      icon: Tag,
      ...getStyleAt(merged.length + index),
    }));

    const withCustoms = dedupeByLabel([...merged, ...savedCustoms]);

    if (!includeCustom) return withCustoms;

    return [
      ...withCustoms,
      {
        id: CUSTOM_EXPENSE_CATEGORY,
        value: CUSTOM_EXPENSE_CATEGORY,
        label: t('quickExpense.categories.custom'),
        icon: Tag,
        ...getStyleAt(withCustoms.length),
      },
    ];
  }, [includeCustom, managedCategories, removedDefaults, customCategories, t]);

  const removeDefaultCategory = (id) => {
    if (!DEFAULT_CATEGORY_IDS.includes(id)) return;
    setRemovedDefaults((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeStoredArray(removedKey, Array.from(next));
      return next;
    });
  };

  const createCustomId = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const addCustomCategory = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const existing = customCategories.find(
      (c) => String(c.name).toLowerCase() === clean.toLowerCase(),
    );
    if (existing) return `${SAVED_CUSTOM_PREFIX}${existing.id}`;
    const newCustom = { id: createCustomId(), name: clean };
    setCustomCategories((prev) => {
      const next = [...prev, newCustom];
      writeStoredArray(customKey, next);
      return next;
    });
    return `${SAVED_CUSTOM_PREFIX}${newCustom.id}`;
  };

  const removeCustomCategory = (id) => {
    if (!isSavedCustomId(id)) return;
    const customId = String(id).slice(SAVED_CUSTOM_PREFIX.length);
    setCustomCategories((prev) => {
      const next = prev.filter((c) => c.id !== customId);
      writeStoredArray(customKey, next);
      return next;
    });
  };

  return {
    categories,
    loading,
    error,
    removeDefaultCategory,
    addCustomCategory,
    removeCustomCategory,
  };
}
