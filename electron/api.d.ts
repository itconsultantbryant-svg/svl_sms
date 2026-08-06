/**
 * Type definitions for the Electron API exposed to the renderer
 */

export interface LicenseStatus {
  status: 'active' | 'expired' | 'offline' | 'invalid';
  message: string;
  expiresAt?: string;
}

export interface AppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  isDev: boolean;
  appPath: string;
  userDataPath: string;
}

export interface SelectResult {
  success: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ExternalLinkResult {
  success: boolean;
  error?: string;
}

export interface ElectronAPI {
  /**
   * Get license status from backend
   */
  getLicenseStatus(): Promise<LicenseStatus>;

  /**
   * Open an external link in the default browser
   */
  openExternalLink(url: string): Promise<ExternalLinkResult>;

  /**
   * Minimize the window
   */
  minimizeWindow(): void;

  /**
   * Toggle maximize/restore the window
   */
  maximizeWindow(): void;

  /**
   * Close the application
   */
  closeWindow(): void;

  /**
   * Open folder selection dialog
   */
  selectFolder(): Promise<SelectResult>;

  /**
   * Open file selection dialog
   */
  selectFile(filters?: FileFilter[]): Promise<SelectResult>;

  /**
   * Get application information
   */
  getAppInfo(): Promise<AppInfo>;

  /**
   * Log messages from the frontend
   */
  log(level: 'info' | 'warn' | 'error', message: string): void;

  /**
   * Listen for deep links (svl-sms://)
   * @param callback Function called when a deep link is received
   * @returns Unsubscribe function
   */
  onDeepLink(callback: (url: string) => void): () => void;

  /**
   * Check if running in Electron environment
   */
  isElectron(): boolean;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
