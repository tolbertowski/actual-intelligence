import { useCallback, useEffect, useState } from 'react';
import { isChapterId } from '../data/chapters';
import { loadDeckMeta } from '../lib/decksMeta';
import {
  type QueueItem,
  gradeCard,
  loadAllPracticeQueue,
  loadAllReviewQueue,
  loadPracticeQueue,
  loadReviewQueue,
} from '../lib/review';
import { GRADE_OPTIONS, formatInterval, isLapse, previewInterval } from '../lib/sm2';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import { CardEditor } from '../components/CardEditor';
import type { Card, DeckId, Flashcard, Grade } from '../types';

type Phase = 'loading' | 'reviewing' | 'done' | 'invalid';

/** 'due' updates the SM-2 schedule; 'practice' drills all cards without it. */
export type ReviewMode = 'due' | 'practice';

export function ReviewSession({
  deckId,
  mode = 'due',
}: {
  /** Undefined = a global session across every deck. */
  deckId?: string;
  mode?: ReviewMode;
}) {
  const global = deckId === undefined;
  const practice = mode === 'practice';

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [reviewed, setReviewed] = useState(0);
  const [scopeTitle, setScopeTitle] = useState(global ? 'All decks' : '');
  const [editing, setEditing] = useState<Card | null>(null);

  useEffect(() => {
    if (deckId) void loadDeckMeta(deckId).then((d) => d && setScopeTitle(d.title));
    else setScopeTitle('All decks');
  }, [deckId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPhase('loading');
      // A deck exists if it's a chapter or a resolved custom set.
      if (deckId && !isChapterId(deckId) && !(await loadDeckMeta(deckId))) {
        if (!cancelled) setPhase('invalid');
        return;
      }
      const q = await (practice
        ? deckId
          ? loadPracticeQueue(deckId as DeckId)
          : loadAllPracticeQueue()
        : deckId
          ? loadReviewQueue(deckId as DeckId)
          : loadAllReviewQueue());
      if (cancelled) return;
      setQueue(q);
      setPhase(q.length === 0 ? 'done' : 'reviewing');
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId, practice]);

  const current = queue[index];

  const grade = useCallback(
    async (g: Grade) => {
      if (!current) return;
      // Practice never touches the schedule — it's safe to study anytime.
      if (!practice) await gradeCard(current.card, current.prior, g);
      setReviewed((n) => n + 1);
      setFlipped(false);

      // A lapsed card comes back later in the same session so it gets drilled.
      // Account for the append when deciding whether the session is finished,
      // so a re-queued card is never skipped.
      const lapsed = isLapse(g);
      if (lapsed) setQueue((q) => [...q, { ...current, isNew: false }]);
      const nextLength = queue.length + (lapsed ? 1 : 0);
      if (index + 1 >= nextLength) setPhase('done');
      else setIndex((i) => i + 1);
    },
    [current, index, queue.length, practice],
  );

  // Keyboard: space/enter flips; 1–4 grade once flipped. Suspended while the
  // in-session editor is open (it has its own shortcuts).
  useEffect(() => {
    if (phase !== 'reviewing') return;
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      } else if (flipped) {
        const opt = GRADE_OPTIONS.find((o) => o.key === e.key);
        if (opt) {
          e.preventDefault();
          void grade(opt.grade);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, flipped, grade, editing]);

  if (phase === 'invalid') {
    return (
      <div className="page">
        <p>That deck doesn’t exist.</p>
        <button className="btn" onClick={() => navigate({ name: 'decks' })}>
          Back to decks
        </button>
      </div>
    );
  }

  const goBack = () =>
    navigate(deckId ? { name: 'deck', deckId } : { name: 'decks' });
  const backLabel = global ? 'Decks' : scopeTitle;

  if (phase === 'loading') {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="page review-done">
        <button className="btn-ghost back-link" onClick={goBack}>
          ← {backLabel}
        </button>
        <div className="review-done-body">
          <h1>
            {reviewed === 0
              ? practice
                ? 'No flashcards yet'
                : 'Nothing due'
              : 'Done for now'}
          </h1>
          <p className="muted">
            {reviewed === 0
              ? practice
                ? 'There are no flashcards to practise yet. Write a few first.'
                : global
                  ? 'Nothing is due anywhere today. Come back tomorrow, or practise instead.'
                  : 'No cards are due in this deck today. Write a few, or check back tomorrow.'
              : practice
                ? `You practised ${reviewed} card${reviewed === 1 ? '' : 's'}. Your review schedule wasn’t affected.`
                : `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Come back when more are due.`}
          </p>
          <button className="btn" onClick={goBack}>
            {global ? 'Back to decks' : `Back to ${scopeTitle.toLowerCase()}`}
          </button>
        </div>
      </div>
    );
  }

  // phase === 'reviewing'. Guard against the queue/index briefly being out of
  // step (e.g. across a reload) so we never read a card off the end.
  if (!current) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const total = queue.length;
  const progress = total > 0 ? (index / total) * 100 : 0;

  return (
    <div className="page review-page">
      <div className="review-top">
        <button className="btn-ghost back-link" onClick={goBack}>
          ← {backLabel}
        </button>
        <span className="review-top-right muted small">
          {current.card.source === 'user' && (
            <button
              className="btn btn-ghost small"
              onClick={() => setEditing(current.card)}
            >
              Edit
            </button>
          )}
          {practice && <span className="tag">practice</span>}{' '}
          {index + 1} of {total}
          {!practice && current?.isNew && <span className="tag new-tag">new</span>}
        </span>
      </div>
      <div className="review-progress" aria-hidden="true">
        <div className="review-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <button
        type="button"
        className="review-card"
        onClick={() => !flipped && setFlipped(true)}
        aria-label={flipped ? 'Card answer' : 'Show answer'}
      >
        <div className="review-card-face">
          <RichText serif>{current.card.front}</RichText>
        </div>
        {flipped && (
          <>
            <hr className="hairline review-card-divider" />
            <div className="review-card-back">
              <RichText serif>{current.card.back}</RichText>
            </div>
          </>
        )}
      </button>

      {!flipped ? (
        <div className="review-actions">
          <button className="btn btn-primary review-flip" onClick={() => setFlipped(true)}>
            Show answer
          </button>
          <span className="muted small kbd-hint">
            <kbd>space</kbd> to flip
          </span>
        </div>
      ) : (
        <div className="grade-row" role="group" aria-label="How well did you recall this?">
          {GRADE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`grade-btn grade-${opt.label.toLowerCase()}`}
              onClick={() => void grade(opt.grade)}
            >
              <span className="grade-key">{opt.key}</span>
              <span className="grade-label">{opt.label}</span>
              {/* In practice the schedule isn't touched, so intervals would mislead. */}
              {!practice && (
                <span className="grade-interval muted">
                  {formatInterval(previewInterval(current.prior, opt.grade))}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <CardEditor
          deck={editing.deck}
          deckTitle={global ? undefined : scopeTitle}
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setQueue((q) =>
              q.map((it, i) =>
                i === index ? { ...it, card: saved as Flashcard } : it,
              ),
            );
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
