import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '../lib/currency';

function defaultValueFormatter(value) {
  return formatCurrency(value);
}

function defaultAxisFormatter(value) {
  return formatCurrency(value, { compact: true });
}

function BarGraph({
  data,
  dataKey = 'value',
  nameKey = 'label',
  color = '#10b981',
  title,
  height = 200,
  caption,
  bars,
  valueFormatter = defaultValueFormatter,
  axisFormatter = defaultAxisFormatter,
}) {
  const normalizedBars = Array.isArray(bars) && bars.length > 0
    ? bars
    : [{ dataKey, color, label: 'Amount' }];

  return (
    <div className="card">
      {title && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-xl text-slate-900 dark:text-white">{title}</h3>
            <span className="text-xs text-slate-500">{caption ?? `Last ${data.length} days`}</span>
          </div>
          {normalizedBars.length > 1 ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {normalizedBars.map((bar) => (
                <span key={bar.dataKey} className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bar.color }} />
                  {bar.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} barGap={6}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey={nameKey}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={axisFormatter}
          />
          <Tooltip
            formatter={(value, name) => [valueFormatter(value), name || 'Amount']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          {normalizedBars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.label ?? bar.dataKey}
              fill={bar.color ?? color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarGraph;
