import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Card, DeckId } from '../types';

// A thin wrapper over IndexedDB (via idb) for the user's authored cards.
//
// IndexedDB is treated as a *cache that can be evicted* — durability comes from
// manual JSON export, not from this store. We request persistent storage on
// first write to make eviction less likely, but never assume it succeeded.
//
// Only user-authored cards live here. Shipped quiz decks are bundled JSON and
// are loaded separately (see lib/decks.ts).

const DB_NAME = 'actual-intelligence';
const DB_VERSION = 1;
const CARD_STORE = 'cards';

interface AIDBSchema extends DBSchema {
  cards: {
    key: string;
    value: Card;
    indexes: {
      /** All cards in a deck. */
      'by-deck': DeckId;
      /** Due-today queries: scan ascending by due timestamp within a deck. */
      'by-deck-due': [DeckId, number];
    };
  };
}

let dbPromise: Promise<IDBPDatabase<AIDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<AIDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AIDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(CARD_STORE, { keyPath: 'id' });
        store.createIndex('by-deck', 'deck');
        // Compound index lets us page through a deck ordered by due date.
        store.createIndex('by-deck-due', ['deck', 'review.due']);
      },
    });
  }
  return dbPromise;
}

/**
 * Ask the browser to keep our data through storage pressure. Best-effort:
 * the prompt may be auto-denied or auto-granted depending on engagement.
 * Call this on the first card the user creates, not on every load.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** True if the browser has granted persistent storage. */
export async function isPersisted(): Promise<boolean> {
  if (!navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export async function getAllCards(): Promise<Card[]> {
  const db = await getDB();
  return db.getAll(CARD_STORE);
}

export async function getCardsByDeck(deck: DeckId): Promise<Card[]> {
  const db = await getDB();
  return db.getAllFromIndex(CARD_STORE, 'by-deck', deck);
}

export async function getCard(id: string): Promise<Card | undefined> {
  const db = await getDB();
  return db.get(CARD_STORE, id);
}

/** Insert or replace a card. Returns the stored card. */
export async function putCard(card: Card): Promise<Card> {
  const db = await getDB();
  await db.put(CARD_STORE, card);
  return card;
}

/** Insert/replace many cards in a single transaction (used by import). */
export async function putCards(cards: Card[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(CARD_STORE, 'readwrite');
  await Promise.all(cards.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(CARD_STORE, id);
}

/** Count of user cards per deck, for the deck list. */
export async function countCardsByDeck(): Promise<Record<string, number>> {
  const cards = await getAllCards();
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.deck] = (counts[c.deck] ?? 0) + 1;
  return counts;
}
