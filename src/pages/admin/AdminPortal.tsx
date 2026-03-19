import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import DashboardOverview from './pages/DashboardOverview';
import KBManager from './pages/KBManager';
import UserManagement from './pages/UserManagement';
import AnalyticsPage from './pages/AnalyticsPage';
import SystemHealth from './pages/SystemHealth';

const AdminPortal = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<DashboardOverview />} />
        <Route path="kb" element={<KBManager />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="system" element={<SystemHealth />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
};

export default AdminPortal;
