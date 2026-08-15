import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { LandingPage } from '../pages/public/LandingPage.jsx';
import { LoginPage } from '../pages/public/LoginPage.jsx';
import { SignupPage } from '../pages/public/SignupPage.jsx';
import { NotFoundPage } from '../pages/public/NotFoundPage.jsx';

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
      </Route>
      <Route path="/player" element={<Navigate to="/player/dashboard" replace />} />
      <Route path="/organizer" element={<Navigate to="/organizer/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
