import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("paynow"),
    providerPaymentId: text("provider_payment_id"),
    providerSessionId: text("provider_session_id"),
    providerOrderId: text("provider_order_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("PLN"),
    status: text("status").notNull().default("pending"),
    courseId: integer("course_id").references(() => courses.id),
    // Optional discount applied at purchase. `discountGrosz` is the amount the
    // buyer saved (so `amount` is already the net charged price). Both are set
    // server-side so the buyer can never tamper with the charged price.
    discountCodeId: integer("discount_code_id"),
    discountGrosz: integer("discount_grosz").notNull().default(0),
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

// Owner-managed promotional discount codes. `type` is "percent" (value is a
// 1–100 percentage) or "amount" (value is grosz off). Validity window, total
// usage cap and per-user cap are all optional (null = unlimited). `courseId`
// null means the code applies to any course. `usedCount` is denormalised for
// fast display and kept in sync with discount_code_uses on each successful use.
export const discountCodes = pgTable(
  "discount_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type").notNull().default("percent"),
    value: integer("value").notNull(),
    courseId: integer("course_id").references(() => courses.id, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from"),
    validTo: timestamp("valid_to"),
    maxUses: integer("max_uses"),
    maxUsesPerUser: integer("max_uses_per_user"),
    usedCount: integer("used_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdByAdminId: integer("created_by_admin_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("discount_codes_code_uniq").on(table.code),
  ],
);

// Immutable audit trail of every successful discount redemption: who used which
// code, on which payment/course, and the before/after amounts (in grosz).
export const discountCodeUses = pgTable(
  "discount_code_uses",
  {
    id: serial("id").primaryKey(),
    discountCodeId: integer("discount_code_id").notNull().references(() => discountCodes.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    paymentId: integer("payment_id").references(() => payments.id, { onDelete: "set null" }),
    courseId: integer("course_id").references(() => courses.id),
    amountBeforeGrosz: integer("amount_before_grosz").notNull(),
    discountGrosz: integer("discount_grosz").notNull(),
    amountAfterGrosz: integer("amount_after_grosz").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("discount_code_uses_code_idx").on(table.discountCodeId),
    index("discount_code_uses_user_idx").on(table.userId),
    // One redemption row per payment so concurrent provider webhook retries can't
    // double-record a use or inflate usedCount — the second insert hits this
    // constraint and is skipped (ON CONFLICT DO NOTHING). payment_id is nullable,
    // and Postgres treats NULLs as distinct in a unique index, so manual/legacy
    // rows without a payment are left unconstrained.
    uniqueIndex("discount_code_uses_payment_uniq").on(table.paymentId),
  ],
);
