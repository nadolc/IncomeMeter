// Auth constants
export interface User {
  id: string;
  name: string;
  email: string;
  isAuthenticated: boolean;
}

export interface AuthContextType {
  user: User | null;
  login: (token: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}