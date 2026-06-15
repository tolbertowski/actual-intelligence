import { useEffect, useState } from 'react';
import { computeStats, type CollectionStats } from '../lib/stats';
import { CHAPTERS } from '../data/chapters';
import { navigate } from '../hooks/useHashRoute';
import { MaturityBar, StatGrid, DueForecast } from '../components/Stats';
import type { ChapterId } from '../types';

export function Progress() {
  const [stats, setStats] = useState<CollectionStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    computeStats().then((s) => !cancelled && setStats(s));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) {
    return (
      <div className="page">
        <h1>Progress</h1>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const noCards = stats.overall.total === 0;

  // Decks with at least one flashcard, in teaching order.
  const decksWithCards = CHAPTERS.filter((c) => (stats.byDeck[c.id]?.total ?? 0) > 0);

  return (
    <div className="page">
      <div className="deck-intro">
        <h1>Progress</h1>
        <p className="muted">
          A snapshot of your flashcards across every chapter — how far each card
          has matured, and what's due. Built from this device only.
        </p>
      </div>

      {noCards ? (
        <div className="deck-section-empty">
          <p>
            No flashcards yet, so there's nothing to measure. Open a deck and
            write a card — the studying starts there.
          </p>
          <button className="btn" onClick={() => navigate({ name: 'decks' })}>
            Browse decks
          </button>
        </div>
      ) : (
        <>
          <section className="progress-overall">
            <StatGrid stats={stats.overall} />
            <MaturityBar stats={stats.overall} />
            <DueForecast forecast={stats.forecast} />
          </section>

          <section className="deck-section">
            <div className="deck-section-head">
              <h2>By chapter</h2>
              <span className="muted">{decksWithCards.length}</span>
            </div>
            <hr className="hairline" />
            <ul className="progress-deck-list" role="list">
              {decksWithCards.map((chapter) => {
                const s = stats.byDeck[chapter.id];
                return (
                  <li key={chapter.id}>
                    <button
                      className="progress-deck-row"
                      onClick={() =>
                        navigate({ name: 'deck', deckId: chapter.id as ChapterId })
                      }
                    >
                      <span className="progress-deck-main">
                        <span className="progress-deck-title">{chapter.title}</span>
                        <MaturityBar stats={s} showLegend={false} />
                      </span>
                      <span className="progress-deck-meta muted">
                        {s.dueToday > 0 && (
                          <span className="due-badge">{s.dueToday} due</span>
                        )}
                        <span>{s.total} cards</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
