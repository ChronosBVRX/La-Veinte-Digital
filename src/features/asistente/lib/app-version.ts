/**
 * Identidad del deployment para trazabilidad en logs.
 * Se actualiza antes de cada despliegue (ver scripts/set-app-version.mjs
 * invocado manualmente o por CI); fallback "dev" en local.
 */
export const APP_COMMIT_SHA = process.env.APP_COMMIT_SHA ?? "0b42332"
export const RAG_BACKEND = "pgvector" as const
export const LLM_PROVIDER = "openai" as const
