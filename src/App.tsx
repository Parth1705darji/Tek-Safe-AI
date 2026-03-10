import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import OfflineBanner from './components/common/OfflineBanner';
import ChatwootWidget from './components/common/ChatwootWidget';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthWrapper from './components/auth/AuthWrapper';
import { Shield } from 'lucide-react';

// Lazy-load all pages for code-splitting
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ToolsPage = lazy(() => import('./pages/ToolsPage'));

// Full-screen loader shown during lazy page loads
function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-light-bg dark:bg-dark-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 dark:bg-accent/20">
          <Shield className="h-6 w-6 animate-pulse text-accent" />
        </div>
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce-dot rounded-full bg-accent" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 animate-bounce-dot rounded-full bg-accent" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 animate-bounce-dot rounded-full bg-accent" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <OfflineBanner />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AuthWrapper>
                    <ChatPage />
                  </AuthWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:conversationId"
              element={
                <ProtectedRoute>
                  <AuthWrapper>
                    <ChatPage />
                  </AuthWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AuthWrapper>
                    <ProfilePage />
                  </AuthWrapper>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools/:tool"
              element={
                <ProtectedRoute>
                  <AuthWrapper>
                    <ToolsPage />
                  </AuthWrapper>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
        <ChatwootWidget />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
