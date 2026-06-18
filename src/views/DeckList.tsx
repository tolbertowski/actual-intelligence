import { useEffect, useState } from 'react';
import { CHAPTERS } from '../data/chapters';
import { countCardsByDeck } from '../lib/db';
import { countShipped, hasShippedContent } from '../lib/decks';
import { listDecks, saveDeckMeta, type ResolvedDeck } from '../lib/decksMeta';
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
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void listDecks().then((d) => !cancelled && setDecks(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const open = (id: string) => navigate({ name: 'deck', deckId: id });
  const rows: ResolvedDeck[] =
    decks ??
    CHAPTERS.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.blurb,
      custom: false,
      isChapter: true,
      notesPath: c.notesPath,
    }));

  const createSet = async () => {
    const name = newName.trim();
    if (!name) return;
    const id = `set:${crypto.randomUUID()}`;
    await saveDeckMeta(id, { title: name, description: '' }, true);
    navigate({ name: 'deck', deckId: id });
  };
  const totalDue = summaries
    ? Object.values(summaries).reduce((sum, s) => sum + s.due, 0)
    : 0;

  return (
    <div className="page">
      <div className="deck-intro">
        <h1>Decks</h1>
        <p className="muted">
          A deck per chapter of the COMP90054 notes. Quiz questions ship with the
          app; the flashcards you write are yours, and live on this device.
        </p>
      </div>

      <div className="revise-all">
        <div>
          <span className="revise-all-title">Revise everything</span>
          <p className="muted small">
            {totalDue > 0
              ? `${totalDue} due across all decks`
              : 'Review, practise, or quiz across every deck at once.'}
          </p>
        </div>
        <div className="revise-all-actions">
          {totalDue > 0 && (
            <button className="btn btn-primary small" onClick={() => navigate({ name: 'review' })}>
              Review all
            </button>
          )}
          <button className="btn small" onClick={() => navigate({ name: 'practice' })}>
            Practice all
          </button>
          <button className="btn small" onClick={() => navigate({ name: 'quiz' })}>
            Quiz all
          </button>
        </div>
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
                  <span className="deck-row-title">
                    {deck.title}
                    {deck.custom && <span className="tag set-tag">set</span>}
                  </span>
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

      <div className="new-set">
        {creating ? (
          <div className="new-set-form">
            <input
              type="text"
              value={newName}
              autoFocus
              placeholder="Name your set"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createSet();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button
              className="btn btn-primary small"
              onClick={() => void createSet()}
              disabled={!newName.trim()}
            >
              Create set
            </button>
            <button className="btn btn-ghost small" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost new-set-btn" onClick={() => setCreating(true)}>
            + New set
          </button>
        )}
        <p className="muted small">
          A set is your own deck — for cards that don’t fit a chapter.
        </p>
      </div>
    </div>
  );
}
