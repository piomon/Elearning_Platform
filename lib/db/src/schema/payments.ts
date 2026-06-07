import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { courses } from "./courses";

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("przelewy24"),
  providerPaymentId: text("provider_payment_id"),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("PLN"),
  status: text("status").notNull().default("pending"),
  courseId: integer("course_id").references(() => courses.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const paymentRefunds = pgTable("payment_refunds", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  adminId: integer("admin_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  providerRefundId: text("provider_refund_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accessGrants = pgTable("access_grants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull().references(() => courses.id),
  source: text("source").notNull().default("payment"),
  paymentId: integer("payment_id").references(() => payments.id),
  grantedByAdminId: integer("granted_by_admin_id").references(() => users.id),
  status: text("status").notNull().default("active"),
  validFrom: timestamp("valid_from").notNull().defaultNow(),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
