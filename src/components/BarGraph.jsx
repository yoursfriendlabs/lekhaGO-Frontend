import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function BarGraph({ data, dataKey = 'value', nameKey = 'label', color = '#10b981', title, height = 200 }) {
  return (
    <div className="card">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-slate-900 dark:text-white">{title}</h3>
          <span className="text-xs text-slate-500">Last {data.length} days</span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
            tickFormatter={(value) => `Rs ${value}`}
          />
          <Tooltip
            formatter={(value) => [`Rs ${Number(value).toFixed(2)}`, 'Amount']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarGraph;