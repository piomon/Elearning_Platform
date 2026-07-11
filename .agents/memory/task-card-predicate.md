---
name: Task-card predicate parity (boards)
description: Server task numbering and client card partitioning must use the same "non-empty answer OR solution" predicate for lesson images.
---

A lesson image is a **task card** iff it has a NON-EMPTY `answer` or `solution`.
This predicate is used in two places that must stay in lockstep:

- Server: `GET /topics/:topicId` computes `taskCardNumberOffset` by counting
  task cards in earlier published sibling lessons (continuous "Zadanie N"
  numbering across a section's boards).
- Client: the lesson page partitions `images` into task cards (board accordion)
  vs plain material images.

**Why:** if the server counts with `isNotNull` only while the client uses
truthiness, an empty-string `answer` in an earlier lesson silently shifts the
visible numbering (board 2 would start at "Zadanie 5" instead of 4).

**How to apply:** any change to what counts as a task card (new fields, new
card types) must update both the offset SQL predicate and the client partition
filter, plus the api-server board tests that assert the offset excludes
material and empty-string images.

Related contract: cards may reference a worked-example video by Bunny title
that lives in a DIFFERENT lesson of the same section; the API resolves it to
`relatedVideoId` + `relatedVideoTopicId` (published siblings only) so the
client can deep-link `/topics/<id>?video=<vid>` cross-lesson.
