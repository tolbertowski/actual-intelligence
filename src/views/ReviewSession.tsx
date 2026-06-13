import { useCallback, useEffect, useState } from 'react';
import { getChapter, isChapterId } from '../data/chapters';
import {
  type QueueItem,
  gradeCard,
  loadReviewQueue,
} from '../lib/review';
import { GRADE_OPTIONS, formatInterval, isLapse, previewInterval } from '../lib/sm2';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import type { DeckId, Grade } from '../types';

type Phase = 'loading' | 'reviewing' | 'done' | 'invalid';

export function ReviewSession({ deckId }: { deckId: string }) {
  const valid = isChapterId(deckId);
  const chapter = valid ? getChapter(deckId) : undefined;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [reviewed, setReviewed] = useState(0);

  useEffect(() => {
    if (!valid) {
      setPhase('invalid');
      return;
    }
    let cancelled = false;
    loadReviewQueue(deckId as DeckId).then((q) => {
      if (cancelled) return;
      setQueue(q);
      setPhase(q.length === 0 ? 'done' : 'reviewing');
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, valid]);

  const current = queue[index];

  const grade = useCallback(
    async (g: Grade) => {
      if (!current) return;
      await gradeCard(current.card, current.prior, g);
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
    [current, index, queue.length],
  );

  // Keyboard: space/enter flips; 1–4 grade once flipped.
  useEffect(() => {
    if (phase !== 'reviewing') return;
    const onKey = (e: KeyboardEvent) => {
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
  }, [phase, flipped, grade]);

  if (phase === 'invalid' || !chapter) {
    return (
      <div className="page">
        <p>That deck doesn’t exist.</p>
        <button className="btn" onClick={() => navigate({ name: 'decks' })}>
          Back to decks
        </button>
      </div>
    );
  }

  const backToDeck = () => navigate({ name: 'deck', deckId });

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
        <button className="btn-ghost back-link" onClick={backToDeck}>
          ← {chapter.title}
        </button>
        <div className="review-done-body">
          <h1>{reviewed > 0 ? 'Done for now' : 'Nothing due'}</h1>
          <p className="muted">
            {reviewed > 0
              ? `You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Come back when more are due.`
              : 'No cards are due in this deck today. Write a few, or check back tomorrow.'}
          </p>
          <button className="btn" onClick={backToDeck}>
            Back to {chapter.title.toLowerCase()}
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
        <button className="btn-ghost back-link" onClick={backToDeck}>
          ← {chapter.title}
        </button>
        <span className="muted small">
          {index + 1} of {total}
          {current?.isNew && <span className="tag new-tag">new</span>}
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
              <span className="grade-interval muted">
                {formatInterval(previewInterval(current.prior, opt.grade))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
