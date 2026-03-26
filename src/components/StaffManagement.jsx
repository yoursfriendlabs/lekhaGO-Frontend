import { useEffect, useState } from 'react';
import Notice from './Notice';
import { Dialog } from './ui/Dialog.tsx';
import { api } from '../lib/api';
import { formatMaybeDate } from '../lib/datetime';

const EMPTY_SUMMARY = {
  maxUsers: 5,
  totalUsers: 0,
  availableSlots: 5,
};

const EMPTY_CREATE_FORM = {
  name: '',
  email: '',
  password: '',
  phone: '',
};

const EMPTY_EDIT_FORM = {
  membershipId: '',
  name: '',
  phone: '',
  password: '',
  isActive: true,
  role: 'staff',
};

function formatDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'MMM D, YYYY');
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function EmailVerificationBadge({ emailVerified }) {
  if (emailVerified === false) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        Verification pending
      </span>
    );
  }

  if (emailVerified === true) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        Email verified
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      Verification status unknown
    </span>
  );
}

export default function StaffManagement({ businessId }) {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  const loadStaff = async () => {
    if (!businessId) {
      setSummary(EMPTY_SUMMARY);
      setMembers([]);
      return;
    }

    setLoading(true);
    try {
      const data = await api.listStaff();
      setSummary(data?.summary || EMPTY_SUMMARY);
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotice({ type: '', message: '' });
    loadStaff();
  }, [businessId]);

  const openCreate = () => {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm(EMPTY_CREATE_FORM);
  };

  const openEdit = (member) => {
    setEditForm({
      membershipId: member.membershipId,
      name: member.user?.name || '',
      phone: member.user?.phone || '',
      password: '',
      isActive: Boolean(member.user?.isActive),
      role: member.role || 'staff',
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditForm(EMPTY_EDIT_FORM);
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setCreateSaving(true);
    setNotice({ type: '', message: '' });

    try {
      await api.createStaff({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        phone: createForm.phone.trim(),
      });
      closeCreate();
      await loadStaff();
      setNotice({ type: 'success', message: 'Staff member created. They may be asked to verify email before full access.' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editForm.membershipId) return;

    setEditSaving(true);
    setNotice({ type: '', message: '' });

    const payload = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      isActive: editForm.isActive,
    };

    if (editForm.password.trim()) {
      payload.password = editForm.password;
    }

    try {
      await api.updateStaff(editForm.membershipId, payload);
      closeEdit();
      await loadStaff();
      setNotice({ type: 'success', message: 'Staff member updated successfully.' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleStatus = async (member) => {
    const membershipId = member.membershipId;
    const nextStatus = !member.user?.isActive;
    setBusyAction(`toggle:${membershipId}`);
    setNotice({ type: '', message: '' });

    try {
      await api.updateStaff(membershipId, { isActive: nextStatus });
      await loadStaff();
      setNotice({
        type: 'success',
        message: nextStatus ? 'Staff member reactivated successfully.' : 'Staff member deactivated successfully.',
      });
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusyAction('');
    }
  };

  const handleRemove = async (member) => {
    const label = member.user?.name || member.user?.email || 'this staff member';
    if (!window.confirm(`Remove ${label}?`)) return;

    setBusyAction(`remove:${member.membershipId}`);
    setNotice({ type: '', message: '' });

    try {
      await api.deleteStaff(member.membershipId);
      await loadStaff();
      setNotice({ type: 'success', message: 'Staff member removed successfully.' });
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setBusyAction('');
    }
  };

  return (
    <>
      <div className="card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg text-slate-900 dark:text-white">Staff Management</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage seats, access, and account status for your team.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={openCreate} disabled={!businessId}>
            Add Staff
          </button>
        </div>

        {notice.message ? <Notice title={notice.message} tone={notice.type || 'info'} /> : null}

        {!businessId ? (
          <Notice title="Add your Business ID before managing staff." tone="warn" />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Seats Used</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {summary.totalUsers} / {summary.maxUsers}
            </p>
            <p className="mt-1 text-sm text-slate-500">Used: {summary.totalUsers} / {summary.maxUsers}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Available Seats</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{summary.availableSlots}</p>
            <p className="mt-1 text-sm text-slate-500">Seats remaining for new staff accounts.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Joined At</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-500">Loading staff…</td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-slate-500">No staff members found.</td>
                </tr>
              ) : (
                members.map((member) => {
                  const isOwner = member.role === 'owner';
                  const toggleBusy = busyAction === `toggle:${member.membershipId}`;
                  const removeBusy = busyAction === `remove:${member.membershipId}`;

                  return (
                    <tr key={member.membershipId} className="border-t border-slate-200/70 dark:border-slate-800/70">
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">{member.user?.name || '-'}</td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <div>{member.user?.email || '-'}</div>
                          <EmailVerificationBadge emailVerified={member.user?.emailVerified} />
                        </div>
                      </td>
                      <td className="py-3 pr-4">{member.user?.phone || '-'}</td>
                      <td className="py-3 pr-4 capitalize">{member.role || '-'}</td>
                      <td className="py-3 pr-4">
                        <StatusBadge active={Boolean(member.user?.isActive)} />
                      </td>
                      <td className="py-3 pr-4">{formatDate(member.joinedAt)}</td>
                      <td className="py-3 text-right">
                        {isOwner ? (
                          <span className="text-xs font-medium text-slate-400">Read only</span>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                              onClick={() => openEdit(member)}
                              disabled={toggleBusy || removeBusy}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-amber-600 hover:text-amber-500 disabled:opacity-50"
                              onClick={() => handleToggleStatus(member)}
                              disabled={toggleBusy || removeBusy}
                            >
                              {toggleBusy ? 'Saving…' : member.user?.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                              type="button"
                              className="text-rose-600 hover:text-rose-500 disabled:opacity-50"
                              onClick={() => handleRemove(member)}
                              disabled={toggleBusy || removeBusy}
                            >
                              {removeBusy ? 'Removing…' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog isOpen={createOpen} onClose={closeCreate} title="Create Staff" size="md">
        <form className="space-y-4" onSubmit={handleCreateSubmit}>
          <div>
            <label className="label" htmlFor="staff-name">Name</label>
            <input
              id="staff-name"
              className="input mt-1"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="staff-email">Email</label>
            <input
              id="staff-email"
              className="input mt-1"
              type="email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="staff-phone">Phone</label>
            <input
              id="staff-phone"
              className="input mt-1"
              value={createForm.phone}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="staff-password">Password</label>
            <input
              id="staff-password"
              className="input mt-1"
              type="password"
              value={createForm.password}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </div>
          <p className="text-xs text-slate-500">This business can have up to {summary.maxUsers} total users, including the owner.</p>
          <p className="text-xs text-slate-500">Invited staff may need to verify their email before the rest of the workspace opens.</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={closeCreate} disabled={createSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={createSaving}>
              {createSaving ? 'Creating…' : 'Create Staff'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={editOpen} onClose={closeEdit} title="Edit Staff" size="md">
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <div>
            <label className="label" htmlFor="edit-staff-name">Name</label>
            <input
              id="edit-staff-name"
              className="input mt-1"
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-staff-phone">Phone</label>
            <input
              id="edit-staff-phone"
              className="input mt-1"
              value={editForm.phone}
              onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-staff-password">New Password</label>
            <input
              id="edit-staff-password"
              className="input mt-1"
              type="password"
              value={editForm.password}
              onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Role</p>
            <p className="mt-1 text-sm capitalize text-slate-700 dark:text-slate-300">{editForm.role}</p>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active account
          </label>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" className="btn-ghost" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
