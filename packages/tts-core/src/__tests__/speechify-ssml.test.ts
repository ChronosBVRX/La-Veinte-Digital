import { describe, it, expect } from "vitest";
import {
  escapeXml,
  escapeSsmlText,
  buildSsml,
  getCharacterForSlot,
} from "../speechify-engine";

describe("Speechify SSML Engine", () => {
  it("escapa caracteres XML en texto plano", () => {
    const raw = 'Trabajadores & jefaturas: "LFT" <artículo 10>';
    const escaped = escapeXml(raw);
    expect(escaped).toBe('Trabajadores &amp; jefaturas: &quot;LFT&quot; &lt;artículo 10&gt;');
  });

  it("preserva tags <break time='...'/> mientras escapa el texto circundante", () => {
    const input = 'A ver & toma nota. <break time="600ms"/> Si revisamos la norma <cláusula 22>, vemos esto.';
    const output = escapeSsmlText(input);

    expect(output).toContain('<break time="600ms"/>');
    expect(output).toContain("&amp;");
    expect(output).toContain("&lt;cláusula 22&gt;");
  });

  it("construye SSML válido con perfiles de emoción y prosodia", () => {
    // Andrea: emotion "warm"
    const ssmlAndrea = buildSsml('Hola a todos. <break time="400ms"/> Comenzamos.', "ANDREA");
    expect(ssmlAndrea.startsWith("<speak>")).toBe(true);
    expect(ssmlAndrea.endsWith("</speak>")).toBe(true);
    expect(ssmlAndrea).toContain('<speechify:emotion name="warm">');
    expect(ssmlAndrea).toContain('<break time="400ms"/>');

    // Javier: rate "-5%"
    const ssmlJavier = buildSsml('De acuerdo con la norma. <break time="500ms"/> El derecho existe.', "JAVIER");
    expect(ssmlJavier.startsWith("<speak>")).toBe(true);
    expect(ssmlJavier).toContain('<prosody rate="-5%">');
    expect(ssmlJavier).toContain('<break time="500ms"/>');


    // Eduardo: emotion "direct"
    const ssmlEduardo = buildSsml("Buen punto.", "EDUARDO");
    expect(ssmlEduardo).toContain('<speechify:emotion name="direct">');
  });

  it("mapea slots de voz canónicos a personajes", () => {
    expect(getCharacterForSlot("A")).toBe("EDUARDO");
    expect(getCharacterForSlot("B")).toBe("ANDREA");
    expect(getCharacterForSlot("N")).toBe("JAVIER");
    expect(getCharacterForSlot("C")).toBe("RODRIGO");
    expect(getCharacterForSlot("P")).toBe("VALERIA");
  });
});
