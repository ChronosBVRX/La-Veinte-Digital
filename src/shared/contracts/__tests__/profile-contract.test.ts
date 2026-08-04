import { describe, expect, it } from "vitest"
import {
  EDITABLE_PROFILE_FIELD_NAMES,
  type EditableProfileFields,
  type OwnProfileUpsert,
} from "../profile"

describe("editable profile contract", () => {
  it("contains only personal fields", () => {
    expect(EDITABLE_PROFILE_FIELD_NAMES).toEqual([
      "full_name",
      "matricula",
      "adscripcion",
      "categoria",
      "antiguedad",
      "phone",
      "avatar_url",
    ])
    expect(EDITABLE_PROFILE_FIELD_NAMES).not.toContain("role")
    expect(EDITABLE_PROFILE_FIELD_NAMES).not.toContain("created_at")
    expect(EDITABLE_PROFILE_FIELD_NAMES).not.toContain("is_online")
  })

  it("supports an own-profile upsert without system fields", () => {
    const editable = {
      full_name: "Synthetic User",
      matricula: "SYNTH001",
    } satisfies EditableProfileFields
    const upsert = { id: "synthetic-user", ...editable } satisfies OwnProfileUpsert

    expect(upsert).toEqual({
      id: "synthetic-user",
      full_name: "Synthetic User",
      matricula: "SYNTH001",
    })
  })
})
