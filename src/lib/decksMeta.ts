import type { ChapterId, DeckMeta } from '../types';
import { CHAPTERS, getChapter, isChapterId } from '../data/chapters';
import { getAllDeckMeta, getDeckMeta, putDeckMeta } from './db';

// Resolves a deck's displayed identity from two sources: the static chapter
// defaults (data/chapters.ts) and the user's DeckMeta overrides / custom sets
// in IndexedDB. Everything that shows a deck title/description goes through
// here so renames and custom sets appear consistently.

export interface ResolvedDeck {
  id: string;
  title: string;
  description: string;
  /** True for a user-created set (not a course chapter). */
  custom: boolean;
  /** True for a built-in course chapter. */
  isChapter: boolean;
  /** Course-notes link, chapters only. */
  notesPath?: string;
}

/** Resolve one deck from a prefetched meta map (chapter override or custom set). */
export function resolveDeck(
  id: string,
  metaById: Map<string, DeckMeta>,
): ResolvedDeck | undefined {
  const meta = metaById.get(id);
  if (isChapterId(id)) {
    const chapter = getChapter(id as ChapterId)!;
    return {
      id,
      title: meta?.title?.trim() || chapter.title,
      description: meta?.description?.trim() || chapter.blurb,
      custom: false,
      isChapter: true,
      notesPath: chapter.notesPath,
    };
  }
  if (meta?.custom) {
    return {
      id,
      title: meta.title?.trim() || 'Untitled set',
      description: meta.description?.trim() || '',
      custom: true,
      isChapter: false,
    };
  }
  return undefined;
}

/** All decks in display order: course chapters first, then custom sets. */
export async function listDecks(): Promise<ResolvedDeck[]> {
  const metas = await getAllDeckMeta();
  const map = new Map(metas.map((m) => [m.id, m]));
  const chapters = CHAPTERS.map((c) => resolveDeck(c.id, map)!);
  const custom = metas
    .filter((m) => m.custom)
    .map((m) => resolveDeck(m.id, map)!)
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...chapters, ...custom];
}

/** Resolve a single deck (async convenience). */
export async function loadDeckMeta(id: string): Promise<ResolvedDeck | undefined> {
  const metas = await getAllDeckMeta();
  return resolveDeck(id, new Map(metas.map((m) => [m.id, m])));
}

/** Save a title/description for a deck (override for a chapter, edit for a set). */
export async function saveDeckMeta(
  id: string,
  fields: { title: string; description: string },
  custom: boolean,
): Promise<DeckMeta> {
  const existing = await getDeckMeta(id);
  const now = Date.now();
  return putDeckMeta({
    id,
    title: fields.title.trim() || undefined,
    description: fields.description.trim() || undefined,
    custom,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
