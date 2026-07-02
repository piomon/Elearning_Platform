import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and } from "drizzle-orm";
import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as schema from "../../lib/db/src/schema/index.js";
import { COURSE, BOARD_TASKS_BY_CODE } from "./course-data.js";

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
  payments,
  landingSections,
  faqItems,
  seoSettings,
  pricingSettings,
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

// ─── CMS / SETTINGS DEFAULTS ────────────────────────────────────────────────
// Landing-page sections mirror the exact copy currently rendered by the public
// home page. `content` is a flexible JSON blob the owner can edit from the admin
// panel; the public page falls back to its baked-in copy when a key is missing,
// so editing here never breaks the layout.
const LANDING_SECTIONS: {
  key: string;
  title: string;
  sortOrder: number;
  content: Record<string, unknown>;
}[] = [
  {
    key: "hero",
    title: "Sekcja powitalna (Hero)",
    sortOrder: 1,
    content: {
      badges: ["AI sprawdza zadania", "Quizy po każdej lekcji", "Interaktywna tablica"],
      titleLine1: "Fizyka w 7 klasie",
      titleLine2: "zrozumiała jak nigdy.",
      paragraph1:
        "Fizyka w 7 klasie to nowość i spore wyzwanie. Chcesz, żeby Twoje dziecko od razu polubiło ten przedmiot, zamiast stresować się na pierwszych lekcjach? Wybierzcie innowacyjny kurs na start!",
      paragraph2:
        "Zamieniliśmy nudny podręcznik w niezwykłą przygodę. Nowoczesna platforma edukacyjna, która uczy fizyki przez interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
      ctaPrimary: "Kup dostęp",
      ctaSecondary: "Zobacz jak działa",
      ratingText: "Zaufali nam rodzice i uczniowie",
    },
  },
  {
    key: "benefits",
    title: "Pasek korzyści",
    sortOrder: 2,
    content: {
      items: [
        { title: "Program dla klasy 7", desc: "Materiały wspierają naukę fizyki w klasie 7." },
        { title: "Prosty cel", desc: "Krok po kroku do lepszych ocen." },
        { title: "Mądre powtórki", desc: "Utrwalanie zamiast wkuwania." },
        { title: "Spokojna nauka", desc: "Bez stresu i presji czasu." },
      ],
    },
  },
  {
    key: "methodology",
    title: "Jak działa nauka (metoda)",
    sortOrder: 3,
    content: {
      eyebrow: "Sprawdzona metoda",
      heading: "Jak działa nauka?",
      subheading:
        "Zaprojektowaliśmy cykl lekcji tak, aby budował pewność siebie i gwarantował zrozumienie każdego tematu.",
      steps: [
        { title: "1. Obejrzyj lekcję", description: "Krótkie, angażujące materiały wideo wyjaśniające zjawiska fizyczne na prostych, życiowych przykładach." },
        { title: "2. Rozwiąż quiz", description: "Błyskawiczny test utrwalający najważniejsze pojęcia i wzory natychmiast po obejrzeniu wideo." },
        { title: "3. Zadanie na tablicy", description: "Samodzielne rozwiązywanie zadań obliczeniowych na interaktywnej tablicy, zupełnie jak w zeszycie." },
        { title: "4. AI sprawdzi i podpowie", description: "Sztuczna inteligencja analizuje rozwiązanie i udziela wskazówek, nie wyręczając ucznia z myślenia." },
        { title: "5. Następna lekcja", description: "Gdy materiał jest opanowany, uczeń płynnie przechodzi do kolejnego zagadnienia." },
      ],
    },
  },
  {
    key: "modules",
    title: "Program nauczania (moduły)",
    sortOrder: 4,
    content: {
      heading: "Program nauczania",
      subheading:
        "Kompleksowy kurs podzielony na przystępne moduły. Każdy dział to krok do pełnego zrozumienia fizyki.",
      ctaText: "Zobacz pełny program po zalogowaniu",
    },
  },
  {
    key: "ai",
    title: "Asystent AI",
    sortOrder: 5,
    content: {
      eyebrow: "Nowość na platformie",
      heading: "Prywatny korepetytor dostępny 24/7",
      paragraph:
        "Koniec z frustracją przy zadaniach domowych. Nasza sztuczna inteligencja na bieżąco analizuje tok myślenia ucznia i naprowadza go na właściwe tory.",
      card1Title: "Uczy, nie wyręcza",
      card1Desc: "Podaje wskazówki i tłumaczy błędy, zamiast dawać gotowy wynik.",
      card2Title: "Śledzi postępy",
      card2Desc: "Analizuje, z czym uczeń ma problem i dostosowuje porady.",
    },
  },
  {
    key: "parents",
    title: "Sekcja dla rodziców",
    sortOrder: 6,
    content: {
      heading: "Spokój ducha dla rodzica",
      subheading:
        "Nie musisz być ekspertem z fizyki, aby wspierać swoje dziecko. Nasza platforma zadba o jakość i systematyczność edukacji.",
    },
  },
  {
    key: "pricing",
    title: "Cennik",
    sortOrder: 7,
    content: {
      heading: "Pełny Dostęp",
      subheading: "Wszystko, czego potrzebuje uczeń klasy 7.",
      features: [
        "Pełny dostęp do kursu fizyki klasy 7",
        "Wszystkie moduły i lekcje wideo",
        "Interaktywne quizy sprawdzające",
        "Zadania z asystentem AI",
        "Dostęp na komputerze i tablecie",
        "Brak ukrytych opłat",
      ],
      note: "Płatność przez BLIK / Paynow. Po potwierdzeniu płatności dostęp zostanie odblokowany automatycznie.",
    },
  },
  {
    key: "faq",
    title: "Najczęściej zadawane pytania",
    sortOrder: 8,
    content: {
      heading: "Często zadawane pytania",
      subheading: "Masz wątpliwości? Oto odpowiedzi na najpopularniejsze pytania.",
    },
  },
  {
    key: "contact",
    title: "Kontakt",
    sortOrder: 9,
    content: {
      heading: "Zostały pytania?",
      paragraph:
        "Jesteśmy tu, aby pomóc. Napisz do nas, jeśli potrzebujesz wsparcia technicznego lub masz pytania dotyczące zawartości kursu.",
      quickContactLabel: "Szybki kontakt",
      quickContactValue: "Odpowiadamy w ciągu 24h",
    },
  },
];

// FAQ items mirror the current home-page FAQ. The "Czy płatność jest bezpieczna?"
// item is intentionally omitted.
const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Dla kogo jest ta platforma?",
    answer:
      "Dla uczniów klasy 7 szkoły podstawowej oraz ich rodziców, którzy chcą spokojnie i skutecznie ogarnąć fizykę.",
  },
  {
    question: "Jak działa sprawdzanie zadań przez AI?",
    answer:
      "Uczeń rozwiązuje zadanie na wirtualnej tablicy, a sztuczna inteligencja analizuje tok rozumowania i wskazuje, co jest poprawne, a nad czym warto jeszcze popracować.",
  },
  {
    question: "Jak uzyskuję dostęp po zakupie?",
    answer:
      "Po potwierdzeniu płatności dostęp do wszystkich materiałów kursu odblokowuje się automatycznie — uczysz się we własnym tempie.",
  },
  {
    question: "Czy potrzebuję specjalnego sprzętu?",
    answer:
      "Do wygodnej nauki rekomendujemy komputer lub tablet. Tablica i zadania działają najlepiej na większym ekranie.",
  },
];

async function seedContent() {
  // Landing sections: keyed upsert that never clobbers owner edits on re-run.
  for (const s of LANDING_SECTIONS) {
    await db
      .insert(landingSections)
      .values({ key: s.key, title: s.title, sortOrder: s.sortOrder, isEnabled: true, content: s.content })
      .onConflictDoNothing({ target: landingSections.key });
  }

  // FAQ has no natural key — only seed when the table is empty so re-runs never
  // duplicate rows or overwrite owner-managed entries.
  const existingFaq = await db.select({ id: faqItems.id }).from(faqItems).limit(1);
  if (existingFaq.length === 0) {
    await db.insert(faqItems).values(
      FAQ_ITEMS.map((f, i) => ({ question: f.question, answer: f.answer, sortOrder: i + 1, isVisible: true })),
    );
  }

  // Singletons (id = 1): insert defaults once; never overwrite admin changes.
  await db
    .insert(seoSettings)
    .values({
      id: 1,
      metaTitle: "fizyka7 — kurs fizyki dla klasy 7",
      metaDescription:
        "fizyka7 — nowoczesny kurs fizyki dla klasy 7: interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
      ogTitle: "fizyka7 — kurs fizyki dla klasy 7",
      ogDescription:
        "fizyka7 — nowoczesny kurs fizyki dla klasy 7: interaktywne wideo, quizy i zadania z natychmiastową pomocą AI.",
      ogImage: "",
      canonicalUrl: "",
      robots: "index, follow",
    })
    .onConflictDoNothing({ target: seoSettings.id });

  await db
    .insert(pricingSettings)
    .values({
      id: 1,
      priceGrosz: 3500,
      oldPriceGrosz: 19900,
      currency: "PLN",
      promoEnabled: true,
      promoLabel: "Promocja na start",
      promoStartsAt: null,
      promoEndsAt: null,
      ctaText: "Kup dostęp i zacznij naukę",
    })
    .onConflictDoNothing({ target: pricingSettings.id });

  console.log(
    `Content seeded: ${LANDING_SECTIONS.length} landing sections, ${existingFaq.length === 0 ? FAQ_ITEMS.length : 0} new FAQ items, SEO + pricing singletons.`,
  );
}


async function seed() {
  console.log("Seeding database (Łatwa Fizyka)...");

  // Konta demo (admin + uczeń) provisionujemy TYLKO w devie albo gdy jawnie
  // włączone przez SEED_DEMO_ACCOUNTS=1. Na produkcji domyślnie ich NIE tworzymy:
  // seed uruchamia się teraz przy każdym wdrożeniu, a automatyczne konto
  // admin@fizyka.edu.pl z rolą admin byłoby ryzykiem (JIT-sync Clerk wiąże konto
  // po zweryfikowanym e-mailu). Rolę administratora na produkcji nadaje
  // ADMIN_EMAILS przy pierwszym logowaniu.
  const seedDemo = process.env.SEED_DEMO_ACCOUNTS === "1" || process.env.NODE_ENV !== "production";
  let studentId: number | null = null;
  if (seedDemo) {
    await db
      .insert(users)
      .values({ email: "admin@fizyka.edu.pl", firstName: "Admin", lastName: "Platformy", role: "admin" })
      .onConflictDoNothing();
    const [admin] = await db.select().from(users).where(eq(users.email, "admin@fizyka.edu.pl")).limit(1);
    console.log("Admin user:", admin?.email ?? "(missing)");

    await db
      .insert(users)
      .values({ email: "uczen@fizyka.edu.pl", firstName: "Kamil", lastName: "Nowak", role: "user" })
      .onConflictDoNothing();
    const [student] = await db.select().from(users).where(eq(users.email, "uczen@fizyka.edu.pl")).limit(1);
    studentId = student?.id ?? null;
    console.log("Student user:", student?.email ?? "(missing)");
  } else {
    console.log(
      "Pomijam konta demo (produkcja). Ustaw SEED_DEMO_ACCOUNTS=1, aby je utworzyć; rolę admina nadaje ADMIN_EMAILS.",
    );
  }

  // SEED_RESET=1 wipes and rebuilds all course content — DEV ONLY. It refuses
  // to run if the database holds real customer data (any payment, or an access
  // grant created by a payment), so it can never destroy paid access on
  // production. The default (no SEED_RESET) is a non-destructive import.
  if (process.env.SEED_RESET === "1") {
    const [paid] = await db.select({ id: payments.id }).from(payments).limit(1);
    const [paidGrant] = await db
      .select({ id: accessGrants.id })
      .from(accessGrants)
      .where(eq(accessGrants.source, "payment"))
      .limit(1);
    if (paid || paidGrant) {
      throw new Error(
        "SEED_RESET odrzucony: baza zawiera rzeczywiste płatności lub dostępy z płatności. " +
          "Reset skasowałby dane klientów. Uruchom seed BEZ SEED_RESET — brakujące treści " +
          "zostaną zaimportowane bez usuwania danych.",
      );
    }
    await wipeCourseData();
    console.log("SEED_RESET: wyczyszczono poprzednie treści kursu (czysty start — tryb dev).");
  }

  const bunnyVideos = loadBunnyVideos();
  const imageFiles = loadImageFiles();
  console.log(`Loaded ${bunnyVideos.length} Bunny videos and ${imageFiles.length} images.`);

  // ── Idempotentny, NIENISZCZĄCY import ──────────────────────────────────────
  // Kurs, działy i lekcje są dopasowywane po stabilnych slugach: istniejące
  // wiersze pozostają NIETKNIĘTE (dzięki temu dostępy z płatności, płatności i
  // postępy uczniów, które wskazują na ich id, są zachowane). Dodawane są tylko
  // BRAKUJĄCE działy/lekcje oraz BRAKUJĄCE materiały lekcji, więc seed można
  // bezpiecznie uruchamiać na produkcji przy każdym wdrożeniu — bez duplikatów
  // i bez kasowania danych klientów.
  let [course] = await db.select().from(courses).where(eq(courses.slug, COURSE.slug)).limit(1);
  if (!course) {
    [course] = await db
      .insert(courses)
      .values({
        title: COURSE.title,
        slug: COURSE.slug,
        description: COURSE.description,
        status: "published",
        isPublished: true,
      })
      .returning();
    console.log("Course created:", course.title);
  } else {
    console.log(`Course already present: ${course.title} (id=${course.id}) — pozostawiam bez zmian.`);
  }

  let sectionCreated = 0;
  let topicCreated = 0;
  let videoCount = 0;
  let imageCount = 0;
  let quizCount = 0;
  let taskCount = 0;

  for (const sec of COURSE.sections) {
    let [section] = await db
      .select()
      .from(sections)
      .where(and(eq(sections.courseId, course.id), eq(sections.slug, sec.slug)))
      .limit(1);
    if (!section) {
      [section] = await db
        .insert(sections)
        .values({
          courseId: course.id,
          title: sec.title,
          slug: sec.slug,
          sortOrder: sec.sortOrder,
          bunnyCollectionId: sec.bunnyCollectionId,
          status: "published",
        })
        .returning();
      sectionCreated += 1;
    }

    for (const lesson of sec.lessons) {
      let [topic] = await db
        .select()
        .from(topics)
        .where(and(eq(topics.sectionId, section.id), eq(topics.slug, lesson.slug)))
        .limit(1);
      if (!topic) {
        [topic] = await db
          .insert(topics)
          .values({
            sectionId: section.id,
            title: lesson.title,
            slug: lesson.slug,
            description: lesson.description ?? null,
            sortOrder: lesson.sortOrder,
            isPreview: lesson.isPreview ?? false,
            status: "published",
          })
          .returning();
        topicCreated += 1;
      }

      // Materiały lekcji dodajemy tylko, gdy lekcja nie ma jeszcze danego typu.
      // Dzięki temu ponowne uruchomienie nie tworzy duplikatów i nigdy nie
      // usuwa wierszy postępu, które wskazują na istniejące filmy/quizy.
      const [hasVideo] = await db.select({ id: videos.id }).from(videos).where(eq(videos.topicId, topic.id)).limit(1);
      if (!hasVideo) {
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
      }

      const [hasImage] = await db.select({ id: lessonImages.id }).from(lessonImages).where(eq(lessonImages.topicId, topic.id)).limit(1);
      if (!hasImage) {
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
      }

      if (lesson.quiz) {
        const [hasQuiz] = await db.select({ id: quizzes.id }).from(quizzes).where(eq(quizzes.topicId, topic.id)).limit(1);
        if (!hasQuiz) {
          const [quiz] = await db
            .insert(quizzes)
            .values({ topicId: topic.id, title: `Quiz — ${lesson.title}`, status: "published" })
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

      const boardTask = BOARD_TASKS_BY_CODE[lesson.code];
      if (boardTask) {
        const [hasTask] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.topicId, topic.id)).limit(1);
        if (!hasTask) {
          await db.insert(tasks).values({
            topicId: topic.id,
            title: boardTask.title,
            description: boardTask.description,
          });
          taskCount += 1;
        }
      }
    }
  }

  console.log(
    `Import: +${sectionCreated} działów, +${topicCreated} lekcji, +${videoCount} filmów, +${imageCount} grafik, +${quizCount} quizów, +${taskCount} zadań (istniejące wiersze bez zmian).`,
  );

  // Demo student gets full access so the paid experience can be tested. The
  // first lesson stays a free preview for everyone via topics.isPreview.
  if (studentId != null) {
    await db
      .insert(accessGrants)
      .values({ userId: studentId, courseId: course.id, source: "admin", status: "active", validFrom: new Date() })
      .onConflictDoNothing();
    console.log("Granted demo student full course access.");
  }

  await seedContent();

  console.log("\nSeed complete.");
  console.log(
    "Konta demo (admin@fizyka.edu.pl, uczen@fizyka.edu.pl) utworzone bez hasła — logowanie przez Clerk.",
  );
  console.log(
    "Dostęp administratora: dodaj swój email do ADMIN_EMAILS lub zaloguj się adresem admin@fizyka.edu.pl.",
  );
  await pool.end();
}

seed().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
