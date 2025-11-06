import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleGenAI, Type } from "@google/genai";
import { Persona, SessionHistoryItem } from '../types';

interface DashboardPageProps {
  onStartBrainstorming: (topic: string, personas: Persona[], initialMessages?: SessionHistoryItem['messages']) => void;
  sessionHistory: SessionHistoryItem[];
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onStartBrainstorming, sessionHistory }) => {
  const { user, logout } = useAuth();
  const [topic, setTopic] = useState('');
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [generatedPersonas, setGeneratedPersonas] = useState<Persona[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Persona[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGeneratePersonas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }
    setLoadingPersonas(true);
    setError(null);
    setGeneratedPersonas([]);
    setSelectedPersonas([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate 4 distinct user personas for a brainstorming session about '${topic}'. For each persona, provide a name (e.g., 'Creative Marketer'), a one-sentence description of their perspective, and a detailed system instruction for an AI agent that will play this role. The system instruction should define their personality, tone, and typical focus areas.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                systemInstruction: { type: Type.STRING },
              },
              required: ['name', 'description', 'systemInstruction'],
            },
          },
        },
      });
      
      const personas = JSON.parse(response.text);
      setGeneratedPersonas(personas);

    } catch (err) {
      console.error("Error generating personas:", err);
      setError("Failed to generate personas. Please try again.");
    } finally {
      setLoadingPersonas(false);
    }
  };
  
  const handlePersonaSelection = (persona: Persona, isSelected: boolean) => {
    if (isSelected) {
      setSelectedPersonas(prev => [...prev, persona]);
    } else {
      setSelectedPersonas(prev => prev.filter(p => p.name !== persona.name));
    }
  };
  
  const handleReopenSession = (session: SessionHistoryItem) => {
    onStartBrainstorming(session.topic, session.personas, session.messages);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-8 sm:p-12 relative">
        <div className="absolute top-6 right-6">
           <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
          >
            Logout
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-2">
            Brainstorming Session
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-8">
            Welcome, <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span>! Start a new session or reopen a past one.
          </p>
        </div>

        <form onSubmit={handleGeneratePersonas} className="space-y-4 mb-8">
          <label htmlFor="topic" className="block text-lg font-medium text-gray-700 dark:text-gray-300">
            Start a new session...
          </label>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., A new mobile app for sustainable living"
              className="flex-grow w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white transition"
            />
            <button
              type="submit"
              disabled={loadingPersonas}
              className="w-full sm:w-auto flex justify-center items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loadingPersonas ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : "Generate Personas"}
            </button>
          </div>
          {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}
        </form>

        {generatedPersonas.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Select your brainstorming team:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generatedPersonas.map((persona) => (
                <label key={persona.name} className="flex items-start p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600">
                  <input
                    type="checkbox"
                    className="h-6 w-6 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 mt-1"
                    onChange={(e) => handlePersonaSelection(persona, e.target.checked)}
                  />
                  <div className="ml-4">
                    <p className="font-bold text-gray-900 dark:text-white">{persona.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{persona.description}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="text-center pt-4">
              <button
                onClick={() => onStartBrainstorming(topic, selectedPersonas)}
                disabled={selectedPersonas.length === 0}
                className="w-full max-w-xs px-8 py-4 border border-transparent text-lg font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800 transition-transform transform hover:scale-105"
              >
                Start Brainstorming ({selectedPersonas.length} selected)
              </button>
            </div>
          </div>
        )}
      </div>

      {sessionHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-8 sm:p-12 w-full">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Past Sessions</h2>
          <ul className="space-y-3">
            {sessionHistory.map(session => (
              <li key={session.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="font-medium text-gray-800 dark:text-gray-200">{session.topic}</span>
                <button 
                  onClick={() => handleReopenSession(session)}
                  className="px-4 py-2 text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-300 dark:bg-indigo-900/50 dark:hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
                >
                  Re-open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
