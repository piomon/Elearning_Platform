import { useEffect, useState } from "react";

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

/**
 * Live, ticking countdown to the evergreen end-of-September deadline.
 * Re-targets the next year's deadline automatically once one passes.
 */
export function usePromoCountdown(): Countdown {
  const [target, setTarget] = useState<Date>(() => getNextEndOfSeptember());
  const [countdown, setCountdown] = useState<Countdown>(() =>
    diffToCountdown(target, Date.now()),
  );

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (now > target.getTime()) {
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
  }, [target]);

  return countdown;
}

/** Whole-number discount percentage between an old and new price. */
export function discountPercent(oldPrice: number, price: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}
