import type { Grade, ReviewState } from '../types';

// The SM-2 spaced-repetition algorithm (SuperMemo 2).
//
// SM-2 grades recall quality 0–5. We expose four buttons (keys 1–4) mapped
// onto the useful part of that range — a failed recall and three shades of
// success — which is the familiar Anki-style four-button layout.

const DAY_MS = 86_400_000;
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

export interface GradeOption {
  /** Keyboard key. */
  key: string;
  /** SM-2 quality passed to schedule(). */
  grade: Grade;
  label: string;
}

/** The four grade buttons, in key order. */
export const GRADE_OPTIONS: GradeOption[] = [
  { key: '1', grade: 1, label: 'Again' },
  { key: '2', grade: 3, label: 'Hard' },
  { key: '3', grade: 4, label: 'Good' },
  { key: '4', grade: 5, label: 'Easy' },
];

/** A grade below this is treated as a lapse (failed recall). */
export const LAPSE_THRESHOLD = 3;

export function isLapse(grade: Grade): boolean {
  return grade < LAPSE_THRESHOLD;
}

/**
 * Apply one review to a card's prior state (or undefined for a new card) and
 * return its next state. Pure — callers persist the result.
 */
export function schedule(
  prev: ReviewState | undefined,
  grade: Grade,
  now: number = Date.now(),
): ReviewState {
  let ease = prev?.ease ?? DEFAULT_EASE;
  let repetitions = prev?.repetitions ?? 0;
  let interval = prev?.interval ?? 0;

  if (isLapse(grade)) {
    // Failed recall: reset the streak and re-learn from a one-day interval.
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
  }

  // SM-2 easiness-factor update. Good (q=4) leaves ease unchanged; Hard (q=3)
  // lowers it, Easy (q=5) raises it.
  ease = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (ease < MIN_EASE) ease = MIN_EASE;

  return {
    ease: Math.round(ease * 1000) / 1000,
    interval,
    repetitions,
    due: now + interval * DAY_MS,
    lastReviewed: now,
  };
}

/** The interval (in days) a given grade would produce next — for button hints. */
export function previewInterval(
  prev: ReviewState | undefined,
  grade: Grade,
  now: number = Date.now(),
): number {
  return schedule(prev, grade, now).interval;
}

/** Human-friendly interval, e.g. "1 day", "6 days", "1.2 mo". */
export function formatInterval(days: number): string {
  if (days < 1) return '<1 day';
  if (days === 1) return '1 day';
  if (days < 30) return `${Math.round(days)} days`;
  if (days < 365) return `${(days / 30).toFixed(days < 60 ? 1 : 0)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}
