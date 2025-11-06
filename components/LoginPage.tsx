
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'signup';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const { login, signUp, loading, error, clearError } = useAuth();

  useEffect(() => {
    clearError();
    setEmail('');
    setPassword('');
  }, [mode, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      // Error is already handled and set in the context
      console.error(err);
    }
  };
  
  const TabButton: React.FC<{
    label: string;
    currentMode: AuthMode;
    targetMode: AuthMode;
    onClick: () => void;
  }> = ({ label, currentMode, targetMode, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full py-3 text-lg font-semibold transition-colors duration-300 focus:outline-none ${
        currentMode === targetMode
          ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
          : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden">
        <div className="flex">
          <TabButton label="Login" currentMode={mode} targetMode="login" onClick={() => setMode('login')} />
          <TabButton label="Sign Up" currentMode={mode} targetMode="signup" onClick={() => setMode('signup')} />
        </div>
        <div className="p-8 sm:p-10">
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-2">
            {mode === 'login' ? 'Welcome Back!' : 'Create Account'}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
            {mode === 'login' ? 'Sign in to continue' : 'Get started with your new account'}
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white transition"
                placeholder="••••••••"
              />
            </div>
            
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-300"
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  mode === 'login' ? 'Login' : 'Sign Up'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
