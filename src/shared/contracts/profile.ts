export interface EditableProfileFields {
  full_name?: string | null
  matricula?: string | null
  adscripcion?: string | null
  categoria?: string | null
  antiguedad?: string | null
  phone?: string | null
  avatar_url?: string | null
}

export type OwnProfileUpsert = EditableProfileFields & { id: string }

export const EDITABLE_PROFILE_FIELD_NAMES = [
  "full_name",
  "matricula",
  "adscripcion",
  "categoria",
  "antiguedad",
  "phone",
  "avatar_url",
] as const satisfies readonly (keyof EditableProfileFields)[]
