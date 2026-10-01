'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { getSystemSettings, type SystemSettingsPublic } from '@/lib/api';
import { MaintenancePage } from '@/components/MaintenancePage';

interface SystemContextType {
  settings: SystemSettingsPublic | null;
  refreshSettings: () => Promise<void>;
}

const SystemContext = createContext<SystemContextType>({
  settings: null,
  refreshSettings: async () => {},
});

export const useSystemSettings = () => useContext(SystemContext);

export function SystemStatusProvider({
  initialSettings,
  children,
}: {
  initialSettings: SystemSettingsPublic;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<SystemSettingsPublic>(initialSettings);

  const refreshSettings = async () => {
    try {
      const data = await getSystemSettings();
      setSettings(data);
    } catch (e) {
      // ignore
    }
  };

  // Check immediately on mount and poll periodically every 15 seconds
  useEffect(() => {
    refreshSettings();
    const interval = setInterval(refreshSettings, 15000);
    return () => clearInterval(interval);
  }, []);

  // If Maintenance Mode is active, intercept entire website view
  if (settings.maintenanceMode) {
    return (
      <SystemContext.Provider value={{ settings, refreshSettings }}>
        <MaintenancePage
          message={settings.maintenanceMessage}
          contactPhone={settings.contactPhone}
        />
      </SystemContext.Provider>
    );
  }

  return (
    <SystemContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </SystemContext.Provider>
  );
}
