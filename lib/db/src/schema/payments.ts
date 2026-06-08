import { pgTable, serial, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("przelewy24"),
    providerPaymentId: text("provider_payment_id"),
    providerSessionId: text("provider_session_id"),
    providerOrderId: text("provider_order_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("PLN"),
    status: text("status").notNull().default("pending"),
    courseId: integer("course_id").references(() => courses.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payments_provider_payment_id_uniq").on(table.providerPaymentId),
    index("payments_user_status_idx").on(table.userId, table.status),
  ],
);

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

export const accessGrants = pgTable(
  "access_grants",
  {
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
  },
  (table) => [
    index("access_grants_user_course_status_idx").on(
      table.userId,
      table.courseId,
      table.status,
    ),
    uniqueIndex("access_grants_active_user_course_uniq")
      .on(table.userId, table.courseId)
      .where(sql`${table.status} = 'active'`),
  ],
);
