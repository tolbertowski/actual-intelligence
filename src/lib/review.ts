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

export function isReviewable(card: Card): card is Flashcard {
  return card.kind === 'flashcard' && card.status !== 'suspended';
}

export interface QueueItem {
  card: Flashcard;
  /** Prior review state, or undefined if this is a new card. */
  prior?: ReviewState;
  /** True when the card has never been reviewed. */
  isNew: boolean;
}

function shuffled<T>(input: readonly T[]): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a review queue from a card list: due today (soonest first), then new. */
function buildReviewQueue(
  flashcards: Flashcard[],
  byCard: Map<string, ReviewRecord>,
): QueueItem[] {
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

function buildPracticeQueue(
  flashcards: Flashcard[],
  byCard: Map<string, ReviewRecord>,
): QueueItem[] {
  return shuffled(flashcards).map((card) => {
    const r = byCard.get(card.id);
    return { card, prior: r, isNew: !r };
  });
}

/** Reviewable flashcards for one deck (shipped + user). */
async function deckFlashcards(deck: DeckId): Promise<Flashcard[]> {
  const [shipped, userCards] = await Promise.all([loadShippedDeck(deck), getAllCards()]);
  return [...shipped, ...userCards.filter((c) => c.deck === deck)].filter(isReviewable);
}

/** Reviewable flashcards across every deck (all shipped chapters + user cards). */
async function allFlashcards(): Promise<Flashcard[]> {
  const [shippedByDeck, userCards] = await Promise.all([
    Promise.all(CHAPTERS.map((c) => loadShippedDeck(c.id))),
    getAllCards(),
  ]);
  return [...shippedByDeck.flat(), ...userCards].filter(isReviewable);
}

/**
 * The ordered queue for a deck: cards due today (soonest first), then new
 * cards. Reviews that aren't due yet are excluded.
 */
export async function loadReviewQueue(deck: DeckId): Promise<QueueItem[]> {
  const [flashcards, reviews] = await Promise.all([
    deckFlashcards(deck),
    getReviewsByDeck(deck),
  ]);
  return buildReviewQueue(flashcards, new Map(reviews.map((r) => [r.cardId, r])));
}

/**
 * Every flashcard in a deck, shuffled, regardless of due date. Used by Practice
 * mode so the deck can be studied at any time. Grades in practice are not
 * persisted (see ReviewSession), so the SM-2 schedule is left untouched.
 */
export async function loadPracticeQueue(deck: DeckId): Promise<QueueItem[]> {
  const [flashcards, reviews] = await Promise.all([
    deckFlashcards(deck),
    getReviewsByDeck(deck),
  ]);
  return buildPracticeQueue(flashcards, new Map(reviews.map((r) => [r.cardId, r])));
}

/** Global review queue across every deck (same due/new ordering). */
export async function loadAllReviewQueue(): Promise<QueueItem[]> {
  const [flashcards, reviews] = await Promise.all([allFlashcards(), getAllReviews()]);
  return buildReviewQueue(flashcards, new Map(reviews.map((r) => [r.cardId, r])));
}

/** Global practice queue across every deck (shuffled, no scheduling). */
export async function loadAllPracticeQueue(): Promise<QueueItem[]> {
  const [flashcards, reviews] = await Promise.all([allFlashcards(), getAllReviews()]);
  return buildPracticeQueue(flashcards, new Map(reviews.map((r) => [r.cardId, r])));
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
