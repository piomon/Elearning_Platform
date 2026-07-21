---
name: AI usage log retention
description: How ai_usage_log stays bounded and why the retention floor is 4 months
---
Raw ai_usage_log rows older than AI_USAGE_RETENTION_MONTHS (default 12, clamped 4–120) are summed into ai_usage_daily_stats (one row per UTC day+operation+model) and deleted — scheduled at api-server boot + every 24h.

**Why the design is safe:**
- Idempotency comes from doing the additive rollup INSERT…ON CONFLICT and the DELETE over the *same cutoff in one transaction* — a row is counted exactly once because it no longer exists after the run. Never make the upsert non-additive or split the tx.
- Retention floor is 4 months because /admin/ai-usage/stats caps its window at 90 days; raw rows must always cover the stats window or admin totals would lie after cleanup. If the stats window ever grows past ~120 days, raise the floor or teach stats to union the daily table.

**How to apply:** any new stats/CSV endpoint reading ai_usage_log must either stay within the retention window or merge ai_usage_daily_stats for older ranges.
