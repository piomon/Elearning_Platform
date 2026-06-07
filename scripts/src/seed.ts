import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcrypt";
import * as schema from "../../lib/db/src/schema/index.js";

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
  quizzes,
  quizQuestions,
  quizAnswers,
  tasks,
} = schema;

async function seed() {
  console.log("🌱 Seeding database...");

  // Admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@fizyka.edu.pl",
      passwordHash: adminHash,
      firstName: "Admin",
      lastName: "Platformy",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();
  console.log("✅ Admin user:", admin?.email ?? "(already exists)");

  // Demo student
  const studentHash = await bcrypt.hash("student123", 10);
  const [student] = await db
    .insert(users)
    .values({
      email: "uczen@fizyka.edu.pl",
      passwordHash: studentHash,
      firstName: "Kamil",
      lastName: "Nowak",
      role: "user",
    })
    .onConflictDoNothing()
    .returning();
  console.log("✅ Student user:", student?.email ?? "(already exists)");

  // Course
  const [course] = await db
    .insert(courses)
    .values({
      title: "Fizyka klasy 7 — Ruch i Siły",
      slug: "fizyka-klasa-7",
      description:
        "Kompleksowy kurs fizyki dla uczniów klasy 7. Zrozum ruch, siły, energię i podstawy elektryczności dzięki filmom, quizom i zadaniom sprawdzanym przez AI.",
      isPublished: true,
    })
    .onConflictDoNothing()
    .returning();
  console.log("✅ Course:", course?.title ?? "(already exists)");

  if (!course) {
    console.log("Course already exists, skipping section/topic seed.");
    await pool.end();
    return;
  }

  // Section 1
  const [sec1] = await db
    .insert(sections)
    .values({ courseId: course.id, title: "Dział 1: Ruch i jego opisanie", slug: "ruch", sortOrder: 1 })
    .returning();

  // Section 2
  const [sec2] = await db
    .insert(sections)
    .values({ courseId: course.id, title: "Dział 2: Siły i dynamika", slug: "sily", sortOrder: 2 })
    .returning();

  // Section 3
  const [sec3] = await db
    .insert(sections)
    .values({ courseId: course.id, title: "Dział 3: Energia i praca", slug: "energia", sortOrder: 3 })
    .returning();

  console.log("✅ 3 sections created");

  // Topics for Section 1
  const sec1Topics = [
    { title: "Co to jest ruch?", slug: "co-to-jest-ruch", description: "Poznaj podstawowe pojęcia ruchu: punkt materialny, układ odniesienia, tor i droga.", sortOrder: 1 },
    { title: "Prędkość i jej jednostki", slug: "predkosc", description: "Dowiedz się czym jest prędkość, jak ją obliczać i w jakich jednostkach wyrażać.", sortOrder: 2 },
    { title: "Ruch jednostajny prostoliniowy", slug: "ruch-jednostajny", description: "Badamy ruch ze stałą prędkością — wykresy, wzory i przykłady z życia.", sortOrder: 3 },
  ];

  const sec2Topics = [
    { title: "Siła i jej jednostki", slug: "sila", description: "Co to jest siła? Poznaj Niutona i rodzaje sił w przyrodzie.", sortOrder: 1 },
    { title: "I zasada dynamiki Newtona", slug: "pierwsza-zasada-newtona", description: "Zasada bezwładności — dlaczego ciała trwają w swoim stanie ruchu?", sortOrder: 2 },
    { title: "II zasada dynamiki Newtona", slug: "druga-zasada-newtona", description: "F = ma — najpotężniejszy wzór w klasycznej mechanice.", sortOrder: 3 },
  ];

  const sec3Topics = [
    { title: "Praca mechaniczna", slug: "praca-mechaniczna", description: "Kiedy fizyk mówi, że wykonujemy pracę? Poznaj wzór W = F·d.", sortOrder: 1 },
    { title: "Energia kinetyczna", slug: "energia-kinetyczna", description: "Energia ruchu — od czego zależy i jak ją obliczać.", sortOrder: 2 },
    { title: "Energia potencjalna", slug: "energia-potencjalna", description: "Energia związana z położeniem — jak wysokość wpływa na energię ciała.", sortOrder: 3 },
  ];

  for (const topicData of sec1Topics) {
    const [topic] = await db.insert(topics).values({ sectionId: sec1.id, ...topicData }).returning();

    // Add video
    await db.insert(videos).values({
      topicId: topic.id,
      bunnyVideoId: `demo-${topic.slug}`,
      videoUrl: null,
      title: `Film: ${topicData.title}`,
      durationSeconds: 480 + Math.floor(Math.random() * 300),
    });

    // Add quiz
    const [quiz] = await db
      .insert(quizzes)
      .values({ topicId: topic.id, title: `Quiz: ${topicData.title}` })
      .returning();

    // Add 3 questions with 4 answers each
    const quizData = getQuizDataForTopic(topicData.slug);
    for (let qi = 0; qi < quizData.length; qi++) {
      const qd = quizData[qi];
      const [question] = await db
        .insert(quizQuestions)
        .values({ quizId: quiz.id, questionText: qd.question, sortOrder: qi + 1 })
        .returning();
      for (const ans of qd.answers) {
        await db.insert(quizAnswers).values({
          questionId: question.id,
          answerLabel: ans.label,
          answerText: ans.text,
          isCorrect: ans.isCorrect,
        });
      }
    }

    // Add task
    await db.insert(tasks).values({
      topicId: topic.id,
      title: `Zadanie: ${topicData.title}`,
      description: getTaskDescription(topicData.slug),
    });
  }

  for (const topicData of sec2Topics) {
    const [topic] = await db.insert(topics).values({ sectionId: sec2.id, ...topicData }).returning();
    await db.insert(videos).values({ topicId: topic.id, bunnyVideoId: `demo-${topic.slug}`, title: `Film: ${topicData.title}`, durationSeconds: 520 + Math.floor(Math.random() * 240) });
    const [quiz] = await db.insert(quizzes).values({ topicId: topic.id, title: `Quiz: ${topicData.title}` }).returning();
    const quizData = getQuizDataGeneric(topicData.title);
    for (let qi = 0; qi < quizData.length; qi++) {
      const qd = quizData[qi];
      const [question] = await db.insert(quizQuestions).values({ quizId: quiz.id, questionText: qd.question, sortOrder: qi + 1 }).returning();
      for (const ans of qd.answers) {
        await db.insert(quizAnswers).values({ questionId: question.id, answerLabel: ans.label, answerText: ans.text, isCorrect: ans.isCorrect });
      }
    }
    await db.insert(tasks).values({ topicId: topic.id, title: `Zadanie: ${topicData.title}`, description: getTaskDescription(topicData.slug) });
  }

  for (const topicData of sec3Topics) {
    const [topic] = await db.insert(topics).values({ sectionId: sec3.id, ...topicData }).returning();
    await db.insert(videos).values({ topicId: topic.id, bunnyVideoId: `demo-${topic.slug}`, title: `Film: ${topicData.title}`, durationSeconds: 450 + Math.floor(Math.random() * 300) });
    const [quiz] = await db.insert(quizzes).values({ topicId: topic.id, title: `Quiz: ${topicData.title}` }).returning();
    const quizData = getQuizDataGeneric(topicData.title);
    for (let qi = 0; qi < quizData.length; qi++) {
      const qd = quizData[qi];
      const [question] = await db.insert(quizQuestions).values({ quizId: quiz.id, questionText: qd.question, sortOrder: qi + 1 }).returning();
      for (const ans of qd.answers) {
        await db.insert(quizAnswers).values({ questionId: question.id, answerLabel: ans.label, answerText: ans.text, isCorrect: ans.isCorrect });
      }
    }
    await db.insert(tasks).values({ topicId: topic.id, title: `Zadanie: ${topicData.title}`, description: getTaskDescription(topicData.slug) });
  }

  console.log("✅ 9 topics with videos, quizzes, and tasks created");

  // Grant student access to the course
  if (student) {
    const { accessGrants } = schema;
    await db.insert(accessGrants).values({
      userId: student.id,
      courseId: course.id,
      source: "admin",
      status: "active",
      validFrom: new Date(),
    }).onConflictDoNothing();
    console.log("✅ Student granted access to course");
  }

  console.log("\n✨ Seed complete!\n");
  console.log("Login credentials:");
  console.log("  Admin:   admin@fizyka.edu.pl / admin123");
  console.log("  Student: uczen@fizyka.edu.pl / student123");
  await pool.end();
}

function getQuizDataForTopic(slug: string) {
  if (slug === "co-to-jest-ruch") {
    return [
      {
        question: "Czym jest punkt materialny w fizyce?",
        answers: [
          { label: "A", text: "Ciało, którego rozmiary można pominąć w danym zagadnieniu", isCorrect: true },
          { label: "B", text: "Punkt na osi liczbowej", isCorrect: false },
          { label: "C", text: "Środek ciężkości ciała", isCorrect: false },
          { label: "D", text: "Dowolny punkt w przestrzeni", isCorrect: false },
        ],
      },
      {
        question: "Co to jest tor ruchu?",
        answers: [
          { label: "A", text: "Prędkość ciała", isCorrect: false },
          { label: "B", text: "Droga przebyta przez ciało", isCorrect: false },
          { label: "C", text: "Linia, wzdłuż której porusza się ciało", isCorrect: true },
          { label: "D", text: "Punkt startowy ciała", isCorrect: false },
        ],
      },
      {
        question: "Ruch jest pojęciem względnym, co oznacza, że...",
        answers: [
          { label: "A", text: "Każde ciało jest w ruchu", isCorrect: false },
          { label: "B", text: "Ocena ruchu zależy od wybranego układu odniesienia", isCorrect: true },
          { label: "C", text: "Ruchu nie można zmierzyć", isCorrect: false },
          { label: "D", text: "Prędkość jest zawsze dodatnia", isCorrect: false },
        ],
      },
    ];
  }
  if (slug === "predkosc") {
    return [
      {
        question: "Jaka jest jednostka prędkości w układzie SI?",
        answers: [
          { label: "A", text: "km/h", isCorrect: false },
          { label: "B", text: "m/s", isCorrect: true },
          { label: "C", text: "cm/s", isCorrect: false },
          { label: "D", text: "km/s", isCorrect: false },
        ],
      },
      {
        question: "Samochód przebywa 120 km w 2 godziny. Jaka jest jego średnia prędkość?",
        answers: [
          { label: "A", text: "240 km/h", isCorrect: false },
          { label: "B", text: "60 km/h", isCorrect: true },
          { label: "C", text: "120 km/h", isCorrect: false },
          { label: "D", text: "30 km/h", isCorrect: false },
        ],
      },
      {
        question: "Prędkość obliczamy jako...",
        answers: [
          { label: "A", text: "droga × czas", isCorrect: false },
          { label: "B", text: "czas / droga", isCorrect: false },
          { label: "C", text: "droga / czas", isCorrect: true },
          { label: "D", text: "masa × przyspieszenie", isCorrect: false },
        ],
      },
    ];
  }
  return getQuizDataGeneric("ruch jednostajny");
}

function getQuizDataGeneric(topicTitle: string) {
  return [
    {
      question: `Które z poniższych stwierdzeń dotyczących tematu "${topicTitle}" jest PRAWDZIWE?`,
      answers: [
        { label: "A", text: "Zjawisko to nie ma zastosowania w codziennym życiu", isCorrect: false },
        { label: "B", text: "Zrozumienie tego pojęcia jest podstawą mechaniki klasycznej", isCorrect: true },
        { label: "C", text: "Dotyczy tylko ciał o masie powyżej 1 kg", isCorrect: false },
        { label: "D", text: "Zostało odkryte dopiero w XX wieku", isCorrect: false },
      ],
    },
    {
      question: "Które wyrażenie matematyczne poprawnie opisuje to zjawisko?",
      answers: [
        { label: "A", text: "F = m × a", isCorrect: true },
        { label: "B", text: "v = s × t", isCorrect: false },
        { label: "C", text: "W = m × g", isCorrect: false },
        { label: "D", text: "E = m × c²", isCorrect: false },
      ],
    },
    {
      question: "W którym przypadku następuje BRAK sił wypadkowych działających na ciało?",
      answers: [
        { label: "A", text: "Gdy ciało spada swobodnie", isCorrect: false },
        { label: "B", text: "Gdy ciało porusza się po okręgu", isCorrect: false },
        { label: "C", text: "Gdy ciało spoczywa lub porusza się jednostajnie prostoliniowo", isCorrect: true },
        { label: "D", text: "Gdy ciało przyspiesza", isCorrect: false },
      ],
    },
  ];
}

function getTaskDescription(slug: string): string {
  const tasks: Record<string, string> = {
    "co-to-jest-ruch": "Narysuj schemat pokazujący: (1) ciało w ruchu względem pierwszego obserwatora, (2) to samo ciało w spoczynku względem drugiego obserwatora. Zaznacz układy odniesienia i wytłumacz na schemacie pojęcie względności ruchu.",
    "predkosc": "Na osi czasu narysuj wykres drogi w funkcji czasu dla dwóch samochodów: samochód A jedzie z prędkością 60 km/h, samochód B jedzie z prędkością 90 km/h. Oba startują z tego samego miejsca. Wskaż na wykresie, kiedy samochód B ma przewagę 30 km nad samochodem A.",
    "ruch-jednostajny": "Narysuj wykres v(t) i s(t) dla ruchu jednostajnego prostoliniowego. Zaznacz prędkość v = 10 m/s i oblicz, jaka droga zostanie przebyta w czasie 5 sekund. Zapisz wzory na wykresie.",
    "sila": "Narysuj ciało (np. książkę leżącą na stole) i zaznacz wszystkie siły działające na to ciało (siłę grawitacji, siłę reakcji podłoża). Narysuj wektory sił odpowiedniej długości i podpisz je.",
    "pierwsza-zasada-newtona": "Narysuj dwa przypadki: (1) ciało w spoczynku — zaznacz siły, które się równoważą; (2) ciało w ruchu jednostajnym — pokaż, dlaczego nie potrzebuje ono żadnej siły napędowej. Podpisz rysunki.",
    "druga-zasada-newtona": "Oblicz i narysuj: jeśli na ciało o masie 5 kg działa siła wypadkowa 20 N, jakie jest przyspieszenie? Narysuj ciało, wektor siły i zaznacz kierunek przyspieszenia. Użyj wzoru F = ma.",
    "praca-mechaniczna": "Narysuj człowieka pchającego skrzynkę na dystansie 10 m siłą 50 N. Oblicz wykonaną pracę (W = F × d). Następnie narysuj przypadek, gdy pcha prostopadle do kierunku ruchu — ile wynosi praca w tym przypadku?",
    "energia-kinetyczna": "Narysuj dwa samochody: jeden o masie 1000 kg jadący 20 m/s, drugi o masie 2000 kg jadący 10 m/s. Oblicz energię kinetyczną każdego (Ek = ½mv²) i zaznacz, który ma więcej energii.",
    "energia-potencjalna": "Narysuj piłkę na trzech różnych wysokościach: 0 m, 5 m i 10 m nad ziemią. Oblicz energię potencjalną na każdej wysokości (m = 0,5 kg, g = 10 m/s²). Pokaż na rysunku jak zmienia się Ep = mgh.",
  };
  return tasks[slug] ?? `Rozwiąż zadanie dotyczące tematu i narysuj diagram wyjaśniający kluczowe pojęcia. Zaznacz wzory i obliczenia.`;
}

seed().catch(console.error);
