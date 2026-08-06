import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script for Electron
 * Provides secure API bridge between frontend and main process
 */

interface LicenseStatus {
  status: 'active' | 'expired' | 'offline' | 'invalid';
  message: string;
  expiresAt?: string;
}

interface AppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  isDev: boolean;
  appPath: string;
  userDataPath: string;
}

interface SelectResult {
  success: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

interface FileFilter {
  name: string;
  extensions: string[];
}

/**
 * API exposed to the frontend
 */
const api = {
  /**
   * Get license status from backend
   */
  getLicenseStatus: (): Promise<LicenseStatus> => {
    return ipcRenderer.invoke('get-license-status');
  },

  /**
   * Open an external link
   */
  openExternalLink: (url: string): Promise<{ success: boolean; error?: string }> => {
    return ipcRenderer.invoke('open-external-link', url);
  },

  /**
   * Window control methods
   */
  minimizeWindow: (): void => {
    ipcRenderer.invoke('minimize-window');
  },

  maximizeWindow: (): void => {
    ipcRenderer.invoke('maximize-window');
  },

  closeWindow: (): void => {
    ipcRenderer.invoke('close-window');
  },

  /**
   * Select folder dialog
   */
  selectFolder: (): Promise<SelectResult> => {
    return ipcRenderer.invoke('select-folder');
  },

  /**
   * Select file dialog
   */
  selectFile: (filters?: FileFilter[]): Promise<SelectResult> => {
    return ipcRenderer.invoke('select-file', filters);
  },

  /**
   * Get application information
   */
  getAppInfo: (): Promise<AppInfo> => {
    return ipcRenderer.invoke('get-app-info');
  },

  /**
   * Log messages from frontend
   */
  log: (level: 'info' | 'warn' | 'error', message: string): void => {
    ipcRenderer.send('log', level, message);
  },

  /**
   * Listen for deep links
   */
  onDeepLink: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: any, url: string) => {
      callback(url);
    };

    ipcRenderer.on('deep-link', listener);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('deep-link', listener);
    };
  },

  /**
   * Check if running in Electron
   */
  isElectron: (): boolean => {
    return true;
  },
};

/**
 * Expose the API to the frontend via contextBridge
 * This is safe because it's in a preload script and the context is isolated
 */
try {
  contextBridge.exposeInMainWorld('api', api);
} catch (err) {
  console.error('Failed to expose API:', err);
}

/**
 * Declare the API types for TypeScript
 */
declare global {
  interface Window {
    api: typeof api;
  }
}
