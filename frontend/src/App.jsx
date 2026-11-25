import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from './context/AuthContext';

// Layout components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import CitizenRoute from './components/auth/CitizenRoute';

const IntroScreen = lazy(() => import('./pages/intro/IntroScreen'));
const LanguageSelection = lazy(() => import('./pages/intro/LanguageSelection'));
const Onboarding = lazy(() => import('./pages/intro/Onboarding'));
const CitizenDashboard = lazy(() => import('./pages/citizen/CitizenDashboard'));
const ComplaintDetail = lazy(() => import('./pages/complaints/ComplaintDetail'));
const VoiceAssistant = lazy(() => import('./pages/ai-assistant/VoiceAssistant'));
const ComplaintReporting = lazy(() => import('./pages/reporting/ComplaintReporting'));
const CitizenLogin = lazy(() => import('./pages/auth/CitizenLogin'));
const CitizenRegister = lazy(() => import('./pages/auth/CitizenRegister'));
const AdminRegister = lazy(() => import('./pages/auth/AdminRegister'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const RegionalInsights = lazy(() => import('./pages/admin/RegionalInsights'));
const MyRewards = lazy(() => import('./pages/citizen/MyRewards'));
const CustomerCare = lazy(() => import('./pages/citizen/CustomerCare'));
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'));
const AdminRewards = lazy(() => import('./pages/admin/AdminRewards'));

const PageFallback = () => (
  <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-sm font-semibold text-brand-ink">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-ink border-t-transparent" aria-hidden="true" />
    Loading Gramamitra…
  </div>
);

function App() {
  const { isLoading, authError, clearAuthError, isLocalDemoMode, isAdmin } = useAuth();
  const location = useLocation();
  const showIntroScreen = location.pathname === '/' || location.pathname === '/intro';
  const navigate = useNavigate();

  useEffect(() => {
    if (authError) {
      toast.error(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  if (isLoading) {
    return (
      <div className="bg-surface-canvas min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full border-2 border-brand-ink border-t-transparent animate-spin"></div>
          <span className="text-brand-ink font-medium">Loading Gramamitra...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-canvas text-neutral-text">
      <Toaster position="top-right" />
      {isLocalDemoMode && !showIntroScreen && (
        <p role="status" className="bg-saffron px-4 py-2 text-center text-sm font-semibold text-brand-ink">
          Frontend prototype: demo reports, photos, updates, and messages stay in this browser. Do not use real or sensitive data.
        </p>
      )}
      {showIntroScreen && (
        <Suspense fallback={<PageFallback />}>
          <IntroScreen />
        </Suspense>
      )}
      {!showIntroScreen && (
        <>
          <Navbar />
          <main className="min-h-[calc(100vh-80px)]">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/language" element={<LanguageSelection onComplete={() => navigate('/dashboard')} />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/access" element={<Navigate to="/" replace />} />

                <Route path="/login" element={<CitizenLogin />} />
                <Route path="/register" element={<CitizenRegister />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/register" element={<AdminRegister />} />

                <Route path="/dashboard" element={isAdmin ? <Navigate to="/admin" replace /> : <ProtectedRoute><CitizenDashboard /></ProtectedRoute>} />
                <Route path="/rewards" element={<CitizenRoute><MyRewards /></CitizenRoute>} />
                <Route path="/customer-care" element={<CitizenRoute><CustomerCare /></CitizenRoute>} />
                <Route path="/complaints/:id" element={<ProtectedRoute><ComplaintDetail /></ProtectedRoute>} />
                <Route path="/voice-assistant" element={<ProtectedRoute><VoiceAssistant /></ProtectedRoute>} />
                <Route path="/report" element={<ProtectedRoute><ComplaintReporting /></ProtectedRoute>} />
                <Route path="/staff-preview/*" element={<Navigate to="/dashboard" replace />} />

                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                <Route path="/admin/regional-insights" element={<AdminRoute><RegionalInsights /></AdminRoute>} />
                <Route path="/admin/rewards" element={<AdminRoute><AdminRewards /></AdminRoute>} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}

export default App;
