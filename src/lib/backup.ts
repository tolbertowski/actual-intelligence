import type { Card, ReviewRecord } from '../types';
import { CHAPTER_IDS } from '../types';
import { getAllCards, getAllReviews, putCards, putReviews } from './db';

// Export / import — the durability story. IndexedDB is an evictable cache; a
// JSON file the user holds is the real backup. The format is deliberately plain
// and self-describing so it stays readable and a sync layer could adopt it
// later without a migration.

const FORMAT = 'actual-intelligence-export' as const;
const FORMAT_VERSION = 1;

export interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string;
  /** User-authored cards only — shipped quiz cards travel with the app. */
  cards: Card[];
  /** Review/scheduling records (covers shipped and user cards). */
  reviews: ReviewRecord[];
}

/** Gather everything that is the user's own: their cards and their progress. */
export async function buildBackup(): Promise<BackupFile> {
  const [cards, reviews] = await Promise.all([getAllCards(), getAllReviews()]);
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    cards: cards.filter((c) => c.source === 'user'),
    reviews,
  };
}

/** Trigger a browser download of the backup as a dated JSON file. */
export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = backup.exportedAt.slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `actual-intelligence-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface ImportResult {
  cardsAdded: number;
  cardsUpdated: number;
  cardsSkipped: number;
  reviewsMerged: number;
}

const VALID_DECKS = new Set<string>(CHAPTER_IDS);

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string' || !VALID_DECKS.has(c.deck as string)) return false;
  if (c.kind === 'flashcard') return typeof c.front === 'string' && typeof c.back === 'string';
  if (c.kind === 'mcq')
    return (
      Array.isArray(c.options) &&
      (Array.isArray(c.answers) || typeof c.answer === 'number')
    );
  return false;
}

function isReview(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.cardId === 'string' &&
    typeof r.due === 'number' &&
    typeof r.ease === 'number' &&
    typeof r.interval === 'number'
  );
}

/** Validate a parsed object and throw a friendly error if it isn't a backup. */
export function parseBackup(data: unknown): BackupFile {
  if (!data || typeof data !== 'object') {
    throw new Error('That file isn’t a backup we recognise.');
  }
  const d = data as Record<string, unknown>;
  if (d.format !== FORMAT) {
    throw new Error('That file isn’t an Actual Intelligence backup.');
  }
  const cards = Array.isArray(d.cards) ? d.cards.filter(isCard) : [];
  const reviews = Array.isArray(d.reviews) ? d.reviews.filter(isReview) : [];
  return {
    format: FORMAT,
    version: typeof d.version === 'number' ? d.version : FORMAT_VERSION,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : '',
    cards,
    reviews,
  };
}

/**
 * Merge a backup into IndexedDB. Non-destructive: existing cards are kept
 * unless the incoming copy is newer (by updatedAt), so importing can't quietly
 * clobber edits, and re-importing the same file is a no-op.
 */
export async function importBackup(backup: BackupFile): Promise<ImportResult> {
  const [existingCards, existingReviews] = await Promise.all([
    getAllCards(),
    getAllReviews(),
  ]);
  const cardById = new Map(existingCards.map((c) => [c.id, c]));
  const reviewById = new Map(existingReviews.map((r) => [r.cardId, r]));

  const result: ImportResult = {
    cardsAdded: 0,
    cardsUpdated: 0,
    cardsSkipped: 0,
    reviewsMerged: 0,
  };

  const cardsToWrite: Card[] = [];
  for (const incoming of backup.cards) {
    // Imported cards are always the user's own, regardless of file contents.
    const card: Card = { ...incoming, source: 'user' };
    // Migrate legacy single-answer MCQs (answer: number) to answers: number[].
    if (card.kind === 'mcq' && !Array.isArray(card.answers)) {
      const legacy = (incoming as { answer?: number }).answer;
      card.answers = typeof legacy === 'number' ? [legacy] : [];
    }
    const existing = cardById.get(card.id);
    if (!existing) {
      cardsToWrite.push(card);
      result.cardsAdded += 1;
    } else if ((existing.updatedAt ?? 0) < (card.updatedAt ?? 0)) {
      cardsToWrite.push(card);
      result.cardsUpdated += 1;
    } else {
      result.cardsSkipped += 1;
    }
  }

  const reviewsToWrite: ReviewRecord[] = [];
  for (const incoming of backup.reviews) {
    const existing = reviewById.get(incoming.cardId);
    if (!existing || existing.lastReviewed < incoming.lastReviewed) {
      reviewsToWrite.push(incoming);
      result.reviewsMerged += 1;
    }
  }

  if (cardsToWrite.length) await putCards(cardsToWrite);
  if (reviewsToWrite.length) await putReviews(reviewsToWrite);
  return result;
}

/** Read a File (from an <input type=file>) and import it. */
export async function importFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  return importBackup(parseBackup(data));
}
