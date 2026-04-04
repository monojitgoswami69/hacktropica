"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user_info';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from storage on mount
  useEffect(() => {
    try {
      const savedToken = sessionStorage.getItem(TOKEN_KEY);
      const savedUser = sessionStorage.getItem(USER_KEY);

      if (savedToken && savedUser) {
        const userData = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(userData);
        setIsAuthenticated(true);

        // Verify token is still valid in the background
        fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { 'Authorization': `Bearer ${savedToken}` },
        })
          .then((res) => {
            if (!res.ok) {
              // Token expired or invalid — clear session
              sessionStorage.removeItem(TOKEN_KEY);
              sessionStorage.removeItem(USER_KEY);
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
            }
          })
          .catch(() => {
            // Backend unreachable — keep session for now
          });
      }
    } catch (e) {
      console.error('Error restoring session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err.detail || `Login failed (${response.status})`;

        if (response.status === 401) {
          return { success: false, error: 'Invalid email or password' };
        }
        if (response.status === 403) {
          return { success: false, error: 'Access denied: Requires Admin, HOD, or Faculty role.' };
        }
        return { success: false, error: message };
      }

      const data = await response.json();
      // data = { uid, email, token, role, display_name }

      const userData = {
        uid: data.uid,
        email: data.email,
        role: data.role,
        token: data.token,
        username: data.display_name || data.email.split('@')[0],
      };

      setUser(userData);
      setToken(data.token);
      setIsAuthenticated(true);

      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Network error. Is the backend running?' };
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  };

  const updateProfile = async (updates) => {
    return { success: true };
  };

  const register = async (data) => {
    return { success: false, error: "Registration disabled in admin panel" };
  };

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateProfile,
    register,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
