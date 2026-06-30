import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import * as schema from "../../lib/db/src/schema/index.js";
import { COURSE, BOARD_TASKS_BY_CODE } from "./course-data.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { sections, topics, tasks } = schema;

// Non-destructive backfill: ensure every lesson that has a board task defined in
// BOARD_TASKS_BY_CODE actually has a task row, WITHOUT wiping existing data.
// Lessons are matched by stable identity (section slug + lesson slug), so this is
// portable across environments (dev and production) and safe to re-run
// (idempotent): topics that already have a task are left untouched.
async function backfill() {
  console.log("Backfilling board tasks (non-destructive)...");

  let created = 0;
  let skipped = 0;
  let missing = 0;

  for (const sec of COURSE.sections) {
    const [section] = await db
      .select()
      .from(sections)
      .where(eq(sections.slug, sec.slug))
      .limit(1);
    if (!section) {
      console.warn(`  ! Section not found by slug "${sec.slug}" — skipping its lessons.`);
      missing += sec.lessons.length;
      continue;
    }

    for (const lesson of sec.lessons) {
      const board = BOARD_TASKS_BY_CODE[lesson.code];
      if (!board) continue;

      const [topic] = await db
        .select()
        .from(topics)
        .where(and(eq(topics.sectionId, section.id), eq(topics.slug, lesson.slug)))
        .limit(1);
      if (!topic) {
        console.warn(`  ! Topic not found: section "${sec.slug}" / lesson "${lesson.slug}" (${lesson.code}).`);
        missing += 1;
        continue;
      }

      const existing = await db.select().from(tasks).where(eq(tasks.topicId, topic.id)).limit(1);
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      await db.insert(tasks).values({
        topicId: topic.id,
        title: board.title,
        description: board.description,
      });
      created += 1;
      console.log(`  + Added task to topic ${topic.id} (${lesson.code}): ${board.title}`);
    }
  }

  console.log(
    `\nBackfill complete. Created ${created}, skipped ${skipped} (already had a task), missing topics ${missing}.`,
  );
  await pool.end();
}

backfill().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
