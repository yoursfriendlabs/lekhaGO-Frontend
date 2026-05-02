import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { InlineTabs, SectionCard } from '../components/StaffPrimitives';
import AttendancePage from './AttendancePage';
import DirectoryPage from './DirectoryPage';
import LeavePage from './LeavePage';
import OvertimePage from './OvertimePage';
import PayrollRunDetailPage from './PayrollRunDetailPage';
import PayrollRunsPage from './PayrollRunsPage';
import ProfilePage from './ProfilePage';
import RosterPage from './RosterPage';
import ShiftsPage from './ShiftsPage';

function LegacyStaffRedirect() {
  const { legacyStaffId = '' } = useParams();
  return <Navigate to={`/app/staff/profile/${legacyStaffId}`} replace />;
}

export default function StaffRoutes() {
  return (
    <div className="space-y-6">
      <SectionCard className="space-y-0 !p-4">
        <InlineTabs
          items={[
            { to: '/app/staff', label: 'Directory' },
            { to: '/app/staff/shifts', label: 'Shift Templates' },
            { to: '/app/staff/roster', label: 'Roster' },
            { to: '/app/staff/attendance', label: 'Attendance' },
            { to: '/app/staff/overtime', label: 'Overtime' },
            { to: '/app/staff/leave', label: 'Leave' },
            { to: '/app/staff/payroll', label: 'Payroll' },
          ]}
        />
      </SectionCard>

      <Routes>
        <Route index element={<DirectoryPage />} />
        <Route path="profile/:staffId" element={<ProfilePage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="roster" element={<RosterPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="overtime" element={<OvertimePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollRunsPage />} />
        <Route path="payroll/:runId" element={<PayrollRunDetailPage />} />
        <Route path=":legacyStaffId" element={<LegacyStaffRedirect />} />
        <Route path="*" element={<Navigate to="/app/staff" replace />} />
      </Routes>
    </div>
  );
}
