import type { Card, DeckId, ShippedCard, ShippedDeck } from '../types';
import { getCardsByDeck } from './db';

// Loads shipped quiz decks (bundled JSON in /public/decks/) and merges them
// with the user's authored cards from IndexedDB for a given chapter.
//
// Shipped decks are fixed and shared, so they are fetched (and cached in
// memory) rather than stored per-user. User cards always come from IndexedDB.

/** Decks that ship with the app. Add a filename here when you add a deck. */
const SHIPPED_DECK_FILES: Partial<Record<DeckId, string>> = {
  mdps: 'mdps.json',
};

const memoryCache = new Map<DeckId, Card[]>();

function decksBase(): string {
  // BASE_URL ends in '/'. Works at domain root and on GitHub Pages subpaths.
  return `${import.meta.env.BASE_URL}decks/`;
}

/** Promote a hand-authored ShippedCard into a full Card at load time. */
function normaliseShipped(raw: ShippedCard, deck: DeckId, now: number): Card {
  const base = {
    // Namespaced id keeps shipped cards from ever colliding with user ids,
    // and makes them deterministic across loads.
    id: `shipped:${deck}:${raw.id}`,
    deck,
    tags: raw.tags ?? [],
    status: 'new' as const,
    source: 'shipped' as const,
    createdAt: now,
    updatedAt: now,
  };
  if (raw.kind === 'mcq') {
    // Accept either `answers: [...]` or a single `answer: n` from the JSON.
    const answers = raw.answers ?? (raw.answer != null ? [raw.answer] : []);
    return {
      ...base,
      kind: 'mcq',
      question: raw.question,
      options: raw.options,
      answers,
      explanation: raw.explanation,
    };
  }
  return { ...base, kind: 'flashcard', front: raw.front, back: raw.back };
}

/** Load just the shipped cards for a deck (cached in memory). */
export async function loadShippedDeck(deck: DeckId): Promise<Card[]> {
  const cached = memoryCache.get(deck);
  if (cached) return cached;

  const file = SHIPPED_DECK_FILES[deck];
  if (!file) {
    memoryCache.set(deck, []);
    return [];
  }

  const res = await fetch(`${decksBase()}${file}`);
  if (!res.ok) throw new Error(`Could not load deck "${deck}" (${res.status})`);

  const data = (await res.json()) as ShippedDeck;
  if (data.deck !== deck) {
    throw new Error(`Deck file for "${deck}" declares deck "${data.deck}"`);
  }

  const now = Date.now();
  const cards = data.cards.map((c) => normaliseShipped(c, deck, now));
  memoryCache.set(deck, cards);
  return cards;
}

export interface DeckContents {
  deck: DeckId;
  shipped: Card[];
  user: Card[];
  /** Convenience: shipped + user, shipped first. */
  all: Card[];
}

/** Everything renderable for a deck: shipped quiz cards plus user cards. */
export async function loadDeck(deck: DeckId): Promise<DeckContents> {
  const [shipped, user] = await Promise.all([
    loadShippedDeck(deck),
    getCardsByDeck(deck),
  ]);
  return { deck, shipped, user, all: [...shipped, ...user] };
}

/** How many shipped cards a deck has, without keeping them around. */
export async function countShipped(deck: DeckId): Promise<number> {
  return (await loadShippedDeck(deck)).length;
}

/** Decks that ship with bundled quiz content. */
export function hasShippedContent(deck: DeckId): boolean {
  return Boolean(SHIPPED_DECK_FILES[deck]);
}
