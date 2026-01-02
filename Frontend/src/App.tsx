import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { usePrefetchData } from './hooks/usePrefetchData';
import LoginForm from './components/Auth/LoginForm';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Jobs from './pages/Jobs';
import Transactions from './pages/Transactions';
import Verifications from './pages/Verifications';
import Activity from './pages/Activity';
import Flagged from './pages/Flagged';
import Support from './pages/Support';
import Settings from './pages/Settings';
import LoadingSpinner from './components/UI/LoadingSpinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
        <div className="ml-4">
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <>{children}</>;
};

const DataPrefetcher: React.FC = () => {
  usePrefetchData();
  return null;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated && <DataPrefetcher />}
      <Routes>
        <Route path="/" element={<ProtectedRoute><Layout title="Dashboard"><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Layout title="All Users"><Users /></Layout></ProtectedRoute>} />
        <Route path="/users/customers" element={<ProtectedRoute><Layout title="Customers"><Users /></Layout></ProtectedRoute>} />
        <Route path="/users/providers" element={<ProtectedRoute><Layout title="Service Providers"><Users /></Layout></ProtectedRoute>} />
        <Route path="/users/flagged" element={<ProtectedRoute><Layout title="Flagged & Suspended"><Users /></Layout></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute><Layout title="Jobs"><Jobs /></Layout></ProtectedRoute>} />
        <Route path="/transactions/fee-records" element={<ProtectedRoute><Layout title="Fee Records"><Transactions /></Layout></ProtectedRoute>} />
        <Route path="/transactions/top-up" element={<ProtectedRoute><Layout title="Top-up Transactions"><Transactions /></Layout></ProtectedRoute>} />
        <Route path="/transactions/cashout" element={<ProtectedRoute><Layout title="Cashout Transactions"><Transactions /></Layout></ProtectedRoute>} />
        <Route path="/transactions/refund" element={<ProtectedRoute><Layout title="Refund Transactions"><Transactions /></Layout></ProtectedRoute>} />
        <Route path="/verifications" element={<ProtectedRoute><Layout title="User Verifications"><Verifications /></Layout></ProtectedRoute>} />
        <Route path="/activity" element={<ProtectedRoute><Layout title="Activity Feed"><Activity /></Layout></ProtectedRoute>} />
        <Route path="/flagged" element={<ProtectedRoute><Layout title="Flagged"><Flagged /></Layout></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Layout title="Support Center"><Support /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout title="Settings"><Settings /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <AppRoutes />
              <Toaster
                position="top-right"
                toastOptions={{
                  className: 'bg-white shadow-lg border border-gray-200',
                  duration: 4000,
                }}
              />
            </div>
          </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;