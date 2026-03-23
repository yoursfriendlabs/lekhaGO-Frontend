import { PieChart as RePieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function PieChart({ data, height = 300 }) {
  const colors = ['#10b981', '#3b82f6', '#f59e0b'];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const formattedData = data.map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
    percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
        <RePieChart>
          <Pie
            data={formattedData}
            cx="50%"
            cy="50%"
            outerRadius={130}
            paddingAngle={2}
            dataKey="value"
          >
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name, props) => {
              const percentage = props?.payload?.percentage || 0;
              return [`Rs ${Number(value).toFixed(2)} (${percentage}%)`, name];
            }}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value, entry) => (
              <span style={{ color: entry.color, fontSize: '12px' }}>{value}</span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
  );
}

export default PieChart;
