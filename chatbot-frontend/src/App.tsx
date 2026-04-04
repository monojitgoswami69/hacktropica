import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import DashboardLayout from "@/layouts/DashboardLayout";
import ChatPage from "@/pages/ChatPage";
import ExamPreparationPage from "@/pages/ExamPreparationPage";
import ResourcesPage from "@/pages/ResourcesPage";
import QuizTakingPage from "@/pages/QuizTakingPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login / root route */}
        <Route path="/" element={<LoginPage />} />

        {/* Dashboard routes (protected by DashboardLayout) */}
        <Route element={<DashboardLayout />}>
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/exam" element={<ExamPreparationPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
        </Route>

        {/* Quiz route is standalone (full screen - outside dashboard layout) */}
        <Route path="/exam/quiz" element={<QuizTakingPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
