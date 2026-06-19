import { useCallback, useEffect, useState } from 'react';
import { getChapter, isChapterId } from '../data/chapters';
import { loadDeck, type DeckContents } from '../lib/decks';
import { removeCard } from '../lib/authoring';
import { deckStats, type DeckStats } from '../lib/stats';
import { loadDeckMeta, saveDeckMeta, type ResolvedDeck } from '../lib/decksMeta';
import { deleteDeckCascade, deleteDeckMeta, getDeckMeta, isPersisted } from '../lib/db';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import { CardEditor } from '../components/CardEditor';
import { StatGrid, MaturityBar } from '../components/Stats';
import type { Card, CardKind } from '../types';

// One card row. Shipped cards show a "shipped" badge; the user's own cards get
// edit/delete actions. Cards are grouped by kind (quiz vs flashcard), not source.
function CardRow({
  card,
  onEdit,
  onDeleted,
}: {
  card: Card;
  onEdit: (card: Card) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isUser = card.source === 'user';

  const del = async () => {
    await removeCard(card.id);
    onDeleted();
  };

  return (
    <li className={`card-preview${isUser ? ' user-card' : ''}`}>
      <div className="card-preview-kind muted">
        {card.kind === 'mcq' ? 'quiz' : 'flashcard'}
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
      {isUser && (
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
      )}
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
  const [deck, setDeck] = useState<ResolvedDeck | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ title: '', description: '' });
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const valid = isChapterId(deckId);
  const chapter = valid ? getChapter(deckId) : undefined;

  const reloadMeta = useCallback(() => {
    void loadDeckMeta(deckId).then((d) => {
      setDeck(d ?? null);
      setMetaLoaded(true);
    });
    void getDeckMeta(deckId).then((m) => setHasOverride(Boolean(m)));
  }, [deckId]);

  const reload = useCallback(() => {
    void deckStats(deckId).then(setStats);
    reloadMeta();
    return loadDeck(deckId)
      .then((c) => setContents(c))
      .catch((e) => setError(String(e)));
  }, [deckId, reloadMeta]);

  useEffect(() => {
    setContents(null);
    setError(null);
    setStats(null);
    setEditingMeta(false);
    setConfirmingDelete(false);
    setMetaLoaded(false);
    setDeck(null);
    void reload();
    void isPersisted().then(setPersisted);
  }, [reload]);

  // Display through the resolver, falling back to chapter defaults pre-load.
  const title = deck?.title ?? chapter?.title ?? '';
  const description = deck?.description ?? chapter?.blurb ?? '';
  const notesPath = deck?.notesPath ?? chapter?.notesPath;
  const isCustom = deck?.custom ?? false;

  const openMetaEditor = () => {
    setMetaForm({ title, description });
    setEditingMeta(true);
  };
  const saveMeta = async () => {
    await saveDeckMeta(deckId, metaForm, isCustom);
    setEditingMeta(false);
    reloadMeta();
  };
  const resetMeta = async () => {
    await deleteDeckMeta(deckId);
    setEditingMeta(false);
    reloadMeta();
  };
  const deleteSet = async () => {
    await deleteDeckCascade(deckId);
    navigate({ name: 'decks' });
  };

  // A deck exists if it's a chapter or a resolved custom set. While meta loads
  // we don't yet know about custom sets, so wait before declaring "not found".
  if (metaLoaded && !valid && !deck) {
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

  // Group by card kind (not source): quiz questions vs flashcards.
  const mcqs = contents ? contents.all.filter((c) => c.kind === 'mcq') : [];
  const flashcards = contents ? contents.all.filter((c) => c.kind === 'flashcard') : [];

  return (
    <div className="page">
      <button
        className="btn-ghost back-link"
        onClick={() => navigate({ name: 'decks' })}
      >
        ← Decks
      </button>

      <div className="deck-header">
        {editingMeta ? (
          <div className="deck-meta-edit">
            <label className="field">
              <span className="field-label">Title</span>
              <input
                type="text"
                value={metaForm.title}
                autoFocus
                onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">Description</span>
              <textarea
                rows={2}
                value={metaForm.description}
                onChange={(e) =>
                  setMetaForm({ ...metaForm, description: e.target.value })
                }
              />
            </label>
            <div className="deck-meta-actions">
              {isCustom &&
                (confirmingDelete ? (
                  <span className="delete-set-confirm">
                    <span className="muted small">Delete this set and its cards?</span>
                    <button
                      className="btn btn-ghost small"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Keep
                    </button>
                    <button className="btn small danger" onClick={() => void deleteSet()}>
                      Delete set
                    </button>
                  </span>
                ) : (
                  <button
                    className="btn btn-ghost danger meta-delete"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete set
                  </button>
                ))}
              <button className="btn btn-ghost" onClick={() => setEditingMeta(false)}>
                Cancel
              </button>
              {!isCustom && hasOverride && (
                <button className="btn btn-ghost" onClick={() => void resetMeta()}>
                  Reset to default
                </button>
              )}
              <button className="btn btn-primary" onClick={() => void saveMeta()}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="deck-header-top">
              <h1>{title}</h1>
              <div className="deck-header-actions">
                <button className="btn btn-ghost small" onClick={openMetaEditor}>
                  Edit
                </button>
                <button className="btn btn-primary" onClick={() => openNew('flashcard')}>
                  Write a card
                </button>
              </div>
            </div>
            {description && <p className="muted">{description}</p>}
            {notesPath && (
              <a
                className="notes-link"
                href={notesPath}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the chapter notes ↗
              </a>
            )}
          </>
        )}
      </div>

      {stats && stats.total > 0 && (
        <div className="review-banner">
          <div>
            <span className="review-banner-count">
              {stats.dueToday > 0 || stats.new > 0
                ? [
                    stats.dueToday > 0 && `${stats.dueToday} due today`,
                    stats.new > 0 && `${stats.new} new`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Nothing due today'}
            </span>
            <p className="muted small">
              {stats.dueToday > 0 || stats.new > 0
                ? 'Flashcards ready to review with spaced repetition.'
                : 'You’re caught up — or practise the whole deck any time.'}
            </p>
          </div>
          <div className="review-banner-actions">
            {(stats.dueToday > 0 || stats.new > 0) && (
              <button
                className="btn btn-primary"
                onClick={() => navigate({ name: 'review', deckId })}
              >
                Review
              </button>
            )}
            <button
              className={`btn${stats.dueToday > 0 || stats.new > 0 ? '' : ' btn-primary'}`}
              onClick={() => navigate({ name: 'practice', deckId })}
            >
              Practice all
            </button>
          </div>
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
              <h2>Flashcards</h2>
              <div className="deck-section-head-actions">
                <span className="muted">{flashcards.length}</span>
                {flashcards.length >= 2 && (
                  <button
                    className="btn small"
                    onClick={() => navigate({ name: 'flashquiz', deckId })}
                    title="Quiz yourself on these flashcards as multiple choice"
                  >
                    Quiz these
                  </button>
                )}
              </div>
            </div>
            <hr className="hairline" />
            {flashcards.length === 0 ? (
              <div className="deck-section-empty">
                <p>
                  No flashcards here yet. The cards you write are the studying —
                  start one and it’s saved to this device.
                </p>
                <button className="btn" onClick={() => openNew('flashcard')}>
                  Write your first card
                </button>
              </div>
            ) : (
              <ul className="card-preview-list" role="list">
                {flashcards.map((c) => (
                  <CardRow key={c.id} card={c} onEdit={openEdit} onDeleted={reload} />
                ))}
              </ul>
            )}
          </section>

          <section className="deck-section">
            <div className="deck-section-head">
              <h2>Quiz questions</h2>
              <div className="deck-section-head-actions">
                <span className="muted">{mcqs.length}</span>
                {mcqs.length > 0 && (
                  <button
                    className="btn btn-primary small"
                    onClick={() => navigate({ name: 'quiz', deckId })}
                  >
                    Start quiz
                  </button>
                )}
              </div>
            </div>
            <hr className="hairline" />
            {mcqs.length === 0 ? (
              <p className="muted deck-section-empty">
                No quiz questions here yet. Use “Write a card” and choose Quiz to
                add one.
              </p>
            ) : (
              <ul className="card-preview-list" role="list">
                {mcqs.map((c) => (
                  <CardRow key={c.id} card={c} onEdit={openEdit} onDeleted={reload} />
                ))}
              </ul>
            )}
          </section>

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
        </>
      )}

      {editor.open && (
        <CardEditor
          deck={deckId}
          deckTitle={title}
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
