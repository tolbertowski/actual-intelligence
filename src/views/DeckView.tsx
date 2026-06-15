import { useCallback, useEffect, useState } from 'react';
import { getChapter, isChapterId } from '../data/chapters';
import { loadDeck, type DeckContents } from '../lib/decks';
import { removeCard } from '../lib/authoring';
import { deckStats, type DeckStats } from '../lib/stats';
import { isPersisted } from '../lib/db';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import { CardEditor } from '../components/CardEditor';
import { StatGrid, MaturityBar } from '../components/Stats';
import type { Card, CardKind, DeckId } from '../types';

function ShippedCardPreview({ card }: { card: Card }) {
  return (
    <li className="card-preview">
      <div className="card-preview-kind muted">
        {card.kind === 'mcq' ? 'quiz' : 'flashcard'}
        <span className="tag">shipped</span>
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

function UserCardRow({
  card,
  onEdit,
  onDeleted,
}: {
  card: Card;
  onEdit: (card: Card) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const del = async () => {
    await removeCard(card.id);
    onDeleted();
  };

  return (
    <li className="card-preview user-card">
      <div className="card-preview-kind muted">
        {card.kind === 'mcq' ? 'quiz' : 'flashcard'}
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
      <div className="user-card-actions">
        {confirming ? (
          <>
            <span className="muted small">Delete this card?</span>
            <button className="btn btn-ghost small" onClick={() => setConfirming(false)}>
              Keep
            </button>
            <button className="btn small danger" onClick={() => void del()}>
              Delete
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost small" onClick={() => onEdit(card)}>
              Edit
            </button>
            <button
              className="btn btn-ghost small"
              onClick={() => setConfirming(true)}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

interface EditorState {
  open: boolean;
  card?: Card;
  kind: CardKind;
}

export function DeckView({ deckId }: { deckId: string }) {
  const [contents, setContents] = useState<DeckContents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ open: false, kind: 'flashcard' });
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);

  const valid = isChapterId(deckId);
  const chapter = valid ? getChapter(deckId) : undefined;

  const reload = useCallback(() => {
    if (!valid) return Promise.resolve();
    void deckStats(deckId as DeckId).then(setStats);
    return loadDeck(deckId as DeckId)
      .then((c) => setContents(c))
      .catch((e) => setError(String(e)));
  }, [deckId, valid]);

  useEffect(() => {
    if (!valid) return;
    setContents(null);
    setError(null);
    setStats(null);
    void reload();
    void isPersisted().then(setPersisted);
  }, [valid, reload]);

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

  const openNew = (kind: CardKind) => setEditor({ open: true, kind });
  const openEdit = (card: Card) =>
    setEditor({ open: true, card, kind: card.kind });
  const closeEditor = () => setEditor((e) => ({ ...e, open: false, card: undefined }));

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

      {stats && (stats.dueToday > 0 || stats.new > 0) && (
        <div className="review-banner">
          <div>
            <span className="review-banner-count">
              {stats.dueToday > 0 && `${stats.dueToday} due today`}
              {stats.dueToday > 0 && stats.new > 0 && ' · '}
              {stats.new > 0 && `${stats.new} new`}
            </span>
            <p className="muted small">Flashcards ready to review with spaced repetition.</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate({ name: 'review', deckId })}
          >
            Review
          </button>
        </div>
      )}

      {stats && stats.total > 0 && (
        <section className="deck-stats">
          <StatGrid stats={stats} />
          <MaturityBar stats={stats} />
        </section>
      )}

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
                  <ShippedCardPreview key={c.id} card={c} />
                ))}
              </ul>
            )}
          </section>

          <section className="deck-section">
            <div className="deck-section-head">
              <h2>Your flashcards</h2>
              <div className="deck-section-head-actions">
                <span className="muted">{contents.user.length}</span>
                <button className="btn btn-primary small" onClick={() => openNew('flashcard')}>
                  Write a card
                </button>
              </div>
            </div>
            <hr className="hairline" />
            {contents.user.length === 0 ? (
              <div className="deck-section-empty">
                <p>
                  Nothing here yet. The cards you write are the studying — start
                  one and it’s saved to this device.
                </p>
                <button className="btn" onClick={() => openNew('flashcard')}>
                  Write your first card
                </button>
              </div>
            ) : (
              <ul className="card-preview-list" role="list">
                {contents.user.map((c) => (
                  <UserCardRow
                    key={c.id}
                    card={c}
                    onEdit={openEdit}
                    onDeleted={reload}
                  />
                ))}
              </ul>
            )}

            <p className="storage-note muted small">
              {persisted
                ? 'Your cards live on this device, on purpose. '
                : 'Your cards live on this device, on purpose — this storage can be cleared by the browser, so '}
              <a
                href="#/progress"
                onClick={(e) => {
                  e.preventDefault();
                  navigate({ name: 'progress' });
                }}
              >
                export is the backup
              </a>
              .
            </p>
          </section>
        </>
      )}

      {editor.open && (
        <CardEditor
          deck={deckId as DeckId}
          card={editor.card}
          initialKind={editor.kind}
          onClose={closeEditor}
          onSaved={() => {
            void reload();
            void isPersisted().then(setPersisted);
          }}
        />
      )}
    </div>
  );
}
