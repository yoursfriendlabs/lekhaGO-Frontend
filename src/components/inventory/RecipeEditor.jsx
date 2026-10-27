import { useEffect, useMemo, useState } from 'react';
import { api, getCollectionItems } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { pickBackendMessage } from '@/lib/business/hospitality';
import Notice from '@/components/ui/Notice';
import SearchableSelect from '@/components/form/SearchableSelect';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Recipe tab for restaurant add-on menu items.
 * Only mount when the restaurant add-on is on — never for Standard shops.
 */
export default function RecipeEditor({
  productId,
  salePrice = 0,
  canViewCost = false,
  canManage = false,
  onRecipeSaved,
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stockMode, setStockMode] = useState('self');
  const [items, setItems] = useState([]);
  const [recipeMeta, setRecipeMeta] = useState(null);
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [pickerId, setPickerId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');
  const [pickerUnit, setPickerUnit] = useState('primary');

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      setItems([]);
      setStockMode('self');
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    api
      .getProductRecipe(productId)
      .then((payload) => {
        if (!active) return;
        setStockMode(String(payload?.stockMode || 'self'));
        setRecipeMeta(payload);
        setItems(
          (Array.isArray(payload?.items) ? payload.items : []).map((row) => ({
            ingredientId: String(row.ingredientId || row.productId || ''),
            ingredientName: row.ingredientName || row.name || '',
            quantity: String(row.quantity ?? ''),
            unitType: row.unitType === 'secondary' ? 'secondary' : 'primary',
            unitLabel: row.unitLabel || '',
            lineCost: row.lineCost,
            unitCost: row.unitCost,
          })),
        );
      })
      .catch((err) => {
        if (!active) return;
        setError(pickBackendMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    let active = true;
    api
      .listProducts({ limit: 200, search: '', itemType: 'ingredient' })
      .then((payload) => {
        if (!active) return;
        const list = getCollectionItems(payload);
        setIngredientOptions(
          list.map((product) => ({
            value: String(product.id),
            label: product.name,
            primaryUnit: product.primaryUnit || product.unit || '',
            secondaryUnit: product.secondaryUnit || '',
          })),
        );
      })
      .catch(() => {
        if (active) setIngredientOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedIngredient = useMemo(
    () => ingredientOptions.find((option) => option.value === pickerId) || null,
    [ingredientOptions, pickerId],
  );

  const addLine = () => {
    if (!pickerId || !canManage) return;
    if (items.some((row) => row.ingredientId === pickerId)) {
      setError(t('inventory.recipe.duplicateIngredient') || 'That ingredient is already on the recipe.');
      return;
    }
    setItems((previous) => [
      ...previous,
      {
        ingredientId: pickerId,
        ingredientName: selectedIngredient?.label || pickerId,
        quantity: pickerQty || '1',
        unitType: pickerUnit,
        unitLabel: pickerUnit === 'secondary'
          ? selectedIngredient?.secondaryUnit
          : selectedIngredient?.primaryUnit,
      },
    ]);
    setPickerId('');
    setPickerQty('1');
    setPickerUnit('primary');
    setError('');
  };

  const removeLine = (ingredientId) => {
    setItems((previous) => previous.filter((row) => row.ingredientId !== ingredientId));
  };

  const save = async () => {
    if (!productId || !canManage) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        stockMode,
        items: stockMode === 'recipe'
          ? items
            .filter((row) => row.ingredientId && toNumber(row.quantity) > 0)
            .map((row) => ({
              ingredientId: row.ingredientId,
              quantity: toNumber(row.quantity),
              unitType: row.unitType === 'secondary' ? 'secondary' : 'primary',
            }))
          : [],
      };
      if (stockMode !== 'recipe' && stockMode !== 'none') {
        payload.items = [];
        payload.stockMode = 'self';
      }
      const result = await api.putProductRecipe(productId, payload);
      setRecipeMeta(result);
      setStockMode(String(result?.stockMode || stockMode));
      onRecipeSaved?.(result);
    } catch (err) {
      setError(pickBackendMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!productId) {
    return (
      <Notice
        tone="info"
        title={t('inventory.recipe.saveProductFirst') || 'Save the product first, then edit its recipe.'}
      />
    );
  }

  if (loading) {
    return <p className="text-sm text-secondary-500">{t('common.loading') || 'Loading…'}</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <Notice tone="error" title={error} /> : null}

      <div className="space-y-1">
        <label className="label" htmlFor="stock-mode">
          {t('inventory.recipe.stockMode') || 'Stock mode'}
        </label>
        <select
          id="stock-mode"
          className="input"
          value={stockMode}
          disabled={!canManage}
          onChange={(event) => setStockMode(event.target.value)}
        >
          <option value="self">{t('inventory.recipe.modeSelf') || 'Own stock (self)'}</option>
          <option value="recipe">{t('inventory.recipe.modeRecipe') || 'Recipe ingredients'}</option>
          <option value="none">{t('inventory.recipe.modeNone') || 'No stock tracking'}</option>
        </select>
      </div>

      {stockMode === 'recipe' ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]">
            <SearchableSelect
              options={ingredientOptions}
              value={pickerId}
              onChange={setPickerId}
              placeholder={t('inventory.recipe.pickIngredient') || 'Ingredient'}
              disabled={!canManage}
            />
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={pickerQty}
              disabled={!canManage}
              onChange={(event) => setPickerQty(event.target.value)}
              placeholder="Qty"
            />
            <select
              className="input"
              value={pickerUnit}
              disabled={!canManage}
              onChange={(event) => setPickerUnit(event.target.value)}
            >
              <option value="primary">
                {selectedIngredient?.primaryUnit || t('inventory.recipe.primaryUnit') || 'Primary'}
              </option>
              <option value="secondary" disabled={!selectedIngredient?.secondaryUnit}>
                {selectedIngredient?.secondaryUnit || t('inventory.recipe.secondaryUnit') || 'Secondary'}
              </option>
            </select>
            <button type="button" className="btn-secondary" disabled={!canManage || !pickerId} onClick={addLine}>
              {t('common.add') || 'Add'}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-secondary-200">
            <table className="w-full text-sm">
              <thead className="bg-mist/60 text-left text-secondary-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('inventory.recipe.ingredient') || 'Ingredient'}</th>
                  <th className="px-3 py-2 font-medium">{t('inventory.recipe.qty') || 'Qty'}</th>
                  <th className="px-3 py-2 font-medium">{t('inventory.recipe.unit') || 'Unit'}</th>
                  {canViewCost ? (
                    <th className="px-3 py-2 font-medium">{t('inventory.recipe.cost') || 'Cost'}</th>
                  ) : null}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCost ? 5 : 4} className="px-3 py-4 text-secondary-400">
                      {t('inventory.recipe.empty') || 'No ingredients yet.'}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.ingredientId} className="border-t border-secondary-100">
                      <td className="px-3 py-2">{row.ingredientName}</td>
                      <td className="px-3 py-2">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="any"
                          value={row.quantity}
                          disabled={!canManage}
                          onChange={(event) => {
                            const value = event.target.value;
                            setItems((previous) => previous.map((item) => (
                              item.ingredientId === row.ingredientId
                                ? { ...item, quantity: value }
                                : item
                            )));
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="input"
                          value={row.unitType}
                          disabled={!canManage}
                          onChange={(event) => {
                            const value = event.target.value;
                            setItems((previous) => previous.map((item) => (
                              item.ingredientId === row.ingredientId
                                ? { ...item, unitType: value }
                                : item
                            )));
                          }}
                        >
                          <option value="primary">{t('inventory.recipe.primaryUnit') || 'Primary'}</option>
                          <option value="secondary">{t('inventory.recipe.secondaryUnit') || 'Secondary'}</option>
                        </select>
                      </td>
                      {canViewCost ? (
                        <td className="px-3 py-2 text-secondary-600">
                          {row.lineCost != null ? Number(row.lineCost).toFixed(2) : '—'}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right">
                        {canManage ? (
                          <button type="button" className="btn-ghost text-xs" onClick={() => removeLine(row.ingredientId)}>
                            {t('common.remove') || 'Remove'}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {canViewCost && recipeMeta?.cost != null ? (
            <p className="text-sm text-secondary-600">
              {t('inventory.recipe.costPerServing') || 'Cost per serving'}: {Number(recipeMeta.cost).toFixed(2)}
              {recipeMeta.marginPercent != null
                ? ` · ${t('inventory.recipe.margin') || 'Margin'}: ${Number(recipeMeta.marginPercent).toFixed(1)}%`
                : ''}
              {salePrice ? ` · ${t('inventory.recipe.salePrice') || 'Sale'}: ${Number(salePrice).toFixed(2)}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="flex justify-end">
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {saving
              ? (t('common.saving') || 'Saving…')
              : (t('inventory.recipe.save') || 'Save recipe')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
