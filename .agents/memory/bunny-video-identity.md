---
name: Bunny video GUID global identity
description: bunnyVideoId is a globally-unique identity (one clip ↔ one video row); the rule that governs the importer, topic duplication, and the assign route.
---

`videos.bunnyVideoId` (the Bunny GUID) is a **globally unique** identity — one
Bunny clip maps to exactly one `videos` row — enforced by a unique index
(`videos_bunny_video_id_uniq`).

**Why:** The content importer matches videos **globally by GUID first**, then
falls back to per-topic natural key (`bunnyTitle || videoUrl || title`). The
global match is what lets a clip that was moved between lessons be UPDATED
(reassign `topicId`) instead of re-inserted — this is the mechanism that keeps
export → re-import idempotent and avoids mid-transaction unique violations. A
per-topic-scoped constraint would break that guarantee.

**How to apply — three call sites must stay consistent with this invariant:**
- **Topic duplication** (admin duplicate route): the cloned video must NOT copy
  the source's GUID — clear `bunnyVideoId` + `bunnyTitle` on the clone (a
  duplicated DRAFT lesson has no video assigned until an admin re-links one).
- **Assign route** (`POST /admin/bunny/assign`): pre-check whether the GUID is
  already on another topic's video row and return a graceful **409** (naming the
  owning lesson) instead of letting the unique index throw a 500.
- **Test factory**: emit a unique `bunnyVideoId` per seeded video, or multi-video
  seeds collide on the unique index.

**Consequence (product):** the same Bunny clip cannot be attached to two lessons
at once — this is by design, not a limitation to "fix" by loosening the index.
