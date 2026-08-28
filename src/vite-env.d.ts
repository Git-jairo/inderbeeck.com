/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When "true", serve the coming-soon placeholder to every visitor. */
  readonly VITE_SHOW_PLACEHOLDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
