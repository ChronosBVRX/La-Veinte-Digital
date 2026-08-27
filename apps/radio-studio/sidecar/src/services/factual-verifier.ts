/**
 * FactualVerifier — verificación determinista de un guion contra el Claim Ledger.
 *
 * Reglas (comportamiento esperado, no opinión):
 *  - Toda afirmación factual normativa debe tener claimRefs.
 *  - Todo claimRef debe existir en el ledger y referenciar una fuente real.
 *  - Números normativos (días, años, %, horas, plazos, artículos, cláusulas)
 *    sin respaldo en el corpus → UNSUPPORTED_NUMERIC_CLAIM (HARD FAIL).
 *  - Cualquier sourceId inventado → INVENTED_SOURCE.
 *  - Voz comercial que cruza el firewall → COMMERCIAL_FIREWALL.
 *  - Locutor fuera del reparto → INVALID_SPEAKER.
 *
 * Conversación pura ("A ver, ahí tengo una duda.") NO se marca: no es factual.
 */
import {
  type Script,
  type VerifyResult,
  type VerifyIssue,
} from "@la-veinte/studio-contract";
import { commercialFirewall } from "./commercial-service";

const NORMATIVE_FACTUAL_RE =
  /\b(la (ley|norma|normativa|regla|procedimiento|solicitud|obligaci[oó]n|autoridad|resoluci[oó]n|jornada|constancia|documentaci[oó]n)|el (contrato|cct|procedimiento|art[ií]culo|reglamento|estatuto|acuerdo)|est[áa] (previsto|establecido|prohibido|obligado|facultado|regulado)|corresponde|deber[áa]|tiene (derecho|la obligaci[oó]n)|conforme a la|de acuerdo con |exige|establece que|indica la|seg[úu]n la (ley|norma|fuente|cl[áa]usula)|presentar|solicitar por escrito)\b/i;

const NUMERIC_WORDS_RE = /\b(d[ií]as?|a[ñn]os?|horas?|semanas?|meses?|por ciento|%|quincenas?|veces|pesos|salarios?|d[ií]as naturales)\b/i;
const CLAUSE_ARTICLE_RE = /\b((?:cl[áa]usula|art[ií]culo|numeral|fracci[oó]n|apartado|procedimiento)\s+(\d+|[IVXLC]+))\b/i;

export interface VerifierContext {
  claims: Array<{
    id: string;
    statement: string;
    locator?: string | null;
    evidence: Array<{ sourceId: string; document: string; excerpt?: string; clause?: string | null; article?: string | null; section?: string | null; page?: number | null; procedure?: string | null }>;
  }>;
  /** Fuentes válidas conocidas (sourceId -> documento). */
  sources: Map<string, string>;
  /** Locutores válidos. */
  speakers: Set<string>;
}

function extractNumbers(text: string): string[] {
  const matches = [...text.matchAll(/\d+/g)];
  return matches.map((m) => m[0]);
}

function claimSupportsNumber(claim: { statement: string; locator?: string | null; evidence: Array<{ excerpt?: string; clause?: string | null; article?: string | null }> }, number: string): boolean {
  const haystack = claim.statement + " " + (claim.locator ?? "") + " " + claim.evidence.map((e) => (e.excerpt ?? "") + " " + (e.clause ?? "") + " " + (e.article ?? "")).join(" ");
  return haystack.includes(number);
}

/** ¿Un turno es conversación sin contenido factual? */
function esConversacion(text: string): boolean {
  const t = text.trim();
  const words = t.split(/\s+/).length;
  const esPregunta = /\?\s*$/.test(t) || /^(qué |cómo |cuándo |dónde |quién |cuánto |por qué |y si |o sea |no será|¿)/i.test(t);
  if (esPregunta) return true;
  // meta-comentario / marco conversacional (comparaciones, hedging, aclaraciones)
  const meta = /(una cosa es|otra cosa es|lo que te cuentan|en la pr[aá]ctica|depende|más de una persona|imagina|supongamos|digamos que|bueno,|pues mira|por ejemplo, imagina|lo importante|es m[aá]s|así nom[aá]s|si hablamos|yo dir[ií]a)/i.test(t);
  if (meta && words <= 45) return true;
  const hasNormative = NORMATIVE_FACTUAL_RE.test(t);
  const hasNumericNormative = NUMERIC_WORDS_RE.test(t) && /\d/.test(t);
  const hasClauseArticle = CLAUSE_ARTICLE_RE.test(t);
  return !hasNormative && !hasNumericNormative && !hasClauseArticle;
}

/** El número está respaldado por al menos un claim del ledger (statement/locator/evidence). */
function numberInLedger(number: string, claims: Array<{ statement: string; locator?: string | null; evidence: Array<{ excerpt?: string; clause?: string | null; article?: string | null }> }>): boolean {
  return claims.some((c) => claimSupportsNumber(c, number));
}

export function verifyScript(script: Script, ctx: VerifierContext): VerifyResult {
  const issues: VerifyIssue[] = [];
  let totalClaims = 0;
  let verifiedClaims = 0;
  const sources = new Set<string>();

  const validSpeaker = (s: string) => ctx.speakers.has(s.toUpperCase()) || ctx.speakers.has(s);

  for (const turn of script.turns) {
    // Firewall comercial
    const fw = commercialFirewall([{ id: turn.id, speaker: turn.speaker, text: turn.displayText, adSlot: turn.adSlot, intent: turn.intent, kind: turn.kind }]);
    for (const v of fw) {
      issues.push({ turnId: turn.id, code: "COMMERCIAL_FIREWALL", detail: v.detalle });
    }

    if (turn.claimRefs.length === 0 && !turn.adSlot) {
      if (!esConversacion(turn.displayText)) {
        issues.push({ turnId: turn.id, code: "FACT_WITHOUT_EVIDENCE", detail: "afirmación factual sin claimRefs" });
      }
      continue;
    }

    // claimRefs
    for (const ref of turn.claimRefs) {
      totalClaims++;
      const claim = ctx.claims.find((c) => c.id === ref);
      if (!claim) {
        issues.push({ turnId: turn.id, code: "CLAIM_REF_MISSING", detail: `claimRef '${ref}' no existe en el ledger` });
        continue;
      }
      verifiedClaims++;
      sources.add(claim.evidence[0]?.sourceId ?? "");
      // Numeric claim gate — un valor normativo debe estar respaldado por el ledger
      // (no basta "parece correcto"); se consulta el claim referenciado Y el ledger.
      const numbers = extractNumbers(turn.displayText);
      const numericClaimFacts = NUMERIC_WORDS_RE.test(turn.displayText) || CLAUSE_ARTICLE_RE.test(turn.displayText);
      if (numericClaimFacts && numbers.length > 0) {
        const anyUnsupported = numbers.some((n) => !claimSupportsNumber(claim, n) && !numberInLedger(n, ctx.claims));
        if (anyUnsupported) {
          issues.push({ turnId: turn.id, code: "UNSUPPORTED_NUMERIC_CLAIM", detail: `valor numérico '${numbers.join(",")}' sin respaldo en el ledger` });
        }
      }
      if (turn.sourceRefs.length === 0 && claim.evidence[0]?.sourceId) {
        turn.sourceRefs.push({
          sourceId: claim.evidence[0].sourceId,
          document: claim.evidence[0].document,
          section: claim.evidence[0].section ?? null,
          article: claim.evidence[0].article ?? null,
          clause: claim.evidence[0].clause ?? null,
          procedure: claim.evidence[0].procedure ?? null,
          page: claim.evidence[0].page ?? null,
          excerpt: claim.evidence[0].excerpt,
          claimId: ref,
        });
      }
    }

    // Invented source
    for (const sr of turn.sourceRefs) {
      if (sr.sourceId && !ctx.sources.has(sr.sourceId)) {
        issues.push({ turnId: turn.id, code: "INVENTED_SOURCE", detail: `sourceId '${sr.sourceId}' no existe` });
      }
    }

    if (turn.speaker && !validSpeaker(turn.speaker)) {
      issues.push({ turnId: turn.id, code: "INVALID_SPEAKER", detail: `locutor desconocido: ${turn.speaker}` });
    }
  }

  const blocking = issues.filter((i) => i.code !== "OK").length;
  return {
    verified: blocking === 0,
    totalClaims,
    verifiedClaims,
    sources: [...sources].filter(Boolean),
    issues,
    estimatedDurSec: script.estimacionDurSec,
  };
}

export function healthyVerifyResult(script: Script): VerifyResult {
  return {
    verified: true,
    totalClaims: script.turns.reduce((a, t) => a + t.claimRefs.length, 0),
    verifiedClaims: script.turns.reduce((a, t) => a + t.claimRefs.length, 0),
    sources: [],
    issues: [],
    estimatedDurSec: script.estimacionDurSec,
  };
}
