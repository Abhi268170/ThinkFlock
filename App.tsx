import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import GroupChatPage from './components/GroupChatPage';
import { Persona, ChatMessage, SessionHistoryItem } from './types';

interface SessionConfig {
  topic: string;
  personas: Persona[];
  initialMessages?: ChatMessage[];
}

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const handleStartBrainstorming = (topic: string, personas: Persona[], initialMessages?: ChatMessage[]) => {
    setSessionConfig({ topic, personas, initialMessages });
  };

  const handleEndSession = (completedSession: Omit<SessionHistoryItem, 'id'>) => {
    setSessionHistory(prevHistory => {
      const newHistoryItem = { ...completedSession, id: Date.now().toString() };
      // Avoid duplicates if a session is reopened and saved again. A real app might update instead.
      const filteredHistory = prevHistory.filter(h => h.topic !== completedSession.topic);
      return [...filteredHistory, newHistoryItem];
    });
    setSessionConfig(null);
  };
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      {!user ? (
        <LoginPage />
      ) : sessionConfig ? (
        <GroupChatPage 
          key={sessionConfig.topic} // Force re-mount for new sessions
          config={sessionConfig} 
          onEndSession={handleEndSession} 
        />
      ) : (
        <DashboardPage 
          onStartBrainstorming={handleStartBrainstorming} 
          sessionHistory={sessionHistory} 
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
