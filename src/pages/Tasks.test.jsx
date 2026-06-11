import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Tasks from './Tasks.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { BusinessSettingsProvider } from '../lib/businessSettings.jsx';
import { SnackbarProvider } from '../lib/snackbar.jsx';

const apiMocks = vi.hoisted(() => ({
  getTaskMeta: vi.fn(),
  listTasks: vi.fn(),
  getTask: vi.fn(),
  listStaff: vi.fn(),
  getBusinessSettings: vi.fn(),
  getBusinessProfile: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual('../lib/api');

  return {
    ...actual,
    api: {
      ...actual.api,
      getTaskMeta: apiMocks.getTaskMeta,
      listTasks: apiMocks.listTasks,
      getTask: apiMocks.getTask,
      listStaff: apiMocks.listStaff,
      getBusinessSettings: apiMocks.getBusinessSettings,
      getBusinessProfile: apiMocks.getBusinessProfile,
    },
  };
});

function renderTasksPage(route = '/app/tasks') {
  return renderWithProviders(
    <SnackbarProvider>
      <BusinessSettingsProvider>
        <Tasks />
      </BusinessSettingsProvider>
    </SnackbarProvider>,
    { route, withAuth: true }
  );
}

describe('Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('mms_token', 'token-123');
    window.localStorage.setItem('mms_role', 'owner');
    window.localStorage.setItem('mms_business_id', 'business-123');
    window.localStorage.setItem(
      'mms_user',
      JSON.stringify({ id: 'user-1', name: 'Owner User', role: 'owner', emailVerified: true })
    );
    window.localStorage.setItem(
      'mms_business_profile',
      JSON.stringify({
        enabledModules: ['dashboard'],
        modules: { dashboard: true, tasks: false },
      })
    );
    window.localStorage.setItem(
      'mms_access_control',
      JSON.stringify({
        role: 'owner',
        permissions: {
          tasks: 'manage',
        },
      })
    );
    window.localStorage.setItem(
      'mms_subscription',
      JSON.stringify({
        currentPlan: {
          key: 'growth',
          label: 'Growth',
          subscriptionStatus: 'active',
        },
        access: {
          canUseApplication: true,
          planKey: 'growth',
          subscriptionStatus: 'active',
        },
      })
    );

    apiMocks.getTaskMeta.mockResolvedValue({
      statuses: [
        { key: 'todo', label: 'To do' },
        { key: 'in_progress', label: 'In progress' },
        { key: 'completed', label: 'Completed' },
      ],
      priorities: [
        { key: 'low', label: 'Low' },
        { key: 'medium', label: 'Medium' },
        { key: 'high', label: 'High' },
      ],
      activityTypes: [
        { key: 'created', label: 'Created' },
        { key: 'commented', label: 'Commented' },
      ],
    });
    apiMocks.listTasks.mockResolvedValue({
      items: [
        {
          id: 'task-1',
          title: 'Count warehouse stock',
          description: 'Reconcile physical stock with the system.',
          status: 'todo',
          priority: 'high',
          dueDate: '2026-06-12',
          creator: { id: 'user-1', name: 'Owner User' },
          assignments: [{ userId: 'user-2', user: { id: 'user-2', name: 'Sita' } }],
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    apiMocks.getTask.mockResolvedValue({
      task: {
        id: 'task-1',
        title: 'Count warehouse stock',
        description: 'Checklist: aisle A, aisle B, back room.',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-06-12',
        creator: { id: 'user-1', name: 'Owner User' },
        assignments: [{ userId: 'user-2', user: { id: 'user-2', name: 'Sita' } }],
        activities: [
          {
            id: 'activity-1',
            type: 'created',
            createdAt: '2026-06-10T10:00:00.000Z',
            actor: { id: 'user-1', name: 'Owner User' },
            content: 'Initial task created.',
          },
        ],
      },
    });
    apiMocks.listStaff.mockResolvedValue({
      members: [{ id: 'staff-1', user: { id: 'user-2', name: 'Sita' } }],
    });
    apiMocks.getBusinessSettings.mockResolvedValue({});
    apiMocks.getBusinessProfile.mockResolvedValue({
      enabledModules: ['dashboard'],
      modules: { dashboard: true, tasks: false },
    });
  });

  it('opens the task detail flow from the card view action', async () => {
    renderTasksPage();

    expect(await screen.findByText('Count warehouse stock')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Actions'));
    fireEvent.click(await screen.findByRole('link', { name: 'View' }));

    await waitFor(() => {
      expect(apiMocks.getTask).toHaveBeenCalledWith('task-1');
    });

    expect(await screen.findByText('Checklist: aisle A, aisle B, back room.')).toBeInTheDocument();
    expect(screen.getByText('Initial task created.')).toBeInTheDocument();
  });
});
