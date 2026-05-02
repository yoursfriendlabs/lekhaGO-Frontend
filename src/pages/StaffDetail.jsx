import { Navigate, useParams } from 'react-router-dom';

export default function StaffDetailRedirect() {
  const { staffId = '' } = useParams();
  return <Navigate to={`/app/staff/profile/${staffId}`} replace />;
}
