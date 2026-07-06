import { db } from "@workspace/db";
import {
  users,
  courses,
  sections,
  topics,
  videos,
  quizzes,
  quizQuestions,
  quizAnswers,
  tasks,
  accessGrants,
} from "@workspace/db";

let counter = 0;
function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createUser(
  opts: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: "user" | "admin";
    isBanned?: boolean;
    bannedReason?: string;
    clerkUserId?: string;
  } = {},
) {
  const clerkUserId = opts.clerkUserId ?? uniq("clerk");
  const [user] = await db
    .insert(users)
    .values({
      email: (opts.email ?? `${uniq("user")}@test.pl`).toLowerCase(),
      clerkUserId,
      firstName: opts.firstName ?? "Jan",
      lastName: opts.lastName ?? "Testowy",
      role: opts.role ?? "user",
      isBanned: opts.isBanned ?? false,
      bannedReason: opts.bannedReason ?? null,
    })
    .returning();
  // Tests authenticate with `Authorization: Bearer <token>`. The @clerk/express
  // mock in tests/setup.ts maps that bearer value straight to a Clerk userId,
  // so the token is simply this user's clerk_user_id (the JIT sync then resolves
  // it via its fast path without ever calling clerkClient).
  return { user, token: clerkUserId, clerkUserId };
}

export async function createAdmin() {
  return createUser({ role: "admin" });
}

export async function grantAccess(
  userId: number,
  courseId: number,
  opts: { validTo?: Date | null; status?: string } = {},
) {
  const [grant] = await db
    .insert(accessGrants)
    .values({
      userId,
      courseId,
      source: "admin",
      status: opts.status ?? "active",
      validFrom: new Date(Date.now() - 1000),
      validTo: opts.validTo ?? null,
    })
    .returning();
  return grant;
}

type PublishStatus = "draft" | "published" | "hidden" | "archived";

// Builds a complete, published course graph: course -> section -> topic with a
// video, a 2-question quiz (answer "A" correct in each) and a task.
// `status` is the authoritative visibility flag; `published` maps to it for
// back-compat (true -> "published", false -> "draft") and keeps isPublished in
// sync, mirroring the derived-on-write behaviour in the admin routes.
export async function seedCourse(
  opts: { published?: boolean; status?: PublishStatus } = {},
) {
  const published = opts.published ?? true;
  const status: PublishStatus = opts.status ?? (published ? "published" : "draft");
  const [course] = await db
    .insert(courses)
    .values({
      title: "Kurs testowy",
      slug: uniq("kurs"),
      description: "Opis kursu testowego",
      isPublished: status === "published",
      status,
    })
    .returning();

  const [section] = await db
    .insert(sections)
    .values({
      courseId: course.id,
      title: "Dział 1",
      slug: uniq("dzial"),
      sortOrder: 1,
    })
    .returning();

  const [topic] = await db
    .insert(topics)
    .values({
      sectionId: section.id,
      title: "Temat 1",
      slug: uniq("temat"),
      description: "Opis tematu",
      sortOrder: 1,
    })
    .returning();

  const [video] = await db
    .insert(videos)
    .values({
      topicId: topic.id,
      bunnyVideoId: uniq("demo-video"),
      title: "Film testowy",
      durationSeconds: 120,
    })
    .returning();

  const [quiz] = await db
    .insert(quizzes)
    .values({ topicId: topic.id, title: "Quiz testowy" })
    .returning();

  const [task] = await db
    .insert(tasks)
    .values({
      topicId: topic.id,
      title: "Zadanie testowe",
      description: "Treść zadania testowego",
    })
    .returning();

  const labels = ["A", "B", "C", "D"];
  const questions: Array<{
    id: number;
    answers: Array<{ id: number; isCorrect: boolean }>;
    correctAnswerId: number;
  }> = [];

  for (let i = 0; i < 2; i++) {
    const [question] = await db
      .insert(quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Pytanie ${i + 1}`,
        sortOrder: i + 1,
      })
      .returning();

    const answers: Array<{ id: number; isCorrect: boolean }> = [];
    for (let j = 0; j < labels.length; j++) {
      const [answer] = await db
        .insert(quizAnswers)
        .values({
          questionId: question.id,
          answerLabel: labels[j],
          answerText: `Odpowiedź ${labels[j]}`,
          isCorrect: j === 0,
        })
        .returning();
      answers.push({ id: answer.id, isCorrect: answer.isCorrect });
    }

    questions.push({
      id: question.id,
      answers,
      correctAnswerId: answers[0].id,
    });
  }

  return { course, section, topic, video, quiz, task, questions };
}
