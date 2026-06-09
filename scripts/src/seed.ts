import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import bcrypt from "bcrypt";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as schema from "../../lib/db/src/schema/index.js";
import { COURSE } from "./course-data.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const {
  users,
  courses,
  sections,
  topics,
  videos,
  lessonImages,
  quizzes,
  quizQuestions,
  quizAnswers,
  quizAttempts,
  quizAttemptAnswers,
  learningProgress,
  videoProgress,
  aiChecks,
  tasks,
  accessGrants,
} = schema;

const __dirname = dirname(fileURLToPath(import.meta.url));
// PNG assets live in the web artifact's public folder, served at /course-assets.
const ASSETS_DIR = join(__dirname, "../../artifacts/physics-platform/public/course-assets");
const BUNNY_MAP_PATH = join(__dirname, "../data/bunny-videos.json");

type BunnyEntry = { title: string; guid: string; status: number; encodeProgress: number; collectionId: string; length?: number | null };

// "D1_L01_ROOT_VIDEO_ScreenRecorderProject84.mkv" -> parts
function parseToken(filename: string): { code: string; seq: string; source: string } | null {
  const base = filename.replace(/\.[^.]+$/, "");
  const parts = base.split("_");
  if (parts.length < 5) return null;
  const code = `${parts[0]}_${parts[1]}`; // e.g. D1_L01
  const seq = parts[2]; // ROOT | 01 | 04 | 09W
  const source = parts.slice(4).join("_");
  return { code, seq, source };
}

// ROOT is the lesson intro (rendered first); numeric sequences keep their value.
function seqToNum(seq: string): number {
  if (seq.toUpperCase() === "ROOT") return 0;
  const n = parseInt(seq.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 999;
}

function loadBunnyVideos(): BunnyEntry[] {
  const raw = JSON.parse(readFileSync(BUNNY_MAP_PATH, "utf8")) as Record<string, BunnyEntry[]>;
  return Object.values(raw).flat();
}

function loadImageFiles(): string[] {
  try {
    return readdirSync(ASSETS_DIR).filter((f) => f.toLowerCase().endsWith(".png"));
  } catch {
    return [];
  }
}

type VideoMaterial = { sortOrder: number; bunnyVideoId: string; bunnyTitle: string; durationSeconds: number | null };
type ImageMaterial = { sortOrder: number; imageUrl: string; alt: string };

function videosForLesson(code: string, all: BunnyEntry[]): VideoMaterial[] {
  const matches = all.filter((e) => {
    const p = parseToken(e.title);
    return p?.code === code;
  });
  // Dedup identical uploads (same source filename = same recording, e.g. the
  // ROOT copy duplicated into subfolder 01). Keep the lowest sequence.
  const bySource = new Map<string, BunnyEntry>();
  for (const e of matches) {
    const p = parseToken(e.title)!;
    const existing = bySource.get(p.source);
    if (!existing || seqToNum(p.seq) < seqToNum(parseToken(existing.title)!.seq)) {
      bySource.set(p.source, e);
    }
  }
  return [...bySource.values()]
    .map((e) => {
      const p = parseToken(e.title)!;
      return {
        sortOrder: seqToNum(p.seq),
        bunnyVideoId: e.guid,
        bunnyTitle: e.title.replace(/\.[^.]+$/, ""),
        durationSeconds: typeof e.length === "number" && e.length > 0 ? e.length : null,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function imagesForLesson(code: string, files: string[]): ImageMaterial[] {
  return files
    .filter((f) => parseToken(f)?.code === code)
    .map((f) => {
      const p = parseToken(f)!;
      return { sortOrder: seqToNum(p.seq), imageUrl: `course-assets/${f}`, alt: `Materiał pomocniczy – ${code}` };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function wipeCourseData() {
  // Remove all course-derived data so the seed is idempotent. Users are kept.
  await db.delete(quizAttemptAnswers);
  await db.delete(quizAttempts);
  await db.delete(quizAnswers);
  await db.delete(quizQuestions);
  await db.delete(quizzes);
  await db.delete(videoProgress);
  await db.delete(learningProgress);
  await db.delete(aiChecks);
  await db.delete(tasks);
  await db.delete(lessonImages);
  await db.delete(videos);
  await db.delete(topics);
  await db.delete(sections);
  await db.delete(accessGrants);
  await db.delete(courses);
}

async function seed() {
  console.log("Seeding database (Łatwa Fizyka)...");

  const adminHash = await bcrypt.hash("admin123", 10);
  await db
    .insert(users)
    .values({ email: "admin@fizyka.edu.pl", passwordHash: adminHash, firstName: "Admin", lastName: "Platformy", role: "admin" })
    .onConflictDoNothing();
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@fizyka.edu.pl")).limit(1);
  console.log("Admin user:", admin?.email ?? "(missing)");

  const studentHash = await bcrypt.hash("student123", 10);
  await db
    .insert(users)
    .values({ email: "uczen@fizyka.edu.pl", passwordHash: studentHash, firstName: "Kamil", lastName: "Nowak", role: "user" })
    .onConflictDoNothing();
  const [student] = await db.select().from(users).where(eq(users.email, "uczen@fizyka.edu.pl")).limit(1);
  console.log("Student user:", student?.email ?? "(missing)");

  await wipeCourseData();
  console.log("Cleared previous course data.");

  const bunnyVideos = loadBunnyVideos();
  const imageFiles = loadImageFiles();
  console.log(`Loaded ${bunnyVideos.length} Bunny videos and ${imageFiles.length} images.`);

  const [course] = await db
    .insert(courses)
    .values({ title: COURSE.title, slug: COURSE.slug, description: COURSE.description, isPublished: true })
    .returning();
  console.log("Course:", course.title);

  let videoCount = 0;
  let imageCount = 0;
  let quizCount = 0;

  for (const sec of COURSE.sections) {
    const [section] = await db
      .insert(sections)
      .values({
        courseId: course.id,
        title: sec.title,
        slug: sec.slug,
        sortOrder: sec.sortOrder,
        bunnyCollectionId: sec.bunnyCollectionId,
      })
      .returning();

    for (const lesson of sec.lessons) {
      const [topic] = await db
        .insert(topics)
        .values({
          sectionId: section.id,
          title: lesson.title,
          slug: lesson.slug,
          description: lesson.description ?? null,
          sortOrder: lesson.sortOrder,
          isPreview: lesson.isPreview ?? false,
        })
        .returning();

      const vids = videosForLesson(lesson.code, bunnyVideos);
      let filmIndex = 0;
      for (const v of vids) {
        filmIndex += 1;
        await db.insert(videos).values({
          topicId: topic.id,
          bunnyVideoId: v.bunnyVideoId,
          bunnyTitle: v.bunnyTitle,
          videoUrl: null,
          title: vids.length > 1 ? `Film ${filmIndex}` : "Film lekcji",
          durationSeconds: v.durationSeconds,
          sortOrder: v.sortOrder,
        });
        videoCount += 1;
      }

      const imgs = imagesForLesson(lesson.code, imageFiles);
      for (const img of imgs) {
        await db.insert(lessonImages).values({
          topicId: topic.id,
          imageUrl: img.imageUrl,
          alt: img.alt,
          sortOrder: img.sortOrder,
        });
        imageCount += 1;
      }

      if (lesson.quiz) {
        const [quiz] = await db
          .insert(quizzes)
          .values({ topicId: topic.id, title: `Quiz — ${lesson.title}` })
          .returning();
        quizCount += 1;
        for (let qi = 0; qi < lesson.quiz.questions.length; qi++) {
          const q = lesson.quiz.questions[qi];
          const [question] = await db
            .insert(quizQuestions)
            .values({ quizId: quiz.id, questionText: q.q, sortOrder: qi + 1 })
            .returning();
          for (const opt of q.options) {
            await db.insert(quizAnswers).values({
              questionId: question.id,
              answerLabel: opt.label,
              answerText: opt.text,
              isCorrect: opt.label.toUpperCase() === q.correct.toUpperCase(),
            });
          }
        }
      }
    }
  }

  console.log(`Inserted ${videoCount} videos, ${imageCount} images, ${quizCount} quizzes.`);

  // Demo student gets full access so the paid experience can be tested. The
  // first lesson stays a free preview for everyone via topics.isPreview.
  if (student) {
    await db
      .insert(accessGrants)
      .values({ userId: student.id, courseId: course.id, source: "admin", status: "active", validFrom: new Date() })
      .onConflictDoNothing();
    console.log("Granted demo student full course access.");
  }

  console.log("\nSeed complete.");
  console.log("Login credentials:");
  console.log("  Admin:   admin@fizyka.edu.pl / admin123");
  console.log("  Student: uczen@fizyka.edu.pl / student123");
  await pool.end();
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
