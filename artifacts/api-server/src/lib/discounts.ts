import { db } from "@workspace/db";
import { discountCodes, discountCodeUses } from "@workspace/db";
import { and, eq, count } from "drizzle-orm";

export const DISCOUNT_TYPES = ["percent", "amount"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export type DiscountCodeRow = typeof discountCodes.$inferSelect;

export type DiscountValidation =
  | {
      ok: true;
      code: DiscountCodeRow;
      amountBeforeGrosz: number;
      discountGrosz: number;
      amountAfterGrosz: number;
    }
  | { ok: false; status: number; error: string };

// Normalise a user-entered code: trim + uppercase so "lato2026" == "LATO2026".
export function normalizeCode(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}

// Compute the net amount (grosz) after applying a discount, clamped to >= 0.
export function applyDiscount(
  type: DiscountType,
  value: number,
  amountBeforeGrosz: number,
): { discountGrosz: number; amountAfterGrosz: number } {
  let discountGrosz: number;
  if (type === "percent") {
    discountGrosz = Math.round((amountBeforeGrosz * value) / 100);
  } else {
    discountGrosz = value;
  }
  discountGrosz = Math.max(0, Math.min(discountGrosz, amountBeforeGrosz));
  return { discountGrosz, amountAfterGrosz: amountBeforeGrosz - discountGrosz };
}

// Full validation of a code for a given user + course + base price. Checks the
// active flag, validity window, course scope, total usage cap and per-user cap,
// and that the code is well-formed. Returns the computed amounts when valid.
export async function validateDiscountForPurchase(opts: {
  rawCode: string;
  userId: number;
  courseId: number;
  amountBeforeGrosz: number;
  now?: Date;
}): Promise<DiscountValidation> {
  const code = normalizeCode(opts.rawCode);
  if (!code) return { ok: false, status: 400, error: "Podaj kod rabatowy" };

  const [row] = await db
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code))
    .limit(1);

  if (!row) return { ok: false, status: 404, error: "Kod rabatowy nie istnieje" };
  if (!row.isActive) return { ok: false, status: 400, error: "Kod rabatowy jest nieaktywny" };

  const now = opts.now ?? new Date();
  if (row.validFrom && now < row.validFrom)
    return { ok: false, status: 400, error: "Kod rabatowy jeszcze nie obowiązuje" };
  if (row.validTo && now > row.validTo)
    return { ok: false, status: 400, error: "Kod rabatowy wygasł" };

  if (row.courseId != null && row.courseId !== opts.courseId)
    return { ok: false, status: 400, error: "Kod rabatowy nie obowiązuje na ten kurs" };

  if (row.maxUses != null && row.usedCount >= row.maxUses)
    return { ok: false, status: 400, error: "Limit użyć kodu został wyczerpany" };

  if (row.maxUsesPerUser != null) {
    const [{ used }] = await db
      .select({ used: count() })
      .from(discountCodeUses)
      .where(and(eq(discountCodeUses.discountCodeId, row.id), eq(discountCodeUses.userId, opts.userId)));
    if (Number(used) >= row.maxUsesPerUser)
      return { ok: false, status: 400, error: "Wykorzystano już ten kod maksymalną liczbę razy" };
  }

  const { discountGrosz, amountAfterGrosz } = applyDiscount(
    row.type as DiscountType,
    row.value,
    opts.amountBeforeGrosz,
  );

  return {
    ok: true,
    code: row,
    amountBeforeGrosz: opts.amountBeforeGrosz,
    discountGrosz,
    amountAfterGrosz,
  };
}
