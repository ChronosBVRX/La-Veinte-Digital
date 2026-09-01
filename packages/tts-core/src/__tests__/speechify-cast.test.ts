import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { selectCasting, getEnvOverrides } from "../speechify-cast";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const MOCK_VOICES = [
  { id: "voice-male-mx-1", gender: "male", locale: "es-MX", models: ["simba-3.0"] },
  { id: "voice-male-mx-2", gender: "male", locale: "es-MX", models: ["simba-3.0"] },
  { id: "voice-male-es-3", gender: "male", locale: "es-ES", models: ["simba-3.0"] },
  { id: "voice-female-mx-1", gender: "female", locale: "es-MX", models: ["simba-3.0"] },
  { id: "voice-female-mx-2", gender: "female", locale: "es-MX", models: ["simba-3.0"] },
  { id: "voice-female-es-1", gender: "female", locale: "es-ES", models: ["simba-3.0"] },
  { id: "voice-en-1", gender: "male", locale: "en-US", models: ["simba-3.0"] },
];

describe("speechify-cast", () => {
  let origFetch: typeof fetch;
  beforeEach(() => { origFetch = global.fetch; vi.stubEnv("SPEECHIFY_API_KEY", "sk_test"); });
  afterEach(() => {
    global.fetch = origFetch;
    delete process.env.SPEECHIFY_VOICE_MALE_1;
    delete process.env.SPEECHIFY_VOICE_MALE_2;
    delete process.env.SPEECHIFY_VOICE_MALE_3;
    delete process.env.SPEECHIFY_VOICE_FEMALE_1;
    delete process.env.SPEECHIFY_VOICE_FEMALE_2;
    vi.unstubAllEnvs();
  });

  it("asigna 5 voces únicas sin colisión", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: MOCK_VOICES }), { status: 200 }));
    const cast = await selectCasting("sk_test");
    const ids = Object.values(cast.voices);
    expect(ids.length).toBe(5);
    expect(new Set(ids).size).toBe(5);
  });

  it("garantiza 3 masculinas y 2 femeninas sin colisión", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: MOCK_VOICES }), { status: 200 }));
    const cast = await selectCasting("sk_test");
    const maleIds = [cast.voices.EDUARDO, cast.voices.JAVIER, cast.voices.RODRIGO];
    const femaleIds = [cast.voices.ANDREA, cast.voices.VALERIA];
    expect(maleIds.length).toBe(3);
    expect(femaleIds.length).toBe(2);
    expect(new Set([...maleIds, ...femaleIds]).size).toBe(5);
    // verificar que IDs vienen de pools correctos (mock)
    for (const id of maleIds) expect(id).toMatch(/voice-male/);
    for (const id of femaleIds) expect(id).toMatch(/voice-female/);
  });

  it("respeta overrides por variables de entorno", async () => {
    process.env.SPEECHIFY_VOICE_MALE_1 = "voice-male-mx-1";
    process.env.SPEECHIFY_VOICE_FEMALE_1 = "voice-female-mx-1";
    process.env.SPEECHIFY_VOICE_MALE_2 = "voice-male-mx-2";
    process.env.SPEECHIFY_VOICE_MALE_3 = "voice-male-es-3";
    process.env.SPEECHIFY_VOICE_FEMALE_2 = "voice-female-mx-2";
    const overrides = getEnvOverrides();
    expect(overrides.EDUARDO).toBe("voice-male-mx-1");
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: MOCK_VOICES }), { status: 200 }));
    const cast = await selectCasting("sk_test");
    expect(cast.voices.EDUARDO).toBe("voice-male-mx-1");
    expect(cast.voices.ANDREA).toBe("voice-female-mx-1");
    expect(cast.voices.JAVIER).toBe("voice-male-mx-2");
    expect(cast.voices.RODRIGO).toBe("voice-male-es-3");
    expect(cast.voices.VALERIA).toBe("voice-female-mx-2");
  });

  it("prioriza es-MX sobre otras locales es-*", async () => {
    // es-MX debe aparecer primero determinista
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: MOCK_VOICES }), { status: 200 }));
    const cast = await selectCasting("sk_test");
    // EDUARDO debería ser es-MX (score 100) no es-ES (50)
    expect(cast.voices.EDUARDO).toMatch(/mx/);
  });

  it("falla controlado si catálogo insuficiente (menos de 3M2F)", async () => {
    const insufficient = [
      { id: "m1", gender: "male", locale: "es-MX", models: ["simba-3.0"] },
      { id: "f1", gender: "female", locale: "es-MX", models: ["simba-3.0"] },
    ];
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: insufficient }), { status: 200 }));
    await expect(selectCasting("sk_test")).rejects.toThrow(/Catálogo insuficiente/);
  });

  it("falla si override duplica ID", async () => {
    process.env.SPEECHIFY_VOICE_MALE_1 = "voice-male-mx-1";
    process.env.SPEECHIFY_VOICE_MALE_2 = "voice-male-mx-1"; // duplicado
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: MOCK_VOICES }), { status: 200 }));
    await expect(selectCasting("sk_test")).rejects.toThrow(/duplicado/i);
  });

  it("persistencia determinista en data/tts/speechify-cast.json", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cast-"));
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ voices: MOCK_VOICES }), { status: 200 }));
    await selectCasting("sk_test", dir);
    expect(fs.existsSync(path.join(dir, "speechify-cast.json"))).toBe(true);
    const j = JSON.parse(fs.readFileSync(path.join(dir, "speechify-cast.json"), "utf8"));
    expect(j.provider).toBe("speechify");
    expect(j.model).toBe("simba-3.0");
    expect(j.language).toBe("es-MX");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
