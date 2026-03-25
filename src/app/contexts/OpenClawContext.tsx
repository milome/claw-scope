import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AuthMode = 'none' | 'token' | 'password';

export interface Agent {
  id: string;
  name: string;
  nodeId: string;
  status: 'active' | 'standby' | 'sleeping';
  avatarColor?: string;
  type?: string;
}

export interface Node {
  id: string;
  name: string;
  status: 'online' | 'offline';
}

interface OpenClawContextType {
  isConnected: boolean;
  isConfigured: boolean;
  hasSkippedSetup: boolean;
  isSetupWizardOpen: boolean;
  gatewayUrl: string;
  authMode: AuthMode;
  authSecret: string;
  setHasSkippedSetup: (skipped: boolean) => void;
  updateConfig: (url: string, mode: AuthMode, secret: string) => void;
  testConnection: (url: string, mode: AuthMode, secret: string) => Promise<boolean>;
  disconnect: () => void;
  reopenSetupWizard: () => void;
  closeSetupWizard: () => void;
  showReminder: boolean;
  setShowReminder: (show: boolean) => void;
  nodes: Node[];
  agents: Agent[];
}

const OpenClawContext = createContext<OpenClawContextType | undefined>(undefined);

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789';
const STORAGE_KEYS = {
  configured: 'oc_configured',
  skipped: 'oc_skipped',
  url: 'oc_url',
  authMode: 'oc_auth_mode',
  authSecret: 'oc_auth_secret',
} as const;

const MOCK_NODES: Node[] = [
  { id: 'node-local', name: 'OpenClaw-Local', status: 'online' },
  { id: 'node-east', name: 'OpenClaw-East', status: 'online' },
  { id: 'node-west', name: 'OpenClaw-West', status: 'offline' },
];

const MOCK_AGENTS: Agent[] = [
  { id: 'c-7f8a-99x', name: 'ClawScope AI', nodeId: 'node-local', status: 'active', avatarColor: 'from-sky-400 to-blue-600', type: 'global' },
  { id: 'a-3m2b-88z', name: 'CodeReviewer', nodeId: 'node-local', status: 'standby', avatarColor: 'from-emerald-400 to-teal-600', type: 'coding' },
  { id: 'a-4t1c-77k', name: 'Terminal Agent', nodeId: 'node-local', status: 'active', avatarColor: 'from-amber-400 to-orange-600', type: 'coding' },
  { id: 's-9k1c-11y', name: 'StoryCrafter', nodeId: 'node-east', status: 'sleeping', avatarColor: 'from-fuchsia-400 to-purple-600', type: 'writing' },
  { id: 'd-1b2c-33x', name: 'DB Admin', nodeId: 'node-east', status: 'active', avatarColor: 'from-violet-400 to-indigo-600', type: 'db' },
  { id: 'u-5m6n-88p', name: 'UX Tester', nodeId: 'node-west', status: 'sleeping', avatarColor: 'from-rose-400 to-red-600', type: 'design' },
];

export function OpenClawProvider({ children }: { children: ReactNode }) {
  const isDev = import.meta.env.DEV;
  const readFlag = (key: string) => localStorage.getItem(key) === 'true';

  const [isConfigured, setIsConfigured] = useState(() => (isDev ? false : readFlag(STORAGE_KEYS.configured)));
  const [hasSkippedSetup, setHasSkippedSetupState] = useState(() => (isDev ? false : readFlag(STORAGE_KEYS.skipped)));
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(() => {
    if (isDev) {
      return true;
    }

    const configured = readFlag(STORAGE_KEYS.configured);
    const skipped = readFlag(STORAGE_KEYS.skipped);
    return !configured && !skipped;
  });
  const [gatewayUrl, setGatewayUrl] = useState(() => localStorage.getItem(STORAGE_KEYS.url) || DEFAULT_GATEWAY_URL);
  const [authMode, setAuthMode] = useState<AuthMode>(() => (localStorage.getItem(STORAGE_KEYS.authMode) as AuthMode) || 'none');
  const [authSecret, setAuthSecret] = useState(() => localStorage.getItem(STORAGE_KEYS.authSecret) || '');
  const [isConnected, setIsConnected] = useState(() => (isDev ? false : readFlag(STORAGE_KEYS.configured)));
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.url, gatewayUrl);
    localStorage.setItem(STORAGE_KEYS.authMode, authMode);
    localStorage.setItem(STORAGE_KEYS.authSecret, authSecret);
  }, [gatewayUrl, authMode, authSecret]);

  useEffect(() => {
    if (isDev) {
      localStorage.removeItem(STORAGE_KEYS.configured);
      localStorage.removeItem(STORAGE_KEYS.skipped);
      return;
    }

    localStorage.setItem(STORAGE_KEYS.configured, String(isConfigured));
    localStorage.setItem(STORAGE_KEYS.skipped, String(hasSkippedSetup));
  }, [isConfigured, hasSkippedSetup, isDev]);

  useEffect(() => {
    if (hasSkippedSetup && !isConfigured && !isSetupWizardOpen) {
      const timer = setTimeout(() => setShowReminder(true), 1500);
      return () => clearTimeout(timer);
    }

    setShowReminder(false);
  }, [hasSkippedSetup, isConfigured, isSetupWizardOpen]);

  const setHasSkippedSetup = (skipped: boolean) => {
    setHasSkippedSetupState(skipped);
    if (skipped) {
      setIsSetupWizardOpen(false);
    } else {
      setShowReminder(false);
    }
  };

  const reopenSetupWizard = () => {
    setHasSkippedSetupState(false);
    setShowReminder(false);
    setIsSetupWizardOpen(true);
  };

  const closeSetupWizard = () => {
    setIsSetupWizardOpen(false);
  };

  const updateConfig = (url: string, mode: AuthMode, secret: string) => {
    setGatewayUrl(url);
    setAuthMode(mode);
    setAuthSecret(secret);
    setIsConfigured(true);
    setIsConnected(true);
    setHasSkippedSetupState(false);
    setShowReminder(false);
    setIsSetupWizardOpen(false);
  };

  const testConnection = async (url: string) => {
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(url.startsWith('http'));
      }, 1500);
    });
  };

  const disconnect = () => {
    setIsConnected(false);
    setIsConfigured(false);
  };

  return (
    <OpenClawContext.Provider
      value={{
        isConnected,
        isConfigured,
        hasSkippedSetup,
        isSetupWizardOpen,
        gatewayUrl,
        authMode,
        authSecret,
        setHasSkippedSetup,
        updateConfig,
        testConnection,
        disconnect,
        reopenSetupWizard,
        closeSetupWizard,
        showReminder,
        setShowReminder,
        nodes: MOCK_NODES,
        agents: MOCK_AGENTS,
      }}
    >
      {children}
    </OpenClawContext.Provider>
  );
}

export function useOpenClaw() {
  const context = useContext(OpenClawContext);
  if (!context) throw new Error('useOpenClaw must be used within OpenClawProvider');
  return context;
}

