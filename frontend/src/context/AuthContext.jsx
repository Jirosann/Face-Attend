import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const name = localStorage.getItem('name');
    const avatar_url = localStorage.getItem('avatar_url');
    if (token) {
      setUser({ token, role, name, avatar_url: avatar_url || null });
    }
    setLoading(false);
  }, []);

  const login = (data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('name', data.name);
    setUser({ token: data.access_token, role: data.role, name: data.name, avatar_url: null });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('name');
    localStorage.removeItem('avatar_url');
    setUser(null);
  };

  const updateProfile = (patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    if (patch.name != null) localStorage.setItem('name', patch.name);
    if (patch.avatar_url !== undefined) {
      if (patch.avatar_url) localStorage.setItem('avatar_url', patch.avatar_url);
      else localStorage.removeItem('avatar_url');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}