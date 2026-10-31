// App.tsx — Main router

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomeworkPage } from './pages/HomeworkPage';
import { CalendarPage } from './pages/CalendarPage';
import { TimetablePage } from './pages/TimetablePage';
import { SubjectsPage } from './pages/SubjectsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TeacherUsersPage } from './pages/TeacherUsersPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { principal, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="state-container">
        <div className="spinner" />
      </div>
    );
  }

  if (!principal) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { principal } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={principal ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/homework" element={<HomeworkPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/timetable" element={<TimetablePage />} />
                <Route path="/subjects" element={<SubjectsPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/teacher" element={<TeacherUsersPage />} />
                <Route path="/account" element={<AccountSettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
