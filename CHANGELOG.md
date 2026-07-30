# Changelog

## [0.001] - 2026-07-30

### Fixes
- Replaced raw `<input>`, `<button>`, `<textarea>` with shared UI components (`Input`, `Button`, `Textarea`) across all client components:
  - `login-form.tsx` - now uses `Input` with icon prop
  - `register-form.tsx` - now uses `Input` with icon prop
  - `ChatRoom.tsx` - now uses `Input` and `Button`
  - `ChatAssistant.tsx` - now uses `Input` and `Button`
  - `CatalogSearch.tsx` - now uses `Input`
  - `CommentSection.tsx` - now uses `Textarea`
- Fixed cross-feature import violation: `TodayCard.tsx` now imports calendar types from `@/shared/data/calendario` instead of `@/features/calendario/`
- Added `icon` prop support to shared `Input` component for icon-inside-input patterns
- Added `/facebook` (Noticias SNTSS) to Sidebar navigation
- Extracted calendar types, data, and helpers to `src/shared/data/calendario.ts` for cross-feature reuse
- Updated `calendarioData.ts` to re-export from shared location (backward compatible)

### Meta
- Set version to 0.001 (semantic versioning start)
- Created CHANGELOG.md
- Updated AGENTS.md with version info
