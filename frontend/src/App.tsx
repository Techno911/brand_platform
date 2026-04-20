import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { http } from './api/http';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ApprovalsIndexPage from './pages/ApprovalsIndexPage';
import Stage1Page from './pages/wizard/Stage1Page';
import Stage2Page from './pages/wizard/Stage2Page';
import Stage3Page from './pages/wizard/Stage3Page';
import Stage4Page from './pages/wizard/Stage4Page';
import SilentFailuresPage from './pages/admin/SilentFailuresPage';
import BillingConfigPage from './pages/admin/BillingConfigPage';
import MarketerQualityPage from './pages/admin/MarketerQualityPage';
import WizardDropoffPage from './pages/admin/WizardDropoffPage';
import GoldenSetPage from './pages/admin/GoldenSetPage';
import SecurityEventsPage from './pages/admin/SecurityEventsPage';
import UsersPage from './pages/admin/UsersPage';
import ClientDetailPage from './pages/admin/ClientDetailPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import type { AuthUser, AuthTokens } from './types/api';

// Инвариант: первая загрузка — вызываем /auth/whoami. Рефреш проставляется cookie, интерсептор добавит Bearer.
// CLAUDE.md: "JWT в памяти, НЕ в localStorage" — стартовый bootstrap через refresh.
export default function App() {
  const { user, ready, setUser, setTokens, setReady } = useAuthStore();
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const refresh = await http.post<AuthTokens>('/auth/refresh', {});
        setTokens(refresh.data.accessToken, refresh.data.refreshToken);
        const me = await http.post<AuthUser>('/auth/whoami', {});
        setUser(me.data);
      } catch {
        // нет валидного refresh — не залогинен, это норма
      } finally {
        setReady(true);
      }
    })();
  }, [setTokens, setUser, setReady]);

  const isAuthenticated = !!user;
  const role = user?.globalRole ?? (user?.projectRoles?.[0]?.role ?? 'marketer');
  const isAdmin = user?.globalRole === 'chip_admin';
  // tracker видит большинство admin-страниц (кроме биллинга).
  const isTracker = user?.globalRole === 'tracker';
  const isAdminOrTracker = isAdmin || isTracker;

  if (bootError) {
    return <div className="p-6 text-red-600">{bootError}</div>;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

        <Route
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} isLoading={!ready}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:id/stage-1" element={<Stage1Page />} />
          <Route path="/projects/:id/stage-2" element={<Stage2Page />} />
          <Route path="/projects/:id/stage-3" element={<Stage3Page />} />
          <Route path="/projects/:id/stage-4" element={<Stage4Page />} />
          <Route path="/approvals" element={<ApprovalsIndexPage />} />
          <Route path="/projects/:id/approvals" element={<ApprovalsPage />} />

          {isAdminOrTracker && (
            <>
              <Route path="/admin/silent-failures" element={<SilentFailuresPage />} />
              <Route path="/admin/marketer-quality" element={<MarketerQualityPage />} />
              <Route path="/admin/wizard-dropoff" element={<WizardDropoffPage />} />
              <Route path="/admin/golden-set" element={<GoldenSetPage />} />
              <Route path="/admin/security" element={<SecurityEventsPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/users/:id" element={<UserDetailPage />} />
              <Route path="/admin/clients/:id" element={<ClientDetailPage />} />
            </>
          )}
          {/* Billing — только chip_admin, трекер сюда не ходит (маржа/себестоимость). */}
          {isAdmin && (
            <Route path="/admin/billing" element={<BillingConfigPage />} />
          )}

          {/* 404 — НЕ redirect в /dashboard (раньше глушил "пропавшие" маршруты) */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
