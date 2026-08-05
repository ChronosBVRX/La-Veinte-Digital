// Stub para server-only en vitest. En entorno node no hay React Server
// Components; este módulo es un noop que permite que los tests de capa
// servidor corran en vitest sin lanzar. En builds de Next.js, server-only
// sí lanza (protección real contra importaciones en lado cliente).
export {}
