import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StudentAttendance from './StudentAttendance.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { SnackbarProvider } from '../../lib/snackbar.jsx';

const apiMocks = vi.hoisted(() => ({
  listStudentShifts: vi.fn(),
  getStudentRoster: vi.fn(),
  saveStudentAttendance: vi.fn(),
  getBusinessSettings: vi.fn(),
  getBusinessProfile: vi.fn(),
}));

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual('../../lib/api');
  return { ...actual, api: { ...actual.api, ...apiMocks } };
});

const SHIFT = { id: 'shift-1', name: 'Morning', startTime: '07:00:00', endTime: '09:00:00', days: [], isActive: true };

function roster(items) {
  return {
    date: '2026-11-15',
    shift: SHIFT,
    runsOnDate: true,
    items,
    summary: { attendanceRate: null },
  };
}

const ITEMS = [
  { enrollmentId: 'e1', studentId: 's1', name: 'Asha Rai', course: { name: 'Maths' }, status: null, note: '' },
  { enrollmentId: 'e2', studentId: 's2', name: 'Bikash Gurung', course: { name: 'Maths' }, status: 'absent', note: '' },
];

function renderPage() {
  return renderWithProviders(
    <SnackbarProvider>
      <StudentAttendance />
    </SnackbarProvider>,
    { route: '/app/students/attendance?shiftId=shift-1&date=2026-11-15', withAuth: true },
  );
}

describe('StudentAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('mms_token', 'token-123');
    window.localStorage.setItem('mms_role', 'owner');
    window.localStorage.setItem('mms_business_id', 'business-123');
    window.localStorage.setItem('mms_user', JSON.stringify({ id: 'u1', name: 'Owner', role: 'owner', emailVerified: true }));
    window.localStorage.setItem('mms_subscription', JSON.stringify({
      currentPlan: { key: 'growth', subscriptionStatus: 'active' },
      access: { canUseApplication: true, planKey: 'growth', subscriptionStatus: 'active' },
    }));
    apiMocks.getBusinessSettings.mockResolvedValue({});
    apiMocks.getBusinessProfile.mockResolvedValue({ type: 'retail', addons: ['students'] });
    apiMocks.listStudentShifts.mockResolvedValue({ items: [SHIFT] });
    apiMocks.getStudentRoster.mockResolvedValue(roster(ITEMS));
    apiMocks.saveStudentAttendance.mockResolvedValue(roster([
      { ...ITEMS[0], status: 'present' },
      { ...ITEMS[1], status: 'present' },
    ]));
  });

  it('marks the whole class present and saves only the changed entries', async () => {
    renderPage();

    await screen.findByText('Asha Rai');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all present' }));
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }));

    await waitFor(() => expect(apiMocks.saveStudentAttendance).toHaveBeenCalledTimes(1));
    expect(apiMocks.saveStudentAttendance).toHaveBeenCalledWith({
      date: '2026-11-15',
      shiftId: 'shift-1',
      entries: [
        { enrollmentId: 'e1', status: 'present', note: '' },
        { enrollmentId: 'e2', status: 'present', note: '' },
      ],
    });
    await waitFor(() => expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument());
  });

  it('clears a mark when the chosen status is tapped again', async () => {
    renderPage();

    const row = (await screen.findByText('Bikash Gurung')).closest('li');
    const absent = within(row).getByRole('button', { name: 'Absent' });
    expect(absent).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(absent);
    expect(absent).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('1 unsaved changes')).toBeInTheDocument();
  });

  it('keeps the marks when saving fails', async () => {
    apiMocks.saveStudentAttendance.mockRejectedValueOnce(Object.assign(new Error('Network down'), { status: 500 }));
    renderPage();

    const row = (await screen.findByText('Asha Rai')).closest('li');
    fireEvent.click(within(row).getByRole('button', { name: 'Late' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }));

    expect(await screen.findByText(/Could not save/)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Late' })).toHaveAttribute('aria-pressed', 'true');
  });
});
