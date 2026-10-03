import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Wallet } from 'lucide-react';
import dayjs from '../../lib/dates/datetime';
import { formatCurrency } from '../../lib/money/currency';

/**
 * Money in and money out are told apart by hue and by which side of the zero
 * line they sit on, so the pair still reads under red-green colour blindness.
 * Both steps clear the contrast and separation checks on the light card and on
 * the dark one, which is why one pair serves both themes.
 */
export const FLOW_COLORS = { in: '#0d9488', out: '#e11d48' };
const ON_HAND_COLOR = '#9b6835';
const ON_HAND_NEGATIVE_COLOR = '#e11d48';

const GRID = 'rgb(var(--color-secondary-200))';
const AXIS_TEXT = 'rgb(var(--color-secondary-500))';

const TOOLTIP_STYLE = {
  backgroundColor: 'rgb(var(--color-surface))',
  border: '1px solid rgb(var(--color-secondary-200))',
  borderRadius: '12px',
  fontSize: '12px',
};

function ChartCard({ title, caption, icon: Icon, children, action }) {
  return (
    <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink dark:text-slate-100">{title}</p>
          {caption ? <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{caption}</p> : null}
        </div>
        {action || (Icon ? <Icon size={18} className="shrink-0 text-secondary-400" /> : null)}
      </div>
      {children}
    </div>
  );
}

function ChartBody({ loading, empty, emptyLabel, height = 'h-64', children }) {
  if (loading) {
    return <div className={`mt-4 ${height} animate-pulse rounded-2xl bg-mist dark:bg-slate-800/60`} />;
  }
  if (empty) {
    return (
      <p className={`mt-4 flex ${height} items-center justify-center text-sm text-secondary-500 dark:text-secondary-400`}>
        {emptyLabel}
      </p>
    );
  }
  return <div className={`mt-4 ${height}`}>{children}</div>;
}

/**
 * Axis ticks and tip labels stay short so they never crowd the plot; the
 * tooltip carries the exact figure. The sign goes in front of the symbol,
 * because a bare "Rs 45K" on both sides of a zero line reads as one value
 * twice over.
 */
const compactAmount = (symbol) => (value) => {
  const text = formatCurrency(Math.abs(value), { symbol, compact: true });
  return value < 0 ? `−${text}` : text;
};

/**
 * Money in above the line, money out below it, one column per day — or per
 * account when the range is a single day, where a day-by-day axis would be a
 * single pair of columns and tell the owner nothing.
 *
 * `out` is carried as a negative number purely to place the column; every label
 * and tooltip shows the amount the way it was recorded.
 */
export function MoneyFlowChart({
  series = [],
  accounts = [],
  byAccount = false,
  loading = false,
  symbol = 'Rs',
  t,
}) {
  const data = useMemo(() => {
    if (byAccount) {
      return accounts
        .filter((account) => account.in || account.out)
        .map((account) => ({
          key: account.type === 'cash' ? 'cash' : `${account.type}-${account.id}`,
          label: account.type === 'cash' ? t('dayBook.cashInHand') : account.name,
          in: account.in,
          out: -Math.abs(account.out),
        }));
    }
    return series.map((point) => ({
      key: point.date,
      label: dayjs(point.date).format('D MMM'),
      in: point.in,
      out: -Math.abs(point.out),
    }));
  }, [accounts, byAccount, series, t]);

  const hasValues = data.some((row) => row.in || row.out);
  // Past a handful of columns, every other tick is enough to date the axis by.
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <ChartCard
      title={t('dayBook.flowChartTitle')}
      caption={byAccount ? t('dayBook.flowChartByAccount') : t('dayBook.flowChartByDay')}
      icon={ArrowUpRight}
    >
      <ChartBody loading={loading} empty={!hasValues} emptyLabel={t('dayBook.noChartData')}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: AXIS_TEXT }}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              interval={byAccount ? 0 : tickInterval}
            />
            <YAxis
              tick={{ fontSize: 10, fill: AXIS_TEXT }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={compactAmount(symbol)}
            />
            <ReferenceLine y={0} stroke={GRID} />
            <Tooltip
              formatter={(value, name) => [formatCurrency(Math.abs(value), { symbol }), name]}
              labelFormatter={(label) => label}
              contentStyle={TOOLTIP_STYLE}
            />
            <Legend
              verticalAlign="top"
              align="left"
              height={28}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
            />
            <Bar
              dataKey="in"
              name={t('dayBook.moneyIn')}
              fill={FLOW_COLORS.in}
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="out"
              name={t('dayBook.moneyOut')}
              fill={FLOW_COLORS.out}
              radius={[0, 0, 4, 4]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartBody>
    </ChartCard>
  );
}

/**
 * What the shop holds, account by account, so one cash drawer and four banks
 * can be compared by length instead of by reading five numbers. The account
 * cards underneath carry the exact figures.
 */
export function MoneyOnHandChart({
  accounts = [],
  loading = false,
  symbol = 'Rs',
  activeAccountId = '',
  onSelectAccount,
  t,
}) {
  const data = useMemo(() => accounts
    .map((account) => ({
      id: account.id,
      label: account.type === 'cash' ? t('dayBook.cashInHand') : account.name,
      closing: account.closing,
    }))
    .sort((a, b) => Math.abs(b.closing) - Math.abs(a.closing)), [accounts, t]);

  const hasValues = data.some((row) => row.closing);
  // A value at every tip is only readable while the bars are few.
  const showTipLabels = data.length <= 6;
  const height = data.length > 5 ? 'h-80' : 'h-64';

  return (
    <ChartCard
      title={t('dayBook.onHandChartTitle')}
      caption={t('dayBook.onHandChartSubtitle')}
      icon={Wallet}
    >
      <ChartBody loading={loading} empty={!hasValues} emptyLabel={t('dayBook.noChartData')} height={height}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: showTipLabels ? 72 : 12, left: 0, bottom: 4 }}
            barCategoryGap="28%"
          >
            <CartesianGrid stroke={GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: AXIS_TEXT }}
              axisLine={false}
              tickLine={false}
              tickFormatter={compactAmount(symbol)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: AXIS_TEXT }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <ReferenceLine x={0} stroke={GRID} />
            <Tooltip
              formatter={(value) => [formatCurrency(value, { symbol }), t('dayBook.closing')]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Bar
              dataKey="closing"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              onClick={onSelectAccount ? (bar) => onSelectAccount(bar?.payload?.id ?? bar?.id) : undefined}
              cursor={onSelectAccount ? 'pointer' : undefined}
            >
              {data.map((row) => (
                <Cell
                  key={row.id}
                  fill={row.closing < 0 ? ON_HAND_NEGATIVE_COLOR : ON_HAND_COLOR}
                  fillOpacity={!activeAccountId || activeAccountId === row.id ? 1 : 0.35}
                />
              ))}
              {showTipLabels ? (
                <LabelList
                  dataKey="closing"
                  position="right"
                  offset={8}
                  style={{ fontSize: 11, fill: AXIS_TEXT, fontWeight: 600 }}
                  formatter={compactAmount(symbol)}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartBody>
    </ChartCard>
  );
}
