import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import DayBookReport from './DayBookReport.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

const apiMocks = vi.hoisted(() => ({ dayBookReport: vi.fn() }));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');

  return {
    ...actual,
    api: { ...actual.api, dayBookReport: apiMocks.dayBookReport },
  };
});

// The real input opens a portalled dual-calendar picker; the day book only ever
// reads the ISO date it emits.
vi.mock('../form/FlexibleDateInput.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <input id={id} type="date" value={value} onChange={onChange} />
  ),
}));

// Charts are covered by their own shape; these tests are about the filters.
vi.mock('./DayBookCharts.jsx', () => ({
  MoneyFlowChart: () => <div data-testid="flow-chart" />,
  MoneyOnHandChart: () => <div data-testid="on-hand-chart" />,
}));

const ISO = 'YYYY-MM-DD';
const today = () => dayjs().format(ISO);

function buildReport(overrides = {}) {
  return {
    from: today(),
    to: today(),
    cashOpeningBalance: 2000,
    accounts: [
      { id: 'cash', type: 'cash', name: 'Cash in Hand', opening: 4000, in: 1500, out: 200, closing: 5300, count: 2, inCount: 1, outCount: 1 },
      { id: 'bank-1', type: 'bank', name: 'Nabil Bank', opening: 10000, in: 1800, out: 500, closing: 11300, count: 2, inCount: 1, outCount: 1, isActive: true, recordedBalance: 11300 },
    ],
    totals: {
      opening: 14000, in: 3300, out: 700, closing: 16600, count: 4, inCount: 2, outCount: 2,
      cash: { opening: 4000, in: 1500, out: 200, closing: 5300, count: 2, inCount: 1, outCount: 1 },
      bank: { opening: 10000, in: 1800, out: 500, closing: 11300, count: 2, inCount: 1, outCount: 1 },
      other: { opening: 0, in: 0, out: 0, closing: 0, count: 0, inCount: 0, outCount: 0 },
    },
    series: [{ date: today(), in: 3300, out: 700, net: 2600, count: 4 }],
    entries: [
      { id: 'sale:1', kind: 'in', date: today(), amount: 1500, category: 'Sales', partyName: 'Walk-in', invoiceNo: 'SALE-1', accountId: 'cash', accountType: 'cash', paymentMethod: 'cash', note: '' },
    ],
    entriesFiltered: false,
    total: 4,
    limit: 25,
    offset: 0,
    ...overrides,
  };
}

function signIn() {
  window.localStorage.setItem('mms_token', 'token-123');
  window.localStorage.setItem('mms_role', 'owner');
  window.localStorage.setItem('mms_business_id', 'business-123');
  window.localStorage.setItem('mms_user', JSON.stringify({ id: 'user-1', name: 'Owner', role: 'owner' }));
}

/** The query the component sent on its most recent call. */
function lastQuery() {
  return apiMocks.dayBookReport.mock.calls.at(-1)[0];
}

describe('DayBookReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.dayBookReport.mockResolvedValue(buildReport());
    signIn();
  });

  it('opens on today as a single day', async () => {
    renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });

    await waitFor(() => expect(apiMocks.dayBookReport).toHaveBeenCalled());
    expect(lastQuery()).toMatchObject({ from: today(), to: today() });
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks for a seven day span when the preset is chosen, and will not step past today', async () => {
    renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });
    await waitFor(() => expect(apiMocks.dayBookReport).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({
      from: dayjs().subtract(6, 'day').format(ISO),
      to: today(),
    }));
    // A span already touching today has nowhere forward to go.
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled();
  });

  it('steps back by the length of the span on screen', async () => {
    renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });
    await waitFor(() => expect(apiMocks.dayBookReport).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
    await waitFor(() => expect(lastQuery().from).toBe(dayjs().subtract(6, 'day').format(ISO)));

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }));

    // Seven days on screen moves seven days, not one.
    await waitFor(() => expect(lastQuery()).toMatchObject({
      from: dayjs().subtract(13, 'day').format(ISO),
      to: dayjs().subtract(7, 'day').format(ISO),
    }));
  });

  it('narrows the entry list to one account without touching the balances', async () => {
    renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });
    await waitFor(() => expect(apiMocks.dayBookReport).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Nabil Bank/ }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ accountId: 'bank-1' }));
    // The chosen account shows up as a removable scope, and a second click clears it.
    const chip = await screen.findByRole('button', { name: /^Nabil Bank$/ });
    fireEvent.click(chip);
    await waitFor(() => expect(lastQuery().accountId).toBeUndefined());
  });

  it('filters the entry list from the money in and money out figures', async () => {
    const { container } = renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });
    await waitFor(() => expect(apiMocks.dayBookReport).toHaveBeenCalled());

    const moneyIn = container.querySelector('#day-book-money-in');
    fireEvent.click(moneyIn);
    await waitFor(() => expect(lastQuery()).toMatchObject({ direction: 'in' }));

    // Clicking the same figure again drops the filter.
    fireEvent.click(moneyIn);
    await waitFor(() => expect(lastQuery().direction).toBeUndefined());

    fireEvent.click(container.querySelector('#day-book-money-out'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ direction: 'out' }));
  });

  it('says why a zero is zero, and does not offer it as a filter', async () => {
    apiMocks.dayBookReport.mockResolvedValue(buildReport({
      totals: {
        opening: 14000, in: 3300, out: 0, closing: 17300, count: 2, inCount: 2, outCount: 0,
        cash: { opening: 4000, in: 1500, out: 0, closing: 5500, count: 1, inCount: 1, outCount: 0 },
        bank: { opening: 10000, in: 1800, out: 0, closing: 11800, count: 1, inCount: 1, outCount: 0 },
        other: { opening: 0, in: 0, out: 0, closing: 0, count: 0, inCount: 0, outCount: 0 },
      },
    }));

    const { container } = renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });

    expect(await screen.findByText('Nothing went out')).toBeTruthy();
    expect(screen.getByText('2 movements')).toBeTruthy();
    // Nothing went out, so there is no money-out list to filter down to.
    expect(container.querySelector('#day-book-money-out')).not.toHaveAttribute('role', 'button');
    expect(container.querySelector('#day-book-money-in')).toHaveAttribute('role', 'button');
  });

  it('reports the net of the period alongside the two sides', async () => {
    renderWithProviders(<DayBookReport />, { route: '/app/reports', withAuth: true });

    expect(await screen.findByText('Net movement')).toBeTruthy();
    expect(screen.getByText('+Rs 2,600.00')).toBeTruthy();
  });
});
