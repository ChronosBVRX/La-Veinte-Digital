# Baseline Test Record

Captured on 2026-08-03 from branch `fix/public-launch-readiness` at
`45927e8776aea82f8cbc59bcd4304738e20c91b0`.

The worktree was already modified before this run. These results describe the
existing dirty worktree, not a clean checkout of the commit.

## Toolchain

| Tool | Result |
| --- | --- |
| Node.js | `v24.14.1` |
| npm | `11.11.0` |
| Python | `3.13.3` |
| Supabase CLI | `2.110.0` |
| Docker | unavailable (`docker` is not in `PATH`) |

## Web Application

| Command | Result |
| --- | --- |
| `npm ci` | passed; 525 packages installed; 1 high-severity audit finding |
| `npm run typecheck` | passed |
| `npm run lint` | passed with 5 warnings and 0 errors |
| `npm test` | 19 files passed; 402 tests passed; 51.27 s |
| `npm run build` | passed; compile 21.2 s, TypeScript 30.0 s, static generation 5.4 s |

The five lint warnings are pre-existing `react-hooks/exhaustive-deps` warnings
in calculator components. No protected formula or expected result was changed.

## Python Backend

Both requirements files were already satisfied. `python -m pytest -v` produced:

- 16 passed
- 1 skipped
- 1 deprecation warning from `langchain-community`
- 3.70 s

## Local Database

`supabase start` and `supabase db reset` were not run because Docker is
unavailable. The schema dump command also stopped with the documented Docker
prerequisite. No `--linked` reset was attempted.

This is a hard stop for declaring any migration baseline reproducible.
