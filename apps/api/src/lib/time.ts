import { differenceInMinutes, addMinutes, isBefore, isAfter } from "date-fns";

export type UrgencyBucket = "OVERDUE" | "DUE_NOW" | "DUE_SOON" | "LATER" | "COMPLETED";

export interface TaskUrgencyResult {
  bucket: UrgencyBucket;
  nextDueTime: Date;
  minutesUntilDue: number;
  missedIntervals: number;
}

/**
 * Core scheduling logic from Build Spec §5:
 * next_due_time = anchor_time + (frequency_minutes * n)
 * n = smallest integer such that next_due_time > last_logged_time
 */
export function computeNextDueTime(
  anchorTime: Date,
  frequencyMinutes: number | null,
  lastLoggedTime: Date | null
): Date {
  // One-time task
  if (!frequencyMinutes) {
    return anchorTime;
  }

  const now = new Date();

  if (!lastLoggedTime) {
    // No log yet: find the most recent occurrence before now so each
    // recurring task shows its own correct overdue delta rather than
    // all returning the same morning anchor time.
    if (!isBefore(anchorTime, now)) {
      return anchorTime; // anchor is still in the future
    }
    let n = 0;
    let prev = new Date(anchorTime);
    let next = new Date(anchorTime);
    while (isBefore(next, now)) {
      prev = new Date(next);
      n++;
      next = addMinutes(anchorTime, frequencyMinutes * n);
    }
    return prev;
  }

  // Has a prior log: find the next occurrence after lastLoggedTime
  let n = 0;
  let nextDue = new Date(anchorTime);
  while (!isAfter(nextDue, lastLoggedTime) || isBefore(nextDue, anchorTime)) {
    n++;
    nextDue = addMinutes(anchorTime, frequencyMinutes * n);
  }
  return nextDue;
}

/** Next scheduled occurrence exactly one interval after currentTime. */
export function getNextOccurrence(currentTime: Date, frequencyMinutes: number): Date {
  return addMinutes(currentTime, frequencyMinutes);
}

/**
 * Computes missed intervals since anchor.
 * Derived from how many scheduled intervals passed without a log.
 */
export function computeMissedIntervals(
  anchorTime: Date,
  frequencyMinutes: number | null,
  lastLoggedTime: Date | null,
  now: Date = new Date()
): number {
  if (!frequencyMinutes || !lastLoggedTime) return 0;

  const minutesSinceLast = differenceInMinutes(now, lastLoggedTime);
  const missed = Math.floor(minutesSinceLast / frequencyMinutes) - 1;
  return Math.max(0, missed);
}

/**
 * Determines urgency bucket using fixed global thresholds:
 *   OVERDUE  — past due (< 0 min)
 *   DUE_NOW  — due within ≤ 10 min
 *   DUE_SOON — due in 10–30 min
 *   LATER    — due in > 30 min
 *
 * graceMinutes / lookaheadMinutes are no longer used for display classification;
 * grace is still used by taskLog.service for the wasOverdue audit flag.
 */
export function computeUrgencyBucket(
  nextDueTime: Date,
  now: Date = new Date()
): UrgencyBucket {
  const minutesUntilDue = differenceInMinutes(nextDueTime, now);

  if (minutesUntilDue < 0) return "OVERDUE";
  if (minutesUntilDue <= 10) return "DUE_NOW";
  if (minutesUntilDue <= 30) return "DUE_SOON";
  return "LATER";
}

export function computeTaskUrgency(
  anchorTime: Date,
  frequencyMinutes: number | null,
  graceMinutes: number,
  lookaheadMinutes: number,
  lastLoggedTime: Date | null,
  now: Date = new Date()
): TaskUrgencyResult {
  const nextDueTime = computeNextDueTime(anchorTime, frequencyMinutes, lastLoggedTime);
  const minutesUntilDue = differenceInMinutes(nextDueTime, now);
  const bucket = computeUrgencyBucket(nextDueTime, now);
  const missedIntervals = computeMissedIntervals(anchorTime, frequencyMinutes, lastLoggedTime, now);

  return { bucket, nextDueTime, minutesUntilDue, missedIntervals };
}

export function isOverdue(nextDueTime: Date, graceMinutes: number, now: Date = new Date()): boolean {
  const minutesUntilDue = differenceInMinutes(nextDueTime, now);
  return minutesUntilDue < -graceMinutes;
}

export function formatMinutesRelative(minutes: number): string {
  if (minutes === 0) return "due now";
  const absMin = Math.abs(minutes);
  if (absMin < 60) {
    return minutes < 0 ? `${absMin}m overdue` : `in ${absMin}m`;
  }
  const hours = Math.floor(absMin / 60);
  const mins = absMin % 60;
  const label = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return minutes < 0 ? `${label} overdue` : `in ${label}`;
}
