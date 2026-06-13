import { useEffect, useState } from 'react';
import { getChapter, isChapterId } from '../data/chapters';
import { loadDeck, type DeckContents } from '../lib/decks';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import type { Card } from '../types';

function CardPreview({ card }: { card: Card }) {
  return (
    <li className="card-preview">
      <div className="card-preview-kind muted">
        {card.kind === 'mcq' ? 'Quiz' : 'Flashcard'}
        {card.source === 'shipped' && <span className="tag">shipped</span>}
      </div>
      <div className="card-preview-body">
        <RichText serif>
          {card.kind === 'mcq' ? card.question : card.front}
        </RichText>
      </div>
      {card.tags.length > 0 && (
        <div className="card-preview-tags">
          {card.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

export function DeckView({ deckId }: { deckId: string }) {
  const [contents, setContents] = useState<DeckContents | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = isChapterId(deckId);
  const chapter = valid ? getChapter(deckId) : undefined;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    setContents(null);
    setError(null);
    loadDeck(deckId)
      .then((c) => !cancelled && setContents(c))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [deckId, valid]);

  if (!valid || !chapter) {
    return (
      <div className="page">
        <p>That deck doesn’t exist.</p>
        <button className="btn" onClick={() => navigate({ name: 'decks' })}>
          Back to decks
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <button
        className="btn-ghost back-link"
        onClick={() => navigate({ name: 'decks' })}
      >
        ← Decks
      </button>

      <div className="deck-header">
        <h1>{chapter.title}</h1>
        <p className="muted">{chapter.blurb}</p>
        <a
          className="notes-link"
          href={chapter.notesPath}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read the chapter notes ↗
        </a>
      </div>

      {error && <p className="error">Couldn’t load this deck: {error}</p>}

      {!contents && !error && <p className="muted">Loading…</p>}

      {contents && (
        <>
          <section className="deck-section">
            <div className="deck-section-head">
              <h2>Quiz questions</h2>
              <span className="muted">{contents.shipped.length}</span>
            </div>
            <hr className="hairline" />
            {contents.shipped.length === 0 ? (
              <p className="muted deck-section-empty">
                No quiz questions for this chapter yet. The flashcards you write
                below are the studying.
              </p>
            ) : (
              <ul className="card-preview-list" role="list">
                {contents.shipped.map((c) => (
                  <CardPreview key={c.id} card={c} />
                ))}
              </ul>
            )}
          </section>

          <section className="deck-section">
            <div className="deck-section-head">
              <h2>Your flashcards</h2>
              <span className="muted">{contents.user.length}</span>
            </div>
            <hr className="hairline" />
            {contents.user.length === 0 ? (
              <div className="deck-section-empty">
                <p>
                  Nothing here yet. The cards you write are the studying — start
                  one and it’s saved to this device.
                </p>
                <p className="muted small">
                  Authoring lands next. For now, this is where your cards will
                  live.
                </p>
              </div>
            ) : (
              <ul className="card-preview-list" role="list">
                {contents.user.map((c) => (
                  <CardPreview key={c.id} card={c} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
