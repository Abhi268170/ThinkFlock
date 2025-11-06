export interface User {
  id: string;
  email: string;
  hashedPassword: string;
}

export type PublicUser = Omit<User, 'hashedPassword'>;

export interface Persona {
  name: string;
  description: string;
  systemInstruction: string;
  avatarUrl: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
}

export interface SessionHistoryItem {
  id: string;
  topic: string;
  personas: Persona[];
  messages: ChatMessage[];
}
