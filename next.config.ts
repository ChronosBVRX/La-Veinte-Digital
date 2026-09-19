import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ragktminwduiggvaoeix.supabase.co";

// Cloudflare Turnstile: script del CAPTCHA + iframe del reto + verificación.
// Requerido por src/app/(auth)/turnstile-widget.tsx para obtener captcha_token.
const turnstileOrigin = "https://challenges.cloudflare.com"

// `'wasm-unsafe-eval'` es el token mínimo que exige Chrome para compilar
// WebAssembly; sin él, Tesseract (OCR de tarjetones escaneados, 100% local)
// no puede instanciar su módulo. NO habilita `eval` de JavaScript.
const connectSources = [
  "'self'",
  supabaseUrl,
  "https://tessdata.projectnaptha.com",
  "https://cdn.jsdelivr.net",
  turnstileOrigin,
].join(" ");

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${turnstileOrigin}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSources}`,
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  `frame-src https://www.facebook.com ${turnstileOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  transpilePackages: ["@la-veinte/tts-core", "@la-veinte/radio-core"],
  outputFileTracingExcludes: {
    "*": ["data/tts/**", "data/normativa/**", "tools/**"],
    "/api/escritos/generar": [
      "data/**",
      "apps/**",
      "android-app/**",
      "ios-app/**",
      "bot-api/**",
      "docs/**",
      "resources/**",
      "public/LaVeinteDigital.apk",
      "public/vendor/**",
      "src/lib/services/vectorstore-data.json",
      "spa.traineddata",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "tmp/**",
      "output/**",
    ],
    "/api/normativa/audio": [
      "data/**",
      "apps/**",
      "android-app/**",
      "ios-app/**",
      "bot-api/**",
      "docs/**",
      "resources/**",
      "public/LaVeinteDigital.apk",
      "public/vendor/**",
      "src/lib/services/vectorstore-data.json",
      "spa.traineddata",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "tmp/**",
      "output/**",
    ],
    "/api/normativa/tts": [
      "data/**",
      "apps/**",
      "android-app/**",
      "ios-app/**",
      "bot-api/**",
      "docs/**",
      "resources/**",
      "public/LaVeinteDigital.apk",
      "public/vendor/**",
      "src/lib/services/vectorstore-data.json",
      "spa.traineddata",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "tmp/**",
      "output/**",
    ],
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
