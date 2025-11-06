export interface User {
  id: string;
  email: string;
  hashedPassword?: string; 
}

export interface Persona {
  name: string;
  description: string;
  systemInstruction: string;
}

export interface ChatMessage {
  sender: string; // 'user' or persona.name
  text: string;
}

export interface SessionHistoryItem {
  id: string;
  topic: string;
  personas: Persona[];
  messages: ChatMessage[];
}
