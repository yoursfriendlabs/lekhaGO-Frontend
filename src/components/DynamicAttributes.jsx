import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { api } from '../lib/api';

export default function DynamicAttributes({ entityType, attributes, onChange }) {
  const { t } = useI18n();
  const [definedAttributes, setDefinedAttributes] = useState([]);
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    api.listOrderAttributes({ entityType })
      .then((data) => {
        setDefinedAttributes(
          (data || []).filter((attr) => attr.entityType === 'all' || attr.entityType === entityType)
        );
      })
      .catch(() => null);
  }, [entityType]);

  const handleChange = (key, value) => {
    onChange({
      ...attributes,
      [key]: value,
    });
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    const cleanKey = newKey.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!attributes[cleanKey]) {
      handleChange(cleanKey, '');
    }
    setNewKey('');
  };

  const handleRemove = (key) => {
    const next = { ...attributes };
    delete next[key];
    onChange(next);
  };

  // Predefined ones from API first, then any extra manual ones in attributes
  const definedKeys = definedAttributes.map((attribute) => attribute.key);
  const extraKeys = Object.keys(attributes).filter((key) => !definedKeys.includes(key));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        {definedAttributes.map((attr) => (
          <div key={attr.key} className="relative">
            <label className="label capitalize">{attr.name || attr.key.replace(/_/g, ' ')}</label>
            <input
              type={attr.type === 'number' ? 'number' : attr.type === 'date' ? 'date' : 'text'}
              className="input mt-1"
              value={attributes[attr.key] || ''}
              onChange={(e) => handleChange(attr.key, e.target.value)}
              placeholder={attr.name}
            />
          </div>
        ))}

        {extraKeys.map((key) => (
          <div key={key} className="relative">
            <label className="label capitalize text-slate-500 italic">
              {key.replace(/_/g, ' ')} ({t('common.manual') || 'manual'})
            </label>
            <div className="flex gap-2">
              <input
                className="input mt-1"
                value={attributes[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-100 border-dashed">
        <input
          placeholder={t('services.addAttribute') || 'Add custom attribute...'}
          className="input flex-1"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-xl bg-ocean/10 px-4 py-2 text-ocean hover:bg-ocean/20 text-sm font-semibold"
        >
          {t('services.add') || 'Add'}
        </button>
      </div>
    </div>
  );
}
