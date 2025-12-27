
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthLayout from './components/layout/AuthLayout';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminDashboard from './pages/admin/AdminDashboard';
import DashboardPage from './pages/dashboard/DashboardPage';
import LeagueDetailPage from './pages/admin/leagues/LeagueDetailPage';
import ArchetypeLibraryPage from './pages/admin/archetypes/ArchetypeLibraryPage';
import CreateTournamentPage from './pages/admin/tournaments/CreateTournamentPage';
import EditTournamentPage from './pages/admin/tournaments/EditTournamentPage';
import TournamentDashboardPage from './pages/admin/tournaments/TournamentDashboardPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Special Pending Route */}
        <Route path="/pending-approval" element={<PendingApprovalPage />} />

        {/* Protected Application Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/leagues/:leagueId/library" element={<ArchetypeLibraryPage />} />
          <Route path="/admin/leagues/:id" element={<LeagueDetailPage />} />

          {/* Tournament Routes */}
          <Route path="/admin/leagues/:leagueId/tournaments/new" element={<CreateTournamentPage />} />
          <Route path="/admin/tournaments/:id" element={<TournamentDashboardPage />} />
          <Route path="/admin/tournaments/:id/edit" element={<EditTournamentPage />} />
        </Route>

        {/* Catch All */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
