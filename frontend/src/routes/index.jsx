import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import CreateSurveyPage from "../pages/CreateSurveyPage";
import SurveysPage from "../pages/SurveysPage";
import PermissionsPage from "../pages/PermissionsPage";
import ProjectAnalyticsPage from "../pages/ProjectAnalyticsPage";
import PublicSurveyPage from "../pages/PublicSurveyPage";
import DataImportPage from "../pages/DataImportPage";
import ClientsProjectsPage from "../pages/ClientsProjectsPage";
import FeedbackCategoriesPage from "../pages/FeedbackCategoriesPage";
import QuestionsPage from "../pages/QuestionsPage";
import AuditLogPage from "../pages/AuditLogPage";
import UserResultsPage from "../pages/UserResultsPage";
import NotFoundPage from "../pages/NotFoundPage";
import { useAuth } from "../context/AuthContext";

function RoleLandingRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return user?.role === "Admin" ? <Navigate to="/dashboard" replace /> : <Navigate to="/surveys/new" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Public Client Survey Response Route (No auth required) */}
      <Route path="/s/:token" element={<PublicSurveyPage />} />

      {/* Role-based landing redirects */}
      <Route path="/" element={<RoleLandingRedirect />} />
      <Route path="/app" element={<RoleLandingRedirect />} />

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Common Authorized Routes */}
        <Route path="/dashboard" element={<SurveysPage />} />
        <Route path="/surveys" element={<Navigate to="/dashboard" replace />} />
        <Route path="/surveys/new" element={<CreateSurveyPage />} />

        {/* PMO User Results Route */}
        <Route path="/results" element={<UserResultsPage />} />

        {/* Admin Only Routes (Blocked with 403 / Redirect for PMO Users) */}
        <Route
          path="/data-import"
          element={
            <ProtectedRoute requiredRole="Admin">
              <DataImportPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clients-projects"
          element={
            <ProtectedRoute requiredRole="Admin">
              <ClientsProjectsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/categories"
          element={
            <ProtectedRoute requiredRole="Admin">
              <FeedbackCategoriesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/question-bank"
          element={
            <ProtectedRoute requiredRole="Admin">
              <QuestionsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/permissions"
          element={
            <ProtectedRoute requiredRole="Admin">
              <PermissionsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute requiredRole="Admin">
              <AuditLogPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/projects/:projectId"
          element={
            <ProtectedRoute requiredRole="Admin">
              <ProjectAnalyticsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
