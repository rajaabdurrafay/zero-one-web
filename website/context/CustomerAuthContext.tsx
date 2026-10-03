'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  isRegistered: boolean;
}

interface CustomerAuthContextType {
  token: string | null;
  customer: CustomerUser | null;
  login: (token: string, customer: CustomerUser) => void;
  updateCustomer: (customer: Partial<CustomerUser>) => void;
  logout: () => void;
  isLoading: boolean;
}

const CustomerAuthContext = createContext<CustomerAuthContextType>({
  token: null,
  customer: null,
  login: () => {},
  updateCustomer: () => {},
  logout: () => {},
  isLoading: true,
});

const TOKEN_KEY = 'zeroone_customer_token';
const CUSTOMER_KEY = 'zeroone_customer_user';

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      const savedToken = stored === 'cookie-session' ? stored : null;
      if (stored && !savedToken) localStorage.removeItem(TOKEN_KEY);
      const savedCustomer = localStorage.getItem(CUSTOMER_KEY);
      if (savedToken && savedCustomer) {
        setToken(savedToken);
        setCustomer(JSON.parse(savedCustomer));
        void fetch('/api/backend/api/auth/me').then(async response => {
          if (!response.ok) { setToken(null); setCustomer(null); localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(CUSTOMER_KEY); }
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to load customer auth from storage:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (newToken: string, newCustomer: CustomerUser) => {
    newToken = 'cookie-session';
    setToken(newToken);
    setCustomer(newCustomer);
    try {
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(newCustomer));
    } catch (e) {
      console.error('Failed to save customer auth to storage:', e);
    }
  };

  const updateCustomer = (updatedFields: Partial<CustomerUser>) => {
    setCustomer((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      try {
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update customer auth in storage:', e);
      }
      return updated;
    });
  };

  const logout = () => {
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setCustomer(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(CUSTOMER_KEY);
    } catch (e) {
      console.error('Failed to remove customer auth from storage:', e);
    }
  };

  return (
    <CustomerAuthContext.Provider value={{ token, customer, login, updateCustomer, logout, isLoading }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  return useContext(CustomerAuthContext);
}
