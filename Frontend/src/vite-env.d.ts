/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_API_ORIGIN?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
