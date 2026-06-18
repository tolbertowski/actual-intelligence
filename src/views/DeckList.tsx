import { useEffect, useState } from 'react';
import { CHAPTERS } from '../data/chapters';
import { countCardsByDeck } from '../lib/db';
import { countShipped, hasShippedContent } from '../lib/decks';
import { listDecks, type ResolvedDeck } from '../lib/decksMeta';
import { studyCountsByDeck, type StudyCount } from '../lib/review';
import { navigate } from '../hooks/useHashRoute';
import type { DeckId } from '../types';

interface DeckSummary {
  shipped: number;
  user: number;
  due: number;
}

function useDeckSummaries() {
  const [summaries, setSummaries] = useState<Record<string, DeckSummary> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userCounts = await countCardsByDeck();
      const study = await studyCountsByDeck();
      const shippedEntries = await Promise.all(
        CHAPTERS.map(async (c) => [c.id, await countShipped(c.id)] as const),
      );
      if (cancelled) return;
      const next: Record<string, DeckSummary> = {};
      for (const [id, shipped] of shippedEntries) {
        const s: StudyCount = study[id] ?? { due: 0, new: 0 };
        next[id] = { shipped, user: userCounts[id] ?? 0, due: s.due };
      }
      setSummaries(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return summaries;
}

function countLabel(s: DeckSummary | undefined): string {
  if (!s) return '';
  const parts: string[] = [];
  if (s.shipped) parts.push(`${s.shipped} quiz`);
  if (s.user) parts.push(`${s.user} of yours`);
  if (parts.length === 0) return 'Empty';
  return parts.join(' · ');
}

export function DeckList() {
  const summaries = useDeckSummaries();
  const [decks, setDecks] = useState<ResolvedDeck[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listDecks().then((d) => !cancelled && setDecks(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (id: string) => navigate({ name: 'deck', deckId: id });
  const rows = decks ?? CHAPTERS.map((c) => ({ ...c, description: c.blurb }));

  return (
    <div className="page">
      <div className="deck-intro">
        <h1>Decks</h1>
        <p className="muted">
          A deck per chapter of the COMP90054 notes. Quiz questions ship with the
          app; the flashcards you write are yours, and live on this device.
        </p>
      </div>

      <ul className="deck-list" role="list">
        {rows.map((deck) => {
          const s = summaries?.[deck.id];
          const empty = summaries && !hasShippedContent(deck.id as DeckId) && !s?.user;
          return (
            <li key={deck.id}>
              <button
                className="deck-row"
                onClick={() => open(deck.id)}
                aria-label={`Open ${deck.title}`}
              >
                <span className="deck-row-main">
                  <span className="deck-row-title">{deck.title}</span>
                  <span className="deck-row-blurb muted">{deck.description}</span>
                </span>
                <span className="deck-row-meta">
                  {s && s.due > 0 && <span className="due-badge">{s.due} due</span>}
                  <span className="muted">
                    {summaries ? (empty ? 'No cards yet' : countLabel(s)) : '…'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
