import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { escapeXml, buildSsml, getCharacterForSlot, ssmlProfileKey, SpeechifyEngine, _internal } from "../speechify-engine";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("speechify-engine: escapeXml y SSML", () => {
  it("escapa XML correctamente (& < > \" ')", () => {
    expect(escapeXml(`a & b <c> "d" 'e'`)).toBe(`a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;`);
  });

  it("aplica perfiles SSML por personaje", () => {
    expect(buildSsml("hola", "EDUARDO")).toBe(`<speak><speechify:emotion name="direct">hola</speechify:emotion></speak>`);
    expect(buildSsml("hola", "ANDREA")).toBe(`<speak><speechify:emotion name="warm">hola</speechify:emotion></speak>`);
    expect(buildSsml("hola", "JAVIER")).toBe(`<speak><prosody rate="-5%">hola</prosody></speak>`);
    expect(buildSsml("hola", "RODRIGO")).toBe(`<speak><prosody rate="+6%">hola</prosody></speak>`);
    expect(buildSsml("hola", "VALERIA")).toBe(`<speak><speechify:emotion name="bright">hola</speechify:emotion></speak>`);
  });

  it("escapa texto dentro de SSML", () => {
    const ssml = buildSsml(`café & té <importante>`, "EDUARDO");
    expect(ssml).toContain("&amp;");
    expect(ssml).toContain("&lt;importante&gt;");
  });

  it("getCharacterForSlot mapea correctamente", () => {
    expect(getCharacterForSlot("A")).toBe("EDUARDO");
    expect(getCharacterForSlot("B")).toBe("ANDREA");
    expect(getCharacterForSlot("N")).toBe("JAVIER");
    expect(getCharacterForSlot("C")).toBe("RODRIGO");
    expect(getCharacterForSlot("P")).toBe("VALERIA");
  });

  it("ssmlProfileKey refleja emoción/rate", () => {
    expect(ssmlProfileKey("EDUARDO")).toBe("emotion:direct");
    expect(ssmlProfileKey("JAVIER")).toBe("rate:-5%");
  });

  it("usa modelo simba-3.0, idioma es-MX y WAV", () => {
    expect(_internal.MODEL).toBe("simba-3.0");
    expect(_internal.LANGUAGE).toBe("es-MX");
    expect(_internal.PROVIDER).toBe("speechify");
  });

  it("respeta límite 2000 chars incluyendo SSML", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-test-"));
    const eng = new SpeechifyEngine(dir);
    process.env.SPEECHIFY_API_KEY = "sk_test_dummy";
    const largo = "a".repeat(2500);
    const r = await eng.generate(largo, "A", { voiceId: "voice-male-1" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/2000/);
    delete process.env.SPEECHIFY_API_KEY;
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("speechify-engine: generate con mocks", () => {
  let origFetch: typeof fetch;
  beforeEach(() => { origFetch = global.fetch; });
  afterEach(() => { global.fetch = origFetch; delete process.env.SPEECHIFY_API_KEY; });

  function wavBase64(): string {
    // WAV header mínimo RIFF+WAVE con datos vacíos (44 bytes)
    const hdr = Buffer.alloc(44);
    hdr.write("RIFF", 0); hdr.writeUInt32LE(36, 4); hdr.write("WAVE", 8);
    hdr.write("fmt ", 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20);
    hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(24000, 24); hdr.writeUInt32LE(48000, 28);
    hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(0, 40);
    return hdr.toString("base64");
  }

  it("genera y valida Base64 WAV RIFF", async () => {
    process.env.SPEECHIFY_API_KEY = "sk_test_123";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-test-"));
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ audio_data: wavBase64() }), { status: 200, headers: { "x-request-id": "req-123" } }));
    const eng = new SpeechifyEngine(dir);
    const r = await eng.generate("hola mundo", "A", { voiceId: "voice-male-1", characterId: "EDUARDO" });
    expect(r.ok).toBe(true);
    expect(r.path).toBeTruthy();
    expect(fs.existsSync(r.path!)).toBe(true);
    expect(r.requestId).toBe("req-123");
    // segunda llamada debe ser cacheHit sin fetch
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
    const r2 = await eng.generate("hola mundo", "A", { voiceId: "voice-male-1", characterId: "EDUARDO" });
    expect(r2.cacheHit).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("falla si Base64 no es WAV RIFF", async () => {
    process.env.SPEECHIFY_API_KEY = "sk_test_123";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-test-"));
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ audio_data: Buffer.from("not wav").toString("base64") }), { status: 200 }));
    const eng = new SpeechifyEngine(dir);
    const r = await eng.generate("hola", "A", { voiceId: "voice-male-1" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/WAV/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("maneja 429 con reintento limitado y requestId", async () => {
    process.env.SPEECHIFY_API_KEY = "sk_test_123";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-test-"));
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response("rate limited", { status: 429, headers: { "retry-after": "0", "x-request-id": "req-429" } });
      return new Response(JSON.stringify({ audio_data: wavBase64() }), { status: 200, headers: { "x-request-id": "req-ok" } });
    });
    const eng = new SpeechifyEngine(dir);
    const r = await eng.generate("hola", "A", { voiceId: "voice-male-1" });
    expect(r.ok).toBe(true);
    expect(calls).toBe(2);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("permite cancelación con AbortController", async () => {
    process.env.SPEECHIFY_API_KEY = "sk_test_123";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-test-"));
    const controller = new AbortController();
    global.fetch = vi.fn(async (_url, opts: unknown) => {
      const sig = (opts as { signal?: AbortSignal })?.signal;
      if (sig?.aborted) throw new DOMException("aborted", "AbortError");
      await new Promise((res) => setTimeout(res, 50));
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const eng = new SpeechifyEngine(dir);
    // abortar antes de llamar
    controller.abort();
    const r = await eng.generate("hola", "A", { voiceId: "voice-male-1", signal: controller.signal });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cancelado/i);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("no expone SPEECHIFY_API_KEY en error", async () => {
    process.env.SPEECHIFY_API_KEY = "sk_secret_abc";
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-test-"));
    global.fetch = vi.fn(async () => new Response("internal", { status: 500 }));
    const eng = new SpeechifyEngine(dir);
    const r = await eng.generate("hola", "A", { voiceId: "voice-male-1" });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("sk_secret_abc");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
