import { User, PublicUser } from '../types';

const USERS_STORAGE_KEY = 'brainstorm_app_users';

// Load users from sessionStorage on startup
const loadUsers = (): User[] => {
  try {
    const storedUsers = sessionStorage.getItem(USERS_STORAGE_KEY);
    if (storedUsers) {
      return JSON.parse(storedUsers);
    }
  } catch (e) {
    console.error("Failed to parse users from sessionStorage:", e);
  }
  return [];
};

// Save users to sessionStorage
const saveUsers = (users: User[]) => {
  try {
    sessionStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error("Failed to save users to sessionStorage:", e);
  }
};


// In-memory user store for the PoC, initialized from sessionStorage
let users: User[] = loadUsers();


// Simple password hashing function for the PoC.
// IMPORTANT: Do NOT use this in a production environment.
const hashPassword = (password: string): string => {
  try {
    // A simple way to "hash" for this PoC
    return btoa(password + 'somesalt');
  } catch (e) {
    console.error("Failed to hash password:", e);
    return password; // Fallback for environments where btoa is not available
  }
};

export const authService = {
  // Fix: Updated return type to Promise<PublicUser> for type safety.
  signUp: (email: string, password: string): Promise<PublicUser> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Re-load users to ensure we have the latest list
        users = loadUsers();
        if (users.find(user => user.email === email)) {
          reject(new Error('An account with this email already exists.'));
        } else {
          const hashedPassword = hashPassword(password);
          const newUser: User = {
            id: Date.now().toString(),
            email,
            hashedPassword,
          };
          users.push(newUser);
          saveUsers(users); // Persist the updated user list
          const { hashedPassword: _, ...userToReturn } = newUser;
          resolve(userToReturn);
        }
      }, 500);
    });
  },

  // Fix: Updated return type to Promise<PublicUser> for type safety.
  login: (email: string, password: string): Promise<PublicUser> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Re-load users to ensure we have the latest list
        users = loadUsers();
        const user = users.find(u => u.email === email);
        if (!user || user.hashedPassword !== hashPassword(password)) {
          reject(new Error('Invalid email or password.'));
        } else {
          const { hashedPassword: _, ...userToReturn } = user;
          resolve(userToReturn);
        }
      }, 500);
    });
  },
};
