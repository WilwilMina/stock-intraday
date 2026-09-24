/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for a production build; left unset in dev (uses the Vite proxy instead). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
