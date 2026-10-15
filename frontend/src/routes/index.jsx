import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import CreateSurveyPage from "../pages/CreateSurveyPage";
import SurveysPage from "../pages/SurveysPage";
import ProjectAnalyticsPage from "../pages/ProjectAnalyticsPage";
import ComingSoonPage from "../pages/ComingSoonPage";
import PublicSurveyPage from "../pages/PublicSurveyPage";
import NotFoundPage from "../pages/NotFoundPage";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Public Client Survey Response Route (No auth required) */}
      <Route path="/s/:token" element={<PublicSurveyPage />} />

      {/* Redirect / and /app to /dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />

      {/* Protected App Routes inside Minimal App Shell */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Main Dashboard / Analytics */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Project Analytics Dashboard */}
        <Route path="/projects/:projectId" element={<ProjectAnalyticsPage />} />

        {/* Create Survey Stepper Wizard */}
        <Route path="/surveys/new" element={<CreateSurveyPage />} />

        {/* Surveys List & Management */}
        <Route path="/surveys" element={<SurveysPage />} />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
