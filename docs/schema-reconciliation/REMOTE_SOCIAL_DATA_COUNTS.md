# Remote Social Data Counts

Captured: 2026-08-04 via read-only SQL against `ragktminwduiggvaoeix`.

## Counts

| Object | Count | Notes |
|--------|-------|-------|
| chat_rooms | 1 | Seed room "General" |
| chat_messages | 2 | Likely seed or test data |
| chat_participants | 0 | No active participants |
| chat_room_invitations | 0 | No pending invitations |
| forum_categories | 3 | Seed: General, Normativa, Permutas |
| forum_posts | 0 | No user posts |
| forum_comments | 0 | No comments |

## Assessment

All social data is seed/test data. No user-generated content exists.
Safe to drop without export. The 2 chat messages and 3 forum categories
were inserted by migration `20260727231842` (seed_default_chat_room).
