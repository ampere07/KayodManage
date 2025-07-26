import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import LoginForm from './components/Auth/LoginForm';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Jobs from './pages/Jobs';
import Transactions from './pages/Transactions';
import Activity from './pages/Activity';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import LoadingSpinner from './components/UI/LoadingSpinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout title="Dashboard"><Dashboard /></Layout>} />
        <Route path="/users" element={<Layout title="User Management"><Users /></Layout>} />
        <Route path="/jobs" element={<Layout title="Job Management"><Jobs /></Layout>} />
        <Route path="/transactions" element={<Layout title="Transactions"><Transactions /></Layout>} />
        <Route path="/activity" element={<Layout title="Activity Feed"><Activity /></Layout>} />
        <Route path="/alerts" element={<Layout title="Alerts"><Alerts /></Layout>} />
        <Route path="/settings" element={<Layout title="Settings"><Settings /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50">
        <AppContent />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'bg-white shadow-lg border border-gray-200',
            duration: 4000,
          }}
        />
      </div>
    </QueryClientProvider>
  );
}

export default App;