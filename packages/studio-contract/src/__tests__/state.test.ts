import { describe, it, expect } from "vitest";
import {
  PROJECT_STATES,
  ProjectStateSchema,
  STEP_TRANSITIONS,
  type ProjectState,
} from "../state";

describe("studio-contract state", () => {
  it("acepta los estados de falla y progreso de propuesta y guion", () => {
    const requiredStates: ProjectState[] = [
      "GENERATING_PROPOSALS",
      "PROPOSAL_GENERATION_FAILED",
      "SCRIPT_GENERATING",
      "SCRIPT_GENERATION_FAILED",
      "SCRIPT_QUALITY_FAILED",
    ];

    for (const state of requiredStates) {
      expect(PROJECT_STATES).toContain(state);
      expect(ProjectStateSchema.parse(state)).toBe(state);
    }
  });

  it("garantiza que cada estado en PROJECT_STATES tiene transiciones definidas en STEP_TRANSITIONS", () => {
    for (const state of PROJECT_STATES) {
      expect(STEP_TRANSITIONS).toHaveProperty(state);
      expect(Array.isArray(STEP_TRANSITIONS[state])).toBe(true);
    }
  });

  it("mapea correctamente la acción de reintento según el estado del proyecto", () => {
    function resolveRetryAction(state: ProjectState | undefined): "script" | "proposal" | "research" {
      if (
        state === "PROPOSAL_APPROVED" ||
        state === "SCRIPT_GENERATING" ||
        state === "SCRIPT_QUALITY_FAILED" ||
        state === "SCRIPT_GENERATION_FAILED"
      ) {
        return "script";
      }
      if (
        state === "RESEARCHED" ||
        state === "GENERATING_PROPOSALS" ||
        state === "PROPOSAL_GENERATION_FAILED"
      ) {
        return "proposal";
      }
      return "research";
    }

    expect(resolveRetryAction("SCRIPT_QUALITY_FAILED")).toBe("script");
    expect(resolveRetryAction("SCRIPT_GENERATION_FAILED")).toBe("script");
    expect(resolveRetryAction("SCRIPT_GENERATING")).toBe("script");
    expect(resolveRetryAction("PROPOSAL_APPROVED")).toBe("script");

    expect(resolveRetryAction("PROPOSAL_GENERATION_FAILED")).toBe("proposal");
    expect(resolveRetryAction("GENERATING_PROPOSALS")).toBe("proposal");
    expect(resolveRetryAction("RESEARCHED")).toBe("proposal");

    expect(resolveRetryAction("DRAFT")).toBe("research");
    expect(resolveRetryAction("RESEARCHING")).toBe("research");
    expect(resolveRetryAction("FAILED")).toBe("research");
    expect(resolveRetryAction(undefined)).toBe("research");
  });
});