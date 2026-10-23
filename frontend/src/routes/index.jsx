import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import CreateSurveyPage from "../pages/CreateSurveyPage";
import SurveysPage from "../pages/SurveysPage";
import PermissionsPage from "../pages/PermissionsPage";
import QuestionsPage from "../pages/QuestionsPage";
import UserResultsPage from "../pages/UserResultsPage";
import ProjectAnalyticsPage from "../pages/ProjectAnalyticsPage";
import ClientResponsePage from "../pages/ClientResponsePage";
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

        {/* Question Bank Route (Admin Only) */}
        <Route
          path="/question-bank"
          element={
            <ProtectedRoute requiredRole="Admin">
              <QuestionsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/questions" element={<Navigate to="/question-bank" replace />} />

        {/* Permissions & User Access Route (Admin Only) */}
        <Route
          path="/permissions"
          element={
            <ProtectedRoute requiredRole="Admin">
              <PermissionsPage />
            </ProtectedRoute>
          }
        />

        {/* User Survey Results Route */}
        <Route path="/results" element={<UserResultsPage />} />

        {/* Inside Project Analytics Dashboard */}
        <Route path="/projects/:projectId" element={<ProjectAnalyticsPage />} />

        {/* Client Submitted Response Evaluation */}
        <Route path="/responses/:responseId" element={<ClientResponsePage />} />
        <Route path="/surveys/:surveyId/response" element={<ClientResponsePage />} />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
