import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import GroupChatPage from './components/GroupChatPage';
import GroupCallPage from './components/GroupCallPage'; // New Import
import { Persona, ChatMessage, SessionHistoryItem } from './types';

interface SessionConfig {
  topic: string;
  personas: Persona[];
  initialMessages?: ChatMessage[];
}

// New type for call configuration
interface CallConfig {
  topic: string;
  personas: Persona[];
}

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [activeCallConfig, setActiveCallConfig] = useState<CallConfig | null>(null);
  const [pendingCallSummary, setPendingCallSummary] = useState<ChatMessage[] | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const handleStartBrainstorming = (topic: string, personas: Persona[], initialMessages?: ChatMessage[]) => {
    setActiveCallConfig(null);
    setSessionConfig({ topic, personas, initialMessages });
  };
  
  const handleStartCall = (topic: string, personas: Persona[]) => {
    setActiveCallConfig({ topic, personas });
  };

  const handleEndSession = (completedSession: Omit<SessionHistoryItem, 'id'>) => {
    setSessionHistory(prevHistory => {
      const newHistoryItem = { ...completedSession, id: Date.now().toString() };
      const filteredHistory = prevHistory.filter(h => h.topic !== completedSession.topic);
      return [...filteredHistory, newHistoryItem];
    });
    setSessionConfig(null);
  };

  const handleEndCall = (callTranscript: ChatMessage[]) => {
    setActiveCallConfig(null);
    setPendingCallSummary(callTranscript);
  };

  const clearPendingSummary = () => {
    setPendingCallSummary(null);
  };
  
  const renderPage = () => {
    if (!user) {
      return <LoginPage />;
    }
    if (activeCallConfig) {
      return (
        <GroupCallPage
          key={activeCallConfig.topic + '-call'}
          config={activeCallConfig}
          onEndCall={handleEndCall}
        />
      );
    }
    if (sessionConfig) {
       return (
        <GroupChatPage 
          key={sessionConfig.topic}
          config={sessionConfig} 
          onEndSession={handleEndSession}
          onStartCall={handleStartCall}
          pendingCallSummary={pendingCallSummary}
          clearPendingSummary={clearPendingSummary}
        />
      );
    }
    return (
      <DashboardPage 
        onStartBrainstorming={handleStartBrainstorming} 
        sessionHistory={sessionHistory} 
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      {renderPage()}
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