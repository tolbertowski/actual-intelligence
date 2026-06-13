import { useEffect, useState } from 'react';
import { CHAPTERS } from '../data/chapters';
import { countCardsByDeck } from '../lib/db';
import { countShipped, hasShippedContent } from '../lib/decks';
import { navigate } from '../hooks/useHashRoute';
import type { ChapterId } from '../types';

interface DeckSummary {
  shipped: number;
  user: number;
}

function useDeckSummaries() {
  const [summaries, setSummaries] = useState<Record<string, DeckSummary> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userCounts = await countCardsByDeck();
      const shippedEntries = await Promise.all(
        CHAPTERS.map(async (c) => [c.id, await countShipped(c.id)] as const),
      );
      if (cancelled) return;
      const next: Record<string, DeckSummary> = {};
      for (const [id, shipped] of shippedEntries) {
        next[id] = { shipped, user: userCounts[id] ?? 0 };
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

  const open = (id: ChapterId) => navigate({ name: 'deck', deckId: id });

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
        {CHAPTERS.map((chapter) => {
          const s = summaries?.[chapter.id];
          const empty = summaries && !hasShippedContent(chapter.id) && !s?.user;
          return (
            <li key={chapter.id}>
              <button
                className="deck-row"
                onClick={() => open(chapter.id)}
                aria-label={`Open ${chapter.title}`}
              >
                <span className="deck-row-main">
                  <span className="deck-row-title">{chapter.title}</span>
                  <span className="deck-row-blurb muted">{chapter.blurb}</span>
                </span>
                <span className="deck-row-meta muted">
                  {summaries ? (empty ? 'No cards yet' : countLabel(s)) : '…'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
