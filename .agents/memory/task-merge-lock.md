---
name: Task-merge conflict avoidance
description: How to sequence main-agent edits around task-agent merges (MERGING/IMPLEMENTED states)
---

Rule: never edit a file region that an IMPLEMENTED or MERGING project task also touches; land your fix AFTER that task's merge completes.

**Why:** platform merges task branches automatically; overlapping working-tree edits risk merge conflicts and reconciliation failures. The merge lock (WAITING_FOR_LOCK) is held while the main agent's turn is active — polling for the merge mid-turn deadlocks; merges land between turns.

**How to apply:** when review finds a bug in a file a pending task will rewrite (e.g. serializer inside an endpoint the task reworks), report it, end the turn to release the lock, then patch on top of the merged result and re-run that task's tests. Safe immediate fixes are only those in files no pending task touches.
