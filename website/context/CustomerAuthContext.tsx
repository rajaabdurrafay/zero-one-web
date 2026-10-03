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
  logout: () => Promise<void>;
  isLoading: boolean;
}

const CustomerAuthContext = createContext<CustomerAuthContextType>({
  token: null,
  customer: null,
  login: () => {},
  updateCustomer: () => {},
  logout: async () => {},
  isLoading: true,
});

const TOKEN_KEY = 'zeroone_customer_token';
const CUSTOMER_KEY = 'zeroone_customer_user';

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/backend/api/auth/me',{signal:controller.signal,cache:'no-store'}).then(async response=>{
      if(!response.ok){setToken(null);setCustomer(null);try{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(CUSTOMER_KEY)}catch{}return;}
      const profile=await response.json();setToken('cookie-session');setCustomer(profile);
      try{localStorage.setItem(TOKEN_KEY,'cookie-session');localStorage.setItem(CUSTOMER_KEY,JSON.stringify(profile))}catch{}
    }).catch(error=>{if(error.name!=='AbortError'){setToken(null);setCustomer(null)}}).finally(()=>{if(!controller.signal.aborted)setIsLoading(false)});
    return ()=>controller.abort();
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

  const logout = async () => {
    const response=await fetch('/api/auth/logout', { method: 'POST' });
    if(!response.ok) throw new Error('Logout failed. Please retry.');
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
