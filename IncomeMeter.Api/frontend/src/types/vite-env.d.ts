/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_URL?: string;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    accept: (cb?: () => void) => void;
    on: (event: string, cb: () => void) => void;
  };
  glob: (pattern: string, options?: any) => Record<string, any>;
}