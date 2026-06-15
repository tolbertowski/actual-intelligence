import type { Card, DeckId, ReviewRecord } from '../types';
import { getAllCards, getAllReviews } from './db';
import { loadShippedDeck } from './decks';
import { isReviewable, endOfToday } from './review';
import { CHAPTERS } from '../data/chapters';

// Collection-snapshot statistics, derived entirely from the current SM-2 state
// in the `reviews` store — no review-event log. Only flashcards are counted
// (MCQs belong to quiz mode), matching how review scheduling works.

/** A card is "mature" once its interval reaches this many days (Anki's bar). */
export const MATURE_DAYS = 21;

/** Days shown in the due forecast, starting with today (index 0). */
export const FORECAST_DAYS = 7;

export interface DeckStats {
  /** total reviewable flashcards (shipped + user) in scope */
  total: number;
  /** never reviewed (no review record) */
  new: number;
  /** reviewed, interval < MATURE_DAYS */
  young: number;
  /** reviewed, interval >= MATURE_DAYS */
  mature: number;
  /** due today (includes anything overdue) */
  dueToday: number;
  /** mean ease over reviewed cards, or null when none reviewed */
  avgEase: number | null;
}

export interface CollectionStats {
  overall: DeckStats;
  byDeck: Record<string, DeckStats>;
  /** Due counts for today + the next FORECAST_DAYS-1 days. */
  forecast: number[];
}

function emptyStats(): DeckStats {
  return { total: 0, new: 0, young: 0, mature: 0, dueToday: 0, avgEase: null };
}

const DAY_MS = 86_400_000;

/** Local-midnight timestamp for whichever day `ts` falls in. */
function dayStartOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Compute overall and per-deck snapshot stats plus a due forecast. Loads cards
 * and review records once, then folds them together — the same shipped+user
 * join used by review.studyCountsByDeck.
 */
export async function computeStats(now: number = Date.now()): Promise<CollectionStats> {
  const [userCards, reviews] = await Promise.all([getAllCards(), getAllReviews()]);
  const shippedByDeck = await Promise.all(
    CHAPTERS.map(async (c) => await loadShippedDeck(c.id)),
  );

  const byCard = new Map<string, ReviewRecord>(reviews.map((r) => [r.cardId, r]));
  const cutoff = endOfToday(now);

  const overall = emptyStats();
  const byDeck: Record<string, DeckStats> = {};
  // Running ease totals so we can average at the end.
  const easeSum: Record<string, number> = { __all__: 0 };
  const easeCount: Record<string, number> = { __all__: 0 };

  // Forecast buckets: day 0 = today (incl. overdue), days 1..N-1 = upcoming.
  const todayStart = dayStartOf(now);
  const forecast = new Array<number>(FORECAST_DAYS).fill(0);

  const tally = (card: Card) => {
    if (!isReviewable(card)) return;
    const deck = card.deck;
    const bucket = (byDeck[deck] ??= emptyStats());
    bucket.total += 1;
    overall.total += 1;

    const r = byCard.get(card.id);
    if (!r) {
      bucket.new += 1;
      overall.new += 1;
      return;
    }

    // Reviewed card: maturity, ease, due today, and forecast placement.
    if (r.interval >= MATURE_DAYS) {
      bucket.mature += 1;
      overall.mature += 1;
    } else {
      bucket.young += 1;
      overall.young += 1;
    }

    easeSum[deck] = (easeSum[deck] ?? 0) + r.ease;
    easeCount[deck] = (easeCount[deck] ?? 0) + 1;
    easeSum.__all__ += r.ease;
    easeCount.__all__ += 1;

    if (r.due <= cutoff) {
      bucket.dueToday += 1;
      overall.dueToday += 1;
    }
    // Forecast: overdue and today land in bucket 0; cards beyond the window
    // are simply not shown.
    const idx = Math.round((dayStartOf(r.due) - todayStart) / DAY_MS);
    if (idx <= 0) forecast[0] += 1;
    else if (idx < FORECAST_DAYS) forecast[idx] += 1;
  };

  for (const cards of shippedByDeck) cards.forEach(tally);
  userCards.forEach(tally);

  const finishEase = (key: string, stats: DeckStats) => {
    stats.avgEase = easeCount[key] ? easeSum[key] / easeCount[key] : null;
  };
  finishEase('__all__', overall);
  for (const deck of Object.keys(byDeck)) finishEase(deck, byDeck[deck]);

  return { overall, byDeck, forecast };
}

/** Stats for a single deck (zeroed if the deck has no flashcards). */
export async function deckStats(deck: DeckId): Promise<DeckStats> {
  const { byDeck } = await computeStats();
  return byDeck[deck] ?? emptyStats();
}
