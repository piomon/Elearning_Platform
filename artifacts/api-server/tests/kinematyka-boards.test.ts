import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import { db } from "@workspace/db";
import { topics, videos, lessonImages } from "@workspace/db";
import { createUser, seedCourse, grantAccess } from "./helpers/factories";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

// Builds a section with two board lessons mirroring the Kinematyka layout:
// lesson A (3 task cards, one referencing a worked-example video that lives in
// lesson B) and lesson B (3 task cards, one referencing B's own video).
async function seedBoardsSection() {
  const seeded = await seedCourse({ published: true });
  const lessonA = seeded.topic;

  const [lessonB] = await db
    .insert(topics)
    .values({
      sectionId: seeded.section.id,
      title: "Temat 2",
      slug: uniq("temat"),
      sortOrder: 2,
      status: "published",
    })
    .returning();

  const remoteBunnyTitle = uniq("przyklad-w-b");
  const localBunnyTitle = uniq("przyklad-lokalny");
  const [videoInB] = await db
    .insert(videos)
    .values({
      topicId: lessonB.id,
      bunnyVideoId: uniq("bunny"),
      bunnyTitle: remoteBunnyTitle,
      title: "Przykład rozwiązany (w lekcji B)",
      sortOrder: 1,
    })
    .returning();
  const [videoLocalB] = await db
    .insert(videos)
    .values({
      topicId: lessonB.id,
      bunnyVideoId: uniq("bunny"),
      bunnyTitle: localBunnyTitle,
      title: "Przykład lokalny B",
      sortOrder: 2,
    })
    .returning();

  // Lesson A: 3 task cards (answer/solution present). Card 3 points to the
  // worked example that lives in lesson B (cross-lesson reference).
  const cardsA = [];
  for (let i = 1; i <= 3; i++) {
    const [card] = await db
      .insert(lessonImages)
      .values({
        topicId: lessonA.id,
        imageUrl: `https://example.com/a-${i}.webp`,
        alt: `Zadanie ${i}`,
        answer: `Odpowiedź ${i}`,
        solution: `Rozwiązanie ${i}`,
        relatedVideoTitle: i === 3 ? remoteBunnyTitle : null,
        sortOrder: i,
      })
      .returning();
    cardsA.push(card);
  }
  // Plus one plain material image (no answer/solution) and one degenerate
  // image with EMPTY-STRING answer/solution — neither may count towards task
  // numbering (the client treats empty strings as "not a task card" too).
  await db.insert(lessonImages).values({
    topicId: lessonA.id,
    imageUrl: "https://example.com/material.webp",
    alt: "Notatka z lekcji",
    sortOrder: 99,
  });
  await db.insert(lessonImages).values({
    topicId: lessonA.id,
    imageUrl: "https://example.com/empty.webp",
    alt: "Pusta karta",
    answer: "",
    solution: "",
    sortOrder: 100,
  });

  // Lesson B: 3 task cards; card 1 references B's own video, card 2 references
  // a title that resolves nowhere.
  const cardsB = [];
  for (let i = 1; i <= 3; i++) {
    const [card] = await db
      .insert(lessonImages)
      .values({
        topicId: lessonB.id,
        imageUrl: `https://example.com/b-${i}.webp`,
        alt: `Zadanie ${i + 3}`,
        answer: `Odpowiedź ${i + 3}`,
        solution: `Rozwiązanie ${i + 3}`,
        relatedVideoTitle:
          i === 1 ? localBunnyTitle : i === 2 ? "nie-istnieje" : null,
        sortOrder: i,
      })
      .returning();
    cardsB.push(card);
  }

  return { ...seeded, lessonA, lessonB, videoInB, videoLocalB, cardsA, cardsB };
}

describe("Tablice zadań — GET /api/topics/:id (numbering + video links)", () => {
  it("first board: offset 0, cross-lesson video resolved with owning topic id", async () => {
    const { user, token } = await createUser();
    const s = await seedBoardsSection();
    await grantAccess(user.id, s.course.id);

    const res = await request(app)
      .get(`/api/topics/${s.lessonA.id}`)
      .set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.taskCardNumberOffset).toBe(0);

    const cards = res.body.images.filter(
      (img: any) => img.answer || img.solution,
    );
    expect(cards).toHaveLength(3);

    // Card 3 must resolve to the video living in lesson B (cross-lesson).
    const card3 = cards.find((c: any) => c.id === s.cardsA[2].id);
    expect(card3.relatedVideoId).toBe(s.videoInB.id);
    expect(card3.relatedVideoTopicId).toBe(s.lessonB.id);

    // Cards without a paired video expose explicit nulls.
    const card1 = cards.find((c: any) => c.id === s.cardsA[0].id);
    expect(card1.relatedVideoId).toBeNull();
    expect(card1.relatedVideoTopicId).toBeNull();
  });

  it("second board: offset counts ONLY earlier task cards (materials excluded)", async () => {
    const { user, token } = await createUser();
    const s = await seedBoardsSection();
    await grantAccess(user.id, s.course.id);

    const res = await request(app)
      .get(`/api/topics/${s.lessonB.id}`)
      .set(auth(token));
    expect(res.status).toBe(200);
    // Lesson A holds 3 task cards + 1 plain material image; only the 3 cards
    // may shift the numbering (board B starts at "Zadanie 4").
    expect(res.body.taskCardNumberOffset).toBe(3);

    const cards = res.body.images.filter(
      (img: any) => img.answer || img.solution,
    );
    expect(cards).toHaveLength(3);
  });

  it("second board: local video resolves to own topic, unknown title stays null", async () => {
    const { user, token } = await createUser();
    const s = await seedBoardsSection();
    await grantAccess(user.id, s.course.id);

    const res = await request(app)
      .get(`/api/topics/${s.lessonB.id}`)
      .set(auth(token));
    expect(res.status).toBe(200);

    const byId = (id: number) =>
      res.body.images.find((img: any) => img.id === id);
    const local = byId(s.cardsB[0].id);
    expect(local.relatedVideoId).toBe(s.videoLocalB.id);
    expect(local.relatedVideoTopicId).toBe(s.lessonB.id);

    const unknown = byId(s.cardsB[1].id);
    expect(unknown.relatedVideoId).toBeNull();
    expect(unknown.relatedVideoTopicId).toBeNull();
  });

  it("lesson without task cards keeps offset 0 and plain images", async () => {
    const { user, token } = await createUser();
    const seeded = await seedCourse({ published: true });
    await grantAccess(user.id, seeded.course.id);
    await db.insert(lessonImages).values({
      topicId: seeded.topic.id,
      imageUrl: "https://example.com/plain.webp",
      alt: "Zwykła grafika",
      sortOrder: 1,
    });

    const res = await request(app)
      .get(`/api/topics/${seeded.topic.id}`)
      .set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.taskCardNumberOffset).toBe(0);
    expect(
      res.body.images.every((img: any) => !img.answer && !img.solution),
    ).toBe(true);
  });
});
