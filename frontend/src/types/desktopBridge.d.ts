export interface DesktopStartupInfo {
  title: string;
  message: string;
  localUrl: string;
  docsUrl: string;
  note?: string;
}

declare global {
  interface Window {
    algoarenaDesktop?: {
      version: string;
      onStartupInfo?: (callback: (payload: DesktopStartupInfo) => void) => (() => void) | void;
    };
  }
}

export {};
