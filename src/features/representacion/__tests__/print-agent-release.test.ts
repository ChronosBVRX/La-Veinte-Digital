import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolvePrintAgentDownloadUrl,
  getPrintAgentReleaseInfo,
  PRINT_AGENT_FILENAME,
  DEFAULT_PRINT_AGENT_RELEASE_TAG,
  DEFAULT_PRINT_AGENT_VERSION,
} from "../services/print-agent-release";
import { GET } from "@/app/api/downloads/print-agent/windows/route";

describe("Print Agent Windows Release & Download", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Evitar llamadas de red externas en tests
    process.env.PRINT_AGENT_SKIP_REMOTE_CHECK = "true";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("A. Metadatos (?json=true)", () => {
    it("devuelve filename = LaVeintePrint-Setup.exe y metadatos coherentes", async () => {
      const metadata = getPrintAgentReleaseInfo({
        ...process.env,
        PRINT_AGENT_RELEASE_TAG: "print-agent-v1.0.0",
      });

      expect(metadata.filename).toBe("LaVeintePrint-Setup.exe");
      expect(metadata.filename).toBe(PRINT_AGENT_FILENAME);
      expect(metadata.version).toBe("1.0.0");
      expect(metadata.release_tag).toBe("print-agent-v1.0.0");
      expect(metadata.platform).toBe("win32");
      expect(metadata.arch).toBe("x64");
      expect(metadata.download_url).toBe(
        "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/download/print-agent-v1.0.0/LaVeintePrint-Setup.exe"
      );
      expect(metadata.instructions).toBeInstanceOf(Array);
      expect(metadata.instructions.length).toBeGreaterThan(0);
    });

    it("el endpoint GET con ?json=true responde 200 con el contrato esperado", async () => {
      process.env.PRINT_AGENT_RELEASE_TAG = "print-agent-v1.0.0";
      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows?json=true");
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.filename).toBe("LaVeintePrint-Setup.exe");
      expect(json.version).toBe("1.0.0");
      expect(json.release_tag).toBe("print-agent-v1.0.0");
      expect(json.download_url).not.toContain("/releases/latest/");
    });
  });

  describe("B. Prohibición de /releases/latest/", () => {
    it("no genera nunca una URL con /releases/latest/ por defecto", () => {
      const resolved = resolvePrintAgentDownloadUrl({});
      expect(resolved.downloadUrl).not.toContain("/releases/latest/");
      expect(resolved.downloadUrl).toContain(DEFAULT_PRINT_AGENT_RELEASE_TAG);
    });

    it("invalida y rechaza cualquier PRINT_AGENT_DOWNLOAD_URL que contenga /releases/latest/", () => {
      const resolved = resolvePrintAgentDownloadUrl({
        PRINT_AGENT_DOWNLOAD_URL: "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/latest/download/LaVeintePrint-Setup.exe",
      });
      expect(resolved.isValid).toBe(false);
      expect(resolved.error).toContain("/releases/latest/");
    });

    it("el endpoint GET responde 503 controlado si PRINT_AGENT_DOWNLOAD_URL usa /releases/latest/", async () => {
      process.env.PRINT_AGENT_DOWNLOAD_URL = "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/latest/download/LaVeintePrint-Setup.exe";
      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows");
      const res = await GET(req);

      expect(res.status).toBe(503);
      const text = await res.text();
      expect(text).toContain("No fue posible descargar La Veinte Print");
    });
  });

  describe("C. Construcción de URL con PRINT_AGENT_RELEASE_TAG", () => {
    it("con PRINT_AGENT_RELEASE_TAG=print-agent-v1.0.0 construye /releases/download/print-agent-v1.0.0/LaVeintePrint-Setup.exe", () => {
      const resolved = resolvePrintAgentDownloadUrl({
        PRINT_AGENT_RELEASE_TAG: "print-agent-v1.0.0",
      });

      expect(resolved.isValid).toBe(true);
      expect(resolved.releaseTag).toBe("print-agent-v1.0.0");
      expect(resolved.version).toBe("1.0.0");
      expect(resolved.downloadUrl).toBe(
        "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/download/print-agent-v1.0.0/LaVeintePrint-Setup.exe"
      );
    });

    it("soporta tags futuros como print-agent-v1.2.3", () => {
      const resolved = resolvePrintAgentDownloadUrl({
        PRINT_AGENT_RELEASE_TAG: "print-agent-v1.2.3",
      });

      expect(resolved.releaseTag).toBe("print-agent-v1.2.3");
      expect(resolved.version).toBe("1.2.3");
      expect(resolved.downloadUrl).toBe(
        "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/download/print-agent-v1.2.3/LaVeintePrint-Setup.exe"
      );
    });
  });

  describe("D. Sobrescritura con PRINT_AGENT_DOWNLOAD_URL", () => {
    it("PRINT_AGENT_DOWNLOAD_URL tiene prioridad máxima sobre PRINT_AGENT_RELEASE_TAG", () => {
      const customUrl = "https://downloads.la20.com.mx/binaries/LaVeintePrint-Setup.exe";
      const resolved = resolvePrintAgentDownloadUrl({
        PRINT_AGENT_RELEASE_TAG: "print-agent-v1.0.0",
        PRINT_AGENT_DOWNLOAD_URL: customUrl,
      });

      expect(resolved.isOverride).toBe(true);
      expect(resolved.isValid).toBe(true);
      expect(resolved.downloadUrl).toBe(customUrl);
    });
  });

  describe("E. Redirección en la ruta normal", () => {
    it("devuelve redirect 302 solamente hacia una URL válida configurada", async () => {
      delete process.env.PRINT_AGENT_DOWNLOAD_URL;
      process.env.PRINT_AGENT_RELEASE_TAG = "print-agent-v1.0.0";

      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows");
      const res = await GET(req);

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(
        "https://github.com/ChronosBVRX/La-Veinte-Digital/releases/download/print-agent-v1.0.0/LaVeintePrint-Setup.exe"
      );
    });

    it("con PRINT_AGENT_DOWNLOAD_URL válido redirige 302 al URL sobrescrito", async () => {
      const customUrl = "https://custom.storage.la20.com.mx/releases/LaVeintePrint-Setup.exe";
      process.env.PRINT_AGENT_DOWNLOAD_URL = customUrl;

      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows");
      const res = await GET(req);

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(customUrl);
    });
  });

  describe("Fallback seguro", () => {
    it("usa DEFAULT_PRINT_AGENT_RELEASE_TAG si no hay variables de entorno", () => {
      const resolved = resolvePrintAgentDownloadUrl({});
      expect(resolved.releaseTag).toBe(DEFAULT_PRINT_AGENT_RELEASE_TAG);
      expect(resolved.version).toBe(DEFAULT_PRINT_AGENT_VERSION);
      expect(resolved.downloadUrl).toBe(
        `https://github.com/ChronosBVRX/La-Veinte-Digital/releases/download/${DEFAULT_PRINT_AGENT_RELEASE_TAG}/LaVeintePrint-Setup.exe`
      );
    });
  });

  describe("Comportamiento de error controlado cuando el asset no existe upstream", () => {
    it("responde 503 JSON en ?check=true si el asset upstream no está disponible", async () => {
      process.env.PRINT_AGENT_SKIP_REMOTE_CHECK = "false";
      process.env.PRINT_AGENT_FORCE_REMOTE_CHECK = "true";

      // Mock global fetch para simular 404 de GitHub Releases
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows?check=true");
      const res = await GET(req);

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain("No fue posible descargar La Veinte Print");
      expect(json.upstream_status).toBe(404);

      fetchSpy.mockRestore();
    });

    it("responde 503 HTML amigable en la ruta de descarga directa si el asset no está disponible", async () => {
      process.env.PRINT_AGENT_SKIP_REMOTE_CHECK = "false";
      process.env.PRINT_AGENT_FORCE_REMOTE_CHECK = "true";

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows", {
        headers: { Accept: "text/html" },
      });
      const res = await GET(req);

      expect(res.status).toBe(503);
      const html = await res.text();
      expect(html).toContain("No fue posible descargar La Veinte Print en este momento");
      expect(html).toContain("El instalador todavía no está disponible");
      expect(html).toContain("Volver al panel de impresión");

      fetchSpy.mockRestore();
    });

    it("responde 503 JSON si el cliente solicita Accept: application/json y el asset no existe", async () => {
      process.env.PRINT_AGENT_SKIP_REMOTE_CHECK = "false";
      process.env.PRINT_AGENT_FORCE_REMOTE_CHECK = "true";

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not Found", { status: 404 })
      );

      const req = new Request("https://la20.com.mx/api/downloads/print-agent/windows", {
        headers: { Accept: "application/json" },
      });
      const res = await GET(req);

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("No fue posible descargar La Veinte Print en este momento");
      expect(json.asset).toBe("LaVeintePrint-Setup.exe");

      fetchSpy.mockRestore();
    });
  });
});
