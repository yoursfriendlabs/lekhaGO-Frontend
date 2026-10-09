import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import Students from './Students';
import Sidebar from '@/components/layout/Sidebar';
import StaffManagement from '@/components/staff/StaffManagement';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useAuth } from '@/lib/auth';

const mocks = vi.hoisted(() => Object.fromEntries([
  'getBusinessProfile', 'getBusinessSettings', 'listStudents', 'getStudent', 'createStudent',
  'listStudentCourses', 'listStudentShifts', 'listStaff', 'getStudentRoster',
  'markStudentAttendance', 'listStudentAttendance', 'listStudentDues', 'collectEnrollmentFee',
  'createStudentCourse',
  'listBanks',
  'updateStaff',
  'getCurrentUser',
].map((key) => [key, vi.fn()])));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return { ...actual, api: { ...actual.api, ...mocks } };
});

const course = { id: 'c1', name: 'Professional Cooking', fee: 30000, durationValue: 3, durationUnit: 'month', isActive: true };
const shifts = [
  { id: 'morning', name: 'Morning', startTime: '07:00', endTime: '09:00', days: [], isActive: true },
  { id: 'evening', name: 'Evening', days: [], isActive: true },
];
const roster = {
  date: '2026-10-09', shift: shifts[0], runsOnDate: true,
  items: [{ enrollmentId: 'e1', studentId: 's1', name: 'Anita', course: { id: 'c1', name: course.name }, status: null, note: '' }],
};
const due = { id: 'e1', studentId: 's1', startDate: '2026-10-09', student: { name: 'Anita', id: 's1' }, course, fees: { billed: 29000, paid: 5000, due: 24000 } };

function setupSession({ addon = true, role = 'owner', permissions = {}, staffCategory = 'custom' } = {}) {
  const profile = {
    type: 'cafe', addons: addon ? ['students'] : [], modules: { students: addon },
    navigation: [{ key: 'students', label: 'Students', route: '/app/students' }],
  };
  localStorage.setItem('mms_token', 'test-token');
  localStorage.setItem('mms_business_id', 'b1');
  localStorage.setItem('mms_role', role);
  localStorage.setItem('mms_user', JSON.stringify({ id: 'u1', name: 'Owner', role, emailVerified: true }));
  localStorage.setItem('mms_business_profile', JSON.stringify(profile));
  localStorage.setItem('mms_subscription', JSON.stringify({ currentPlan: { key: 'growth', subscriptionStatus: 'active' }, access: { planKey: 'growth', canUseApplication: true } }));
  localStorage.setItem('mms_access_control', JSON.stringify({ role, staffCategory, permissions }));
  mocks.getBusinessProfile.mockResolvedValue(profile);
}

function LocationProbe() { return <output data-testid="location">{useLocation().search}</output>; }
function WorkspaceSwitcher() {
  const { switchWorkspace } = useAuth();
  return <button onClick={() => switchWorkspace('b2')}>Switch test workspace</button>;
}
function renderPage(tab = 'students', { sidebar = false } = {}) {
  return renderWithProviders(<>{sidebar && <Sidebar />}<Students /><LocationProbe /></>, { route: '/app/students?tab=' + tab, withAuth: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  setupSession();
  mocks.getBusinessSettings.mockResolvedValue({});
  mocks.listStudents.mockResolvedValue({ items: [], total: 0 });
  mocks.listStudentCourses.mockResolvedValue({ items: [course] });
  mocks.listBanks.mockResolvedValue({ items: [] });
  mocks.listStudentShifts.mockResolvedValue({ items: shifts });
  mocks.listStaff.mockResolvedValue({ members: [{ membershipId: 't1', user: { name: 'Cooking Tutor' } }] });
  mocks.getStudentRoster.mockResolvedValue(roster);
  mocks.listStudentAttendance.mockResolvedValue({ items: [] });
  mocks.listStudentDues.mockResolvedValue({ items: [due], totalDue: 24000 });
  mocks.createStudent.mockResolvedValue({ id: 's1' });
  mocks.getStudent.mockResolvedValue({ id: 's1', name: 'Anita', status: 'active', enrollments: [], attendance: {}, courseFeeDue: 0 });
  mocks.createStudentCourse.mockResolvedValue({ ...course, name: 'Baking' });
  mocks.collectEnrollmentFee.mockResolvedValue({ payment: { id: 'p1', amount: 4000 }, enrollment: { ...due, fees: { ...due.fees, due: 20000 } } });
  mocks.markStudentAttendance.mockImplementation(async ({ entries }) => ({
    ...roster, items: roster.items.map((item) => ({ ...item, ...entries.find((entry) => entry.enrollmentId === item.enrollmentId) })),
  }));
});

describe('Students access and navigation', () => {
  it('does not request student data while the next workspace permissions are loading', async () => {
    let resolveSession;
    mocks.getCurrentUser.mockImplementation(() => new Promise((resolve) => { resolveSession = resolve; }));
    const user = userEvent.setup();
    renderWithProviders(<><Students /><WorkspaceSwitcher /></>, { route: '/app/students', withAuth: true });
    await screen.findByText('No students found');
    mocks.listStudents.mockClear();
    mocks.listStudentCourses.mockClear();
    mocks.listStudentShifts.mockClear();
    await user.click(screen.getByRole('button', { name: 'Switch test workspace' }));
    expect(mocks.listStudents).not.toHaveBeenCalled();
    expect(mocks.listStudentCourses).not.toHaveBeenCalled();
    expect(mocks.listStudentShifts).not.toHaveBeenCalled();
    resolveSession({ businessId: 'b2', business: { id: 'b2', type: 'cafe' }, role: 'owner', businessProfile: { type: 'cafe', addons: [], modules: { students: false } } });
    expect(await screen.findByText('Students is not enabled for this business.')).toBeInTheDocument();
    expect(mocks.listStudents).not.toHaveBeenCalled();
  });
  it('does not fetch student resources or show the link without the add-on', async () => {
    setupSession({ addon: false });
    renderPage('students', { sidebar: true });
    expect(await screen.findByText('Students is not enabled for this business.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Students' })).not.toBeInTheDocument();
    expect(mocks.listStudents).not.toHaveBeenCalled();
    expect(mocks.listStudentCourses).not.toHaveBeenCalled();
    expect(mocks.listStudentShifts).not.toHaveBeenCalled();
  });
  it('routes tutor fee links to attendance and never fetches fees or the directory', async () => {
    setupSession({ role: 'staff', staffCategory: 'tutor', permissions: { studentAttendance: 'manage' } });
    renderPage('dues', { sidebar: true });
    expect(await screen.findByRole('button', { name: 'Present: Anita' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('tab=attendance');
    expect(screen.queryByRole('button', { name: 'Fee dues' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Courses & shifts' })).not.toBeInTheDocument();
    expect(mocks.listStudents).not.toHaveBeenCalled();
    expect(mocks.listStudentDues).not.toHaveBeenCalled();
    expect(mocks.listStudentCourses).not.toHaveBeenCalled();
    expect(mocks.getBusinessSettings).not.toHaveBeenCalled();
  });
  it('shows a general staff member the module when attendance permission is granted', async () => {
    setupSession({ role: 'staff', staffCategory: 'general_staff', permissions: { studentAttendance: 'manage' } });
    renderPage('attendance', { sidebar: true });
    expect(await screen.findByRole('link', { name: 'Students' })).toBeInTheDocument();
  });
  it('lets student viewers see the class but prevents marking it', async () => {
    setupSession({ role: 'staff', permissions: { students: 'view' } });
    renderPage('attendance');
    expect(await screen.findByRole('button', { name: 'Present: Anita' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save attendance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Courses & shifts' })).not.toBeInTheDocument();
  });
  it('keeps registration and collecting payments hidden for student viewers', async () => {
    setupSession({ role: 'staff', permissions: { students: 'view' } });
    renderPage('dues');
    expect(await screen.findByText('Anita')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collect payment' })).not.toBeInTheDocument();
  });
});

describe('registration and setup', () => {
  it('registers and enrolls a student atomically with both shifts and an initial payment', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Register student' }));
    const dialog = screen.getByRole('dialog', { name: 'Register student' });
    await user.type(within(dialog).getByLabelText('Name'), 'Anita');
    await user.click(within(dialog).getByLabelText('Enroll in a course now'));
    await user.selectOptions(within(dialog).getByLabelText('Course'), 'c1');
    await user.click(within(dialog).getByLabelText(/Morning/));
    await user.click(within(dialog).getByLabelText(/Evening/));
    await user.clear(within(dialog).getByLabelText('Discount'));
    await user.type(within(dialog).getByLabelText('Discount'), '1000');
    await user.clear(within(dialog).getByLabelText('Paid now'));
    await user.type(within(dialog).getByLabelText('Paid now'), '5000');
    await user.click(within(dialog).getByRole('button', { name: 'Register student' }));
    await waitFor(() => expect(mocks.createStudent).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Anita', enrollment: expect.objectContaining({ courseId: 'c1', shiftIds: ['morning', 'evening'], fee: 30000, discount: 1000, amountPaid: 5000 }),
    })));
  });
  it('saves a course duration and fee and displays normalized staff names in the tutor picker', async () => {
    const user = userEvent.setup();
    renderPage('setup');
    await user.click(await screen.findByRole('button', { name: 'Add course' }));
    const dialog = screen.getByRole('dialog', { name: 'Add course' });
    await user.type(within(dialog).getByLabelText('Name'), 'Baking');
    await user.clear(within(dialog).getByLabelText('Duration'));
    await user.type(within(dialog).getByLabelText('Duration'), '6');
    await user.selectOptions(within(dialog).getByLabelText('Duration unit'), 'week');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.createStudentCourse).toHaveBeenCalledWith(expect.objectContaining({ name: 'Baking', durationValue: 6, durationUnit: 'week', fee: 0 })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add shift' }));
    expect(screen.getByRole('option', { name: 'Cooking Tutor' })).toHaveValue('t1');
  });
  it('preserves an existing tutor category when their staff profile is saved', async () => {
    const user = userEvent.setup();
    const permissions = { students: 'none', studentAttendance: 'manage' };
    mocks.listStaff.mockResolvedValue({
      meta: {
        accessLevels: [{ key: 'none' }, { key: 'view' }, { key: 'manage' }],
        features: [{ key: 'students', label: 'Students' }, { key: 'studentAttendance', label: 'Student attendance' }],
        categories: [{ key: 'tutor', label: 'Tutor', defaultPermissions: permissions }],
      },
      summary: { maxUsers: 5, totalUsers: 1, availableSlots: 4 },
      members: [{ membershipId: 't1', role: 'staff', staffCategory: 'tutor', hasLogin: false, permissions, user: { id: 'u1', name: 'Cooking Tutor', email: '', phone: '', isActive: true } }],
    });
    mocks.updateStaff.mockResolvedValue({});
    renderWithProviders(<StaffManagement businessId="b1" />, { route: '/app/staff', withAuth: true });
    await screen.findAllByText('Cooking Tutor');
    const staffRow = screen.getByRole('row', { name: /Cooking Tutor/ });
    await user.click(within(staffRow).getByTitle('Actions'));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.type(screen.getByLabelText('Job title'), 'Chef');
    await user.click(screen.getByRole('button', { name: 'Account & Permissions' }));
    expect(screen.getByRole('button', { name: 'Use tutor permissions' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.updateStaff).toHaveBeenCalledWith('t1', expect.objectContaining({ staffCategory: 'tutor', permissions: expect.objectContaining(permissions) })));
  });
});

describe('attendance saves', () => {
  it('saves changed entries under the selected shift, including an attendance note', async () => {
    const user = userEvent.setup();
    renderPage('attendance');
    await user.click(await screen.findByRole('button', { name: 'Present: Anita' }));
    expect(screen.getByRole('button', { name: 'Fee dues' })).toBeDisabled();
    await user.type(screen.getByLabelText('Attendance note: Anita'), 'Practical class');
    await user.click(screen.getByRole('button', { name: 'Save attendance' }));
    await waitFor(() => expect(mocks.markStudentAttendance).toHaveBeenCalledWith({
      date: expect.any(String), shiftId: 'morning', entries: [{ enrollmentId: 'e1', status: 'present', note: 'Practical class' }],
    }));
    expect(await screen.findByText('Attendance saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeDisabled();
  });
  it('keeps failed marks available for retry and leaves the shift locked until discarded', async () => {
    mocks.markStudentAttendance.mockRejectedValueOnce(new Error('Connection lost'));
    const user = userEvent.setup();
    renderPage('attendance');
    await user.click(await screen.findByRole('button', { name: 'Absent: Anita' }));
    await user.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(await screen.findByText('Connection lost')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Absent: Anita' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Save attendance' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('button', { name: 'Absent: Anita' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('clears an existing mark with a null status', async () => {
    mocks.getStudentRoster.mockResolvedValue({ ...roster, items: [{ ...roster.items[0], status: 'late', note: 'Traffic' }] });
    const user = userEvent.setup();
    renderPage('attendance');
    await user.click(await screen.findByRole('button', { name: 'Clear attendance: Anita' }));
    await user.click(screen.getByRole('button', { name: 'Save attendance' }));
    await waitFor(() => expect(mocks.markStudentAttendance).toHaveBeenCalledWith(expect.objectContaining({ entries: [{ enrollmentId: 'e1', status: null, note: undefined }] })));
  });
  it('ignores an old roster response after switching shifts', async () => {
    let resolveMorning;
    mocks.getStudentRoster.mockImplementation(({ shiftId }) => shiftId === 'morning'
      ? new Promise((resolve) => { resolveMorning = resolve; })
      : Promise.resolve({ ...roster, items: [{ ...roster.items[0], name: 'Evening student' }] }));
    const user = userEvent.setup();
    renderPage('attendance');
    await waitFor(() => expect(mocks.getStudentRoster).toHaveBeenCalledWith(expect.objectContaining({ shiftId: 'morning' })));
    await user.selectOptions(screen.getByLabelText('Shift'), 'evening');
    expect(await screen.findByText('Evening student')).toBeInTheDocument();
    resolveMorning(roster);
    await waitFor(() => expect(screen.queryByText('Anita')).not.toBeInTheDocument());
  });
});

describe('fee collection', () => {
  it('lets student staff collect cash without requesting bank accounts they cannot view', async () => {
    setupSession({ role: 'staff', permissions: { students: 'manage', banking: 'none' } });
    const user = userEvent.setup();
    renderPage('dues');
    await user.click(await screen.findByRole('button', { name: 'Collect payment' }));
    expect(screen.getByLabelText('Payment method')).toHaveValue('cash');
    expect(screen.queryByRole('option', { name: 'Bank' })).not.toBeInTheDocument();
    expect(mocks.listBanks).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Payment amount'), '4000');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(mocks.collectEnrollmentFee).toHaveBeenCalledWith('e1', expect.objectContaining({ amount: 4000, paymentMethod: 'cash', bankId: null })));
  });
  it('records an installment with its date and explains oldest-bill allocation', async () => {
    const user = userEvent.setup();
    renderPage('dues');
    await user.click(await screen.findByRole('button', { name: 'Collect payment' }));
    expect(screen.getByText('Payments settle the oldest unpaid bill first.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Payment amount'), '4000');
    fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-10-09' } });
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(mocks.collectEnrollmentFee).toHaveBeenCalledWith('e1', { amount: 4000, txDate: '2026-10-09', paymentMethod: 'cash', bankId: null, note: '' }));
    expect(await screen.findByText('Payment recorded.')).toBeInTheDocument();
  });
  it('rejects overpayment without sending it and preserves API errors in the form', async () => {
    const user = userEvent.setup();
    renderPage('dues');
    await user.click(await screen.findByRole('button', { name: 'Collect payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Collect payment' });
    fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '25000' } });
    fireEvent.submit(dialog.querySelector('form'));
    expect(mocks.collectEnrollmentFee).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('no more than Rs 24,000.00');
    mocks.collectEnrollmentFee.mockRejectedValueOnce(new Error('Bank unavailable'));
    fireEvent.change(screen.getByLabelText('Payment amount'), { target: { value: '4000' } });
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Bank unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('Payment amount')).toHaveValue(4000);
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled();
  });
});
