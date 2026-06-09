import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { courses, sections, topics, videos } from "./courses";

export const learningProgress = pgTable(
  "learning_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id").notNull().references(() => courses.id),
    sectionId: integer("section_id").references(() => sections.id),
    topicId: integer("topic_id").notNull().references(() => topics.id),
    currentElementType: text("current_element_type"),
    status: text("status").notNull().default("in_progress"),
    videoCompleted: boolean("video_completed").notNull().default(false),
    quizCompleted: boolean("quiz_completed").notNull().default(false),
    taskStarted: boolean("task_started").notNull().default(false),
    taskCheckedByAi: boolean("task_checked_by_ai").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("learning_progress_user_topic_uniq").on(table.userId, table.topicId),
  ],
);

// Per-video watch tracking. Updated periodically from the player so progress and
// "video watched" completion are derived from real watch time, never trusted
// blindly from the client for access decisions.
export const videoProgress = pgTable(
  "video_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    topicId: integer("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds"),
    progressPercent: integer("progress_percent").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("video_progress_user_video_uniq").on(table.userId, table.videoId),
  ],
);
