import type { Card, DeckId, Flashcard, Grade, ReviewRecord, ReviewState } from '../types';
import { getAllCards, getReviewsByDeck, getAllReviews, putReview } from './db';
import { loadShippedDeck } from './decks';
import { CHAPTERS } from '../data/chapters';
import { schedule } from './sm2';

// Bridges cards and their SM-2 review records: builds the study queue for a
// deck, applies a grade, and counts what's due. Only flashcards are reviewed
// here — multiple-choice cards belong to quiz mode.

/** End of the current local day, in epoch ms. A card due any time today counts. */
export function endOfToday(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function isReviewable(card: Card): card is Flashcard {
  return card.kind === 'flashcard' && card.status !== 'suspended';
}

export interface QueueItem {
  card: Flashcard;
  /** Prior review state, or undefined if this is a new card. */
  prior?: ReviewState;
  /** True when the card has never been reviewed. */
  isNew: boolean;
}

/**
 * The ordered queue for a deck: cards due today (soonest first), then new
 * cards. Reviews that aren't due yet are excluded.
 */
export async function loadReviewQueue(deck: DeckId): Promise<QueueItem[]> {
  const [shipped, userCards, reviews] = await Promise.all([
    loadShippedDeck(deck),
    getAllCards(),
    getReviewsByDeck(deck),
  ]);
  const flashcards = [...shipped, ...userCards.filter((c) => c.deck === deck)].filter(
    isReviewable,
  );
  const byCard = new Map(reviews.map((r) => [r.cardId, r]));
  const cutoff = endOfToday();

  const due: { item: QueueItem; due: number }[] = [];
  const fresh: QueueItem[] = [];
  for (const card of flashcards) {
    const r = byCard.get(card.id);
    if (!r) {
      fresh.push({ card, isNew: true });
    } else if (r.due <= cutoff) {
      due.push({ item: { card, prior: r, isNew: false }, due: r.due });
    }
  }
  due.sort((a, b) => a.due - b.due);
  return [...due.map((d) => d.item), ...fresh];
}

/** Apply a grade to a card and persist the new review record. */
export async function gradeCard(
  card: Card,
  prior: ReviewState | undefined,
  grade: Grade,
): Promise<ReviewRecord> {
  const next = schedule(prior, grade);
  const record: ReviewRecord = { ...next, cardId: card.id, deck: card.deck };
  await putReview(record);
  return record;
}

export interface StudyCount {
  due: number;
  new: number;
}

export function studyTotal(count: StudyCount): number {
  return count.due + count.new;
}

/** Due + new flashcard counts for every deck, for the deck list and headers. */
export async function studyCountsByDeck(): Promise<Record<string, StudyCount>> {
  const [userCards, reviews] = await Promise.all([getAllCards(), getAllReviews()]);
  const shippedByDeck = await Promise.all(
    CHAPTERS.map(async (c) => [c.id, await loadShippedDeck(c.id)] as const),
  );

  const byCard = new Map(reviews.map((r) => [r.cardId, r]));
  const cutoff = endOfToday();
  const result: Record<string, StudyCount> = {};

  const tally = (card: Card) => {
    if (!isReviewable(card)) return;
    const bucket = (result[card.deck] ??= { due: 0, new: 0 });
    const r = byCard.get(card.id);
    if (!r) bucket.new += 1;
    else if (r.due <= cutoff) bucket.due += 1;
  };

  for (const [, cards] of shippedByDeck) cards.forEach(tally);
  userCards.forEach(tally);
  return result;
}

/** Due + new counts for a single deck. */
export async function studyCount(deck: DeckId): Promise<StudyCount> {
  const counts = await studyCountsByDeck();
  return counts[deck] ?? { due: 0, new: 0 };
}
