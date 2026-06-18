import { useEffect, useState } from 'react';
import { computeStats, type CollectionStats } from '../lib/stats';
import { CHAPTERS } from '../data/chapters';
import { getSettings, putSettings } from '../lib/db';
import { DEFAULT_SETTINGS } from '../types';
import { navigate } from '../hooks/useHashRoute';
import { MaturityBar, StatGrid, DueForecast } from '../components/Stats';
import { BackupPanel } from '../components/BackupPanel';
import type { ChapterId } from '../types';

export function Progress() {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [matureThreshold, setMatureThreshold] = useState(DEFAULT_SETTINGS.matureThreshold);

  useEffect(() => {
    let cancelled = false;
    void getSettings().then((s) => !cancelled && setMatureThreshold(s.matureThreshold));
    computeStats().then((s) => !cancelled && setStats(s));
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist a new maturity threshold and re-bucket the stats.
  const changeThreshold = async (next: number) => {
    const clamped = Math.max(1, Math.min(10, Math.round(next)));
    setMatureThreshold(clamped);
    await putSettings({ matureThreshold: clamped });
    setStats(await computeStats());
  };

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
            <MaturityBar stats={stats.overall} explain matureThreshold={matureThreshold} />
            <div className="threshold-control">
              <span className="muted small">Mature after</span>
              <button
                className="btn btn-ghost small"
                onClick={() => void changeThreshold(matureThreshold - 1)}
                disabled={matureThreshold <= 1}
                aria-label="Fewer reviews to mature"
              >
                −
              </button>
              <span className="threshold-value">{matureThreshold}</span>
              <button
                className="btn btn-ghost small"
                onClick={() => void changeThreshold(matureThreshold + 1)}
                disabled={matureThreshold >= 10}
                aria-label="More reviews to mature"
              >
                +
              </button>
              <span className="muted small">correct reviews in a row</span>
            </div>
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

      <BackupPanel onImported={() => void computeStats().then(setStats)} />
    </div>
  );
}
