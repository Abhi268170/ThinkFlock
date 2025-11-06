import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { Persona, ChatMessage, SessionHistoryItem } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

// --- Helper Components ---

const ThinkingIcon = () => (
    <div className="flex items-center space-x-1">
        <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></span>
    </div>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);


// --- Main Component ---

interface GroupChatPageProps {
  config: {
    topic: string;
    personas: Persona[];
    initialMessages?: ChatMessage[];
  };
  onEndSession: (completedSession: Omit<SessionHistoryItem, 'id'>) => void;
}

const GroupChatPage: React.FC<GroupChatPageProps> = ({ config, onEndSession }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(config.initialMessages || []);
  const [userInput, setUserInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPersona, setThinkingPersona] = useState<string | null>(null);
  
  // State for @mention
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  
  // State for Summary Modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const personaChats = useRef(new Map<string, Chat>());
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const personaMap = useMemo(() => {
    const map = new Map<string, Persona>();
    config.personas.forEach(p => map.set(p.name, p));
    return map;
  }, [config.personas]);

  // --- Initialization ---

  useEffect(() => {
    if (process.env.API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Initialize a separate chat session for each persona
      config.personas.forEach(p => {
        if (aiRef.current) {
          const chat = aiRef.current.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: p.systemInstruction },
          });
          personaChats.current.set(p.name, chat);
        }
      });
    } else {
      console.error("API key not found.");
      addMessage({ sender: 'System', text: 'Error: API key is not configured.' });
    }
  }, [config.personas]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Message & AI Logic ---
  
  const addMessage = (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isThinking) return;

    const newUserMessage: ChatMessage = { sender: 'user', text: userInput };
    addMessage(newUserMessage);
    const respondingPersonas = getMentionedPersonas(userInput) || config.personas;
    setUserInput('');
    setIsThinking(true);
    
    // Generate responses from personas sequentially
    for (const persona of respondingPersonas) {
      setThinkingPersona(persona.name);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between responses
      await generatePersonaResponse(persona, newUserMessage.text);
    }
    
    // Trigger persona-to-persona discussion if more than one responded
    if (respondingPersonas.length > 1) {
       setThinkingPersona("Persona Discussion");
       await new Promise(resolve => setTimeout(resolve, 1000));
       await generatePersonaDiscussion(respondingPersonas);
    }

    setIsThinking(false);
    setThinkingPersona(null);
  };
  
  const generatePersonaResponse = async (persona: Persona, userText: string) => {
    const chat = personaChats.current.get(persona.name);
    if (!chat) return;

    try {
      // Rebuild history for the chat instance if needed (or could be managed statefully)
      const history = messages
        .filter(m => m.text) // Filter out empty messages
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));

      // A cleaner, more direct prompt for the persona's turn
      const prompt = `You are ${persona.name}. The user just said: "${userText}". Based on the conversation history and your persona, what is your response?`;
      const result = await chat.sendMessage({ message: prompt });
      
      if (result.text) {
        addMessage({ sender: persona.name, text: result.text });
      }
    } catch (error) {
      console.error(`Error with ${persona.name}:`, error);
      addMessage({ sender: 'System', text: `An error occurred with ${persona.name}.` });
    }
  };
  
  const generatePersonaDiscussion = async (respondedPersonas: Persona[]) => {
      if (!aiRef.current) return;
      
      const lastMessages = messages.slice(-respondedPersonas.length);
      const discussionPrompt = `
        The user just received these responses from the brainstorming team:
        ${lastMessages.map(m => `\n- ${m.sender}: "${m.text}"`).join('')}

        As an impartial observer, write a brief, combined follow-up message as if the personas are discussing their points among themselves. Start with "The team is discussing...". The message should build on their ideas and show collaboration.
      `;
      
      try {
        const response = await aiRef.current.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: discussionPrompt
        });
        if (response.text) {
          addMessage({ sender: 'Persona Discussion', text: response.text });
        }
      } catch (error) {
        console.error("Error generating persona discussion:", error);
      }
  };

  // --- @Mention Logic ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1 && !text.substring(lastAt + 1).includes(' ')) {
      setMentionQuery(text.substring(lastAt + 1).toLowerCase());
    } else {
      setMentionQuery(null);
    }
    setUserInput(text);
  };

  const handleMentionSelect = (name: string) => {
    const lastAt = userInput.lastIndexOf('@');
    setUserInput(userInput.substring(0, lastAt) + `@${name} `);
    setMentionQuery(null);
    inputRef.current?.focus();
  };
  
  const getMentionedPersonas = (text: string): Persona[] | null => {
    const mentions = text.match(/@(\w+\s?\w*)/g);
    if (!mentions) return null;
    const names = mentions.map(m => m.substring(1));
    return config.personas.filter(p => names.includes(p.name));
  };
  
  const filteredPersonas = useMemo(() => {
    if (mentionQuery === null) return [];
    return config.personas.filter(p => p.name.toLowerCase().startsWith(mentionQuery));
  }, [mentionQuery, config.personas]);
  
  // --- Summary Logic ---
  
  const handleTriggerSummary = async () => {
    setIsSummarizing(true);
    setShowSummaryModal(true);

    if (!aiRef.current) {
        setSummary("Error: AI client not available.");
        setIsSummarizing(false);
        return;
    }
    
    const chatHistory = messages
        .map(m => `${m.sender}: ${m.text}`)
        .join('\n\n');
        
    const summaryPrompt = `Please summarize the following brainstorming session about "${config.topic}". The participants were User, and ${config.personas.map(p => p.name).join(', ')}. The summary should be concise and well-structured. Use markdown formatting. Include these sections:
    
    ### Key Ideas
    - A bulleted list of the main concepts discussed.
    
    ### Action Items
    - A bulleted list of actionable next steps.
    
    ### Diverse Perspectives
    - Briefly mention any significant differing viewpoints from the personas.
    
    Here is the chat history:
    ---
    ${chatHistory}
    ---
    `;

    try {
        const response = await aiRef.current.models.generateContent({
            model: "gemini-2.5-flash",
            contents: summaryPrompt
        });
        setSummary(response.text);
    } catch (error) {
        console.error("Error generating summary:", error);
        setSummary("Failed to generate summary. Please try again.");
    } finally {
        setIsSummarizing(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(summary).then(() => {
        // Simple feedback: maybe a toast notification in a real app
        const button = document.getElementById('copy-button');
        if (button) {
            button.innerText = 'Copied!';
            setTimeout(() => { button.innerText = 'Copy to Clipboard'; }, 2000);
        }
    });
  };
  
  const handleDownloadPdf = () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Session Summary</title>');
      printWindow.document.write('<style>body { font-family: sans-serif; line-height: 1.6; } h1, h2, h3 { margin-bottom: 0.5em; } ul { padding-left: 20px; } .metadata { margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #ccc; } </style>');
      printWindow.document.write('</head><body>');
      
      const sessionDate = new Date().toLocaleDateString();
      const participants = ['User', ...config.personas.map(p => p.name)].join(', ');
      
      printWindow.document.write(`<div class="metadata"><h1>Session Summary</h1><p><strong>Topic:</strong> ${config.topic}</p><p><strong>Date:</strong> ${sessionDate}</p><p><strong>Participants:</strong> ${participants}</p></div>`);
      
      // Convert summary markdown to basic HTML for printing
      let summaryHtml = summary
          .replace(/### (.*)/g, '<h3>$1</h3>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\* ([^*]+)/g, '<ul><li>$1</li></ul>')
          .replace(/<\/ul>\s*<ul>/g, ''); // Merge adjacent lists
      
      printWindow.document.write(summaryHtml);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  const handleCloseSummaryAndEnd = () => {
    setShowSummaryModal(false);
    onEndSession({
      topic: config.topic,
      personas: config.personas,
      messages: messages,
    });
  };

  // --- UI Helpers ---
  
  const getInitials = (name: string) => {
    if (name === 'user') return 'U';
    if (name === 'System') return 'S';
    if (name === 'Persona Discussion') return 'PD';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  // --- Render ---

  return (
    <>
      <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">{config.topic}</h1>
            <button
              onClick={handleTriggerSummary}
              className="px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 transition-colors"
            >
              End Session
            </button>
        </div>

        {/* Participants Header */}
        <div className="flex items-center p-3 space-x-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-x-auto">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 flex-shrink-0">Participants:</span>
            <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold bg-indigo-500">U</div>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">You</span>
                </div>
                {config.personas.map(persona => (
                    <div key={persona.name} className="flex items-center space-x-2 flex-shrink-0">
                        <img src={persona.avatarUrl} alt={persona.name} className="w-8 h-8 rounded-full object-cover" />
                        <span className="text-sm font-medium text-gray-800 dark:text-white">{persona.name}</span>
                    </div>
                ))}
            </div>
        </div>


        {/* Chat Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
               {msg.sender !== 'user' && (() => {
                  const persona = personaMap.get(msg.sender);
                  if (persona) {
                    return <img src={persona.avatarUrl} alt={persona.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />;
                  }
                  return ( // Fallback for System, Persona Discussion
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold bg-gray-400">
                      {getInitials(msg.sender)}
                    </div>
                  );
                })()}

              <div className={`max-w-xl p-3 rounded-lg ${
                msg.sender === 'user' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {msg.sender !== 'user' && <p className="font-bold text-sm mb-1">{msg.sender}</p>}
                <MarkdownRenderer content={msg.text} />
              </div>

               {msg.sender === 'user' && (
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold bg-indigo-500">
                  {getInitials(msg.sender)}
                </div>
              )}
            </div>
          ))}

          {isThinking && (
             <div className="flex items-start gap-3">
                {(() => {
                  const persona = thinkingPersona ? personaMap.get(thinkingPersona) : null;
                  if (persona) {
                    return <img src={persona.avatarUrl} alt={persona.name} className="w-10 h-10 rounded-full flex-shrink-0 object-cover" />;
                  }
                  return (
                    <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600">
                        {thinkingPersona ? getInitials(thinkingPersona) : <ThinkingIcon />}
                    </div>
                  );
                })()}
                <div className="max-w-md p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <p className="font-bold text-sm mb-1 text-gray-800 dark:text-gray-200">{thinkingPersona || 'Team'} is thinking...</p>
                </div>
              </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 relative">
          {mentionQuery !== null && filteredPersonas.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
              {filteredPersonas.map(p => (
                <div 
                  key={p.name}
                  onClick={() => handleMentionSelect(p.name)}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                >
                  <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={userInput}
              onChange={handleInputChange}
              placeholder="Type your message or use '@' to mention..."
              disabled={isThinking}
              className="flex-grow w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 dark:text-white transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isThinking || !userInput.trim()}
              className="flex-shrink-0 p-3.5 border border-transparent rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-all duration-300"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      </div>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Session Summary</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{config.topic}</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <ThinkingIcon />
                  <p className="mt-4 text-gray-600 dark:text-gray-300">Generating your summary...</p>
                </div>
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownRenderer content={summary} />
                </div>
              )}
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex flex-wrap justify-end gap-3">
               <button id="copy-button" onClick={handleCopyToClipboard} disabled={isSummarizing} className="px-4 py-2 text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-300 dark:bg-indigo-900/50 dark:hover:bg-indigo-900 focus:outline-none disabled:opacity-50">
                Copy to Clipboard
              </button>
              <button onClick={handleDownloadPdf} disabled={isSummarizing} className="px-4 py-2 text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-300 dark:bg-indigo-900/50 dark:hover:bg-indigo-900 focus:outline-none disabled:opacity-50">
                Download PDF
              </button>
              <button onClick={handleCloseSummaryAndEnd} className="px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50">
                Finish & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GroupChatPage;