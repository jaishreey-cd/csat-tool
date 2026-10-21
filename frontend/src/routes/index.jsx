import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import CreateSurveyPage from "../pages/CreateSurveyPage";
import SurveysPage from "../pages/SurveysPage";
import PermissionsPage from "../pages/PermissionsPage";
import ProjectAnalyticsPage from "../pages/ProjectAnalyticsPage";
import PublicSurveyPage from "../pages/PublicSurveyPage";
import NotFoundPage from "../pages/NotFoundPage";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Public Client Survey Response Route (No auth required) */}
      <Route path="/s/:token" element={<PublicSurveyPage />} />

      {/* Redirect / and /app directly to /surveys/new */}
      <Route path="/" element={<Navigate to="/surveys/new" replace />} />
      <Route path="/app" element={<Navigate to="/surveys/new" replace />} />

      {/* Protected App Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Create Survey Stepper Wizard (Primary landing route after login) */}
        <Route path="/surveys/new" element={<CreateSurveyPage />} />

        {/* Main Dashboard: Team-wise Analytics & Dispatched Surveys */}
        <Route path="/dashboard" element={<SurveysPage />} />
        <Route path="/surveys" element={<Navigate to="/dashboard" replace />} />

        {/* Permissions & User Access Route (Admin Only) */}
        <Route
          path="/permissions"
          element={
            <ProtectedRoute requiredRole="Admin">
              <PermissionsPage />
            </ProtectedRoute>
          }
        />

        {/* Inside Project Analytics Dashboard (Admin Only) */}
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
