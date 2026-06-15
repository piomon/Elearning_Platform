import { useEffect, useMemo, useState } from "react";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

/**
 * Returns the upcoming "end of September" (Sep 30, 23:59:59) deadline.
 * Evergreen: once this year's end of September has passed, it rolls forward
 * to next year's end of September, so the promo countdown never expires.
 */
export function getNextEndOfSeptember(now: Date = new Date()): Date {
  const year = now.getFullYear();
  const thisYear = new Date(year, 8, 30, 23, 59, 59, 999); // month 8 = September
  if (now.getTime() <= thisYear.getTime()) {
    return thisYear;
  }
  return new Date(year + 1, 8, 30, 23, 59, 59, 999);
}

function diffToCountdown(target: Date, now: number): Countdown {
  const total = Math.max(0, target.getTime() - now);
  const totalSeconds = Math.floor(total / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    total,
  };
}

function parseEndsAt(endsAt?: string | null): Date | null {
  if (!endsAt) return null;
  const d = new Date(endsAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Live, ticking promo countdown.
 *
 * - When `endsAt` is a valid date, counts down to that fixed deadline and
 *   clamps to zero once it passes (so callers can hide an expired promo).
 * - When `endsAt` is omitted/empty/invalid, falls back to the evergreen
 *   end-of-September deadline that re-targets next year automatically.
 */
export function usePromoCountdown(endsAt?: string | null): Countdown {
  const fixedTarget = useMemo(() => parseEndsAt(endsAt), [endsAt]);

  const [target, setTarget] = useState<Date>(
    () => fixedTarget ?? getNextEndOfSeptember(),
  );
  const [countdown, setCountdown] = useState<Countdown>(() =>
    diffToCountdown(target, Date.now()),
  );

  // Re-target whenever the fixed deadline changes (e.g. admin updates pricing).
  useEffect(() => {
    const initial = fixedTarget ?? getNextEndOfSeptember();
    setTarget(initial);
    setCountdown(diffToCountdown(initial, Date.now()));
  }, [fixedTarget]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (now > target.getTime()) {
        if (fixedTarget) {
          // Fixed promo has ended — clamp to zero and stop rolling forward.
          setCountdown(diffToCountdown(target, target.getTime()));
          return;
        }
        const next = getNextEndOfSeptember(new Date(now));
        setTarget(next);
        setCountdown(diffToCountdown(next, now));
        return;
      }
      setCountdown(diffToCountdown(target, now));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target, fixedTarget]);

  return countdown;
}

/** Whole-number discount percentage between an old and new price. */
export function discountPercent(oldPrice: number, price: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
