/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_CORE_URL: string
    readonly VITE_API_ANALYTICS_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
