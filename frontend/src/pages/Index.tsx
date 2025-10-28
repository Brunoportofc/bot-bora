
import React from 'react';
import Layout from '@/components/Layout';
import LoginForm from '@/components/LoginForm';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading, login, logout, isAuthenticated } = useAuth();

  // Debug logs
  console.log('🔍 Estado da autenticação:', {
    user,
    loading,
    isAuthenticated
  });

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <LoginForm onLogin={login} />
      </Layout>
    );
  }

  return (
    <Layout>
      <Dashboard onLogout={logout} userEmail={user?.email || ''} />
    </Layout>
  );
};

export default Index;
