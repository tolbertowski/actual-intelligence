import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Card, DeckId, ReviewRecord } from '../types';
import { DEFAULT_SETTINGS } from '../types';

// A thin wrapper over IndexedDB (via idb) for the user's authored cards.
//
// IndexedDB is treated as a *cache that can be evicted* — durability comes from
// manual JSON export, not from this store. We request persistent storage on
// first write to make eviction less likely, but never assume it succeeded.
//
// Only user-authored cards live here. Shipped quiz decks are bundled JSON and
// are loaded separately (see lib/decks.ts).

const DB_NAME = 'actual-intelligence';
const DB_VERSION = 3;
const CARD_STORE = 'cards';
const REVIEW_STORE = 'reviews';
const SETTINGS_STORE = 'settings';

/** Single settings record lives under this key. */
const SETTINGS_KEY = 'app';
type SettingsRecord = AppSettings & { id: string };

interface AIDBSchema extends DBSchema {
  cards: {
    key: string;
    value: Card;
    indexes: {
      /** All cards in a deck. */
      'by-deck': DeckId;
    };
  };
  reviews: {
    key: string;
    value: ReviewRecord;
    indexes: {
      /** All review records in a deck. */
      'by-deck': DeckId;
      /** Due-date queries across all decks. */
      'by-due': number;
    };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<AIDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<AIDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<AIDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const cards = db.createObjectStore(CARD_STORE, { keyPath: 'id' });
          cards.createIndex('by-deck', 'deck');
        }
        if (oldVersion < 2) {
          // Earlier dev builds embedded review state on the card with a
          // compound index; drop it if present, scheduling now lives separately.
          const cards = tx.objectStore(CARD_STORE);
          if (cards.indexNames.contains('by-deck-due' as never)) {
            cards.deleteIndex('by-deck-due' as never);
          }
          const reviews = db.createObjectStore(REVIEW_STORE, {
            keyPath: 'cardId',
          });
          reviews.createIndex('by-deck', 'deck');
          reviews.createIndex('by-due', 'due');
        }
        if (oldVersion < 3) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
        }
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
  const tx = db.transaction([CARD_STORE, REVIEW_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(CARD_STORE).delete(id),
    tx.objectStore(REVIEW_STORE).delete(id),
  ]);
  await tx.done;
}

// ---- Review records ------------------------------------------------------

export async function getReview(cardId: string): Promise<ReviewRecord | undefined> {
  const db = await getDB();
  return db.get(REVIEW_STORE, cardId);
}

export async function putReview(record: ReviewRecord): Promise<ReviewRecord> {
  const db = await getDB();
  await db.put(REVIEW_STORE, record);
  return record;
}

export async function getReviewsByDeck(deck: DeckId): Promise<ReviewRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex(REVIEW_STORE, 'by-deck', deck);
}

export async function getAllReviews(): Promise<ReviewRecord[]> {
  const db = await getDB();
  return db.getAll(REVIEW_STORE);
}

/** Import helper: write many review records in one transaction. */
export async function putReviews(records: ReviewRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(REVIEW_STORE, 'readwrite');
  await Promise.all(records.map((r) => tx.store.put(r)));
  await tx.done;
}

// ---- Settings ------------------------------------------------------------

/** Read settings, falling back to defaults for any unset field. */
export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const rec = await db.get(SETTINGS_STORE, SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(rec ?? {}) };
}

/** Patch settings; returns the merged result. */
export async function putSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const db = await getDB();
  const next = { ...(await getSettings()), ...patch };
  await db.put(SETTINGS_STORE, { id: SETTINGS_KEY, ...next });
  return next;
}

/** Count of user cards per deck, for the deck list. */
export async function countCardsByDeck(): Promise<Record<string, number>> {
  const cards = await getAllCards();
  const counts: Record<string, number> = {};
  for (const c of cards) counts[c.deck] = (counts[c.deck] ?? 0) + 1;
  return counts;
}
