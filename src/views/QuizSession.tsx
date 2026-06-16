import { useCallback, useEffect, useState } from 'react';
import { getChapter, isChapterId } from '../data/chapters';
import { loadQuizQueue, type QuizItem } from '../lib/quiz';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import type { DeckId } from '../types';

type Phase = 'loading' | 'quizzing' | 'done' | 'invalid';

export function QuizSession({ deckId }: { deckId: string }) {
  const valid = isChapterId(deckId);
  const chapter = valid ? getChapter(deckId) : undefined;

  const [queue, setQueue] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');

  const start = useCallback(() => {
    if (!valid) {
      setPhase('invalid');
      return;
    }
    setPhase('loading');
    loadQuizQueue(deckId as DeckId).then((q) => {
      setQueue(q);
      setIndex(0);
      setSelected(null);
      setScore(0);
      setPhase(q.length === 0 ? 'done' : 'quizzing');
    });
  }, [deckId, valid]);

  useEffect(() => {
    let cancelled = false;
    if (!valid) {
      setPhase('invalid');
      return;
    }
    loadQuizQueue(deckId as DeckId).then((q) => {
      if (cancelled) return;
      setQueue(q);
      setPhase(q.length === 0 ? 'done' : 'quizzing');
    });
    return () => {
      cancelled = true;
    };
  }, [deckId, valid]);

  const current = queue[index];
  const answered = selected !== null;

  const choose = useCallback(
    (i: number) => {
      if (selected !== null || !current) return;
      setSelected(i);
      if (current.options[i]?.correct) setScore((s) => s + 1);
    },
    [selected, current],
  );

  const next = useCallback(() => {
    setSelected(null);
    if (index + 1 >= queue.length) setPhase('done');
    else setIndex((i) => i + 1);
  }, [index, queue.length]);

  // Keyboard: number keys pick an option; Enter/Space advances once answered.
  useEffect(() => {
    if (phase !== 'quizzing') return;
    const onKey = (e: KeyboardEvent) => {
      if (!answered) {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && current && n <= current.options.length) {
          e.preventDefault();
          choose(n - 1);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answered, current, choose, next]);

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
    const total = queue.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="page review-done">
        <button className="btn-ghost back-link" onClick={backToDeck}>
          ← {chapter.title}
        </button>
        <div className="review-done-body">
          <h1>{total > 0 ? `You scored ${score} / ${total}` : 'No quiz questions'}</h1>
          <p className="muted">
            {total > 0
              ? `${pct}% on this run. The explanations are where the learning is — worth another pass.`
              : 'This chapter has no multiple-choice questions yet.'}
          </p>
          <div className="quiz-done-actions">
            {total > 0 && (
              <button className="btn btn-primary" onClick={start}>
                Try again
              </button>
            )}
            <button className="btn" onClick={backToDeck}>
              Back to {chapter.title.toLowerCase()}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'quizzing'
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
    <div className="page quiz-page">
      <div className="review-top">
        <button className="btn-ghost back-link" onClick={backToDeck}>
          ← {chapter.title}
        </button>
        <span className="muted small">
          {index + 1} of {total} · {score} right
        </span>
      </div>
      <div className="review-progress" aria-hidden="true">
        <div className="review-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-question">
        <RichText serif>{current.card.question}</RichText>
      </div>

      <ul className="quiz-options" role="list">
        {current.options.map((opt, i) => {
          let state = '';
          if (answered) {
            if (opt.correct) state = ' correct';
            else if (i === selected) state = ' wrong';
            else state = ' dim';
          }
          return (
            <li key={i}>
              <button
                className={`quiz-option${state}`}
                onClick={() => choose(i)}
                disabled={answered}
                aria-pressed={i === selected}
              >
                <span className="quiz-option-key">{i + 1}</span>
                <span className="quiz-option-text">
                  <RichText>{opt.text}</RichText>
                </span>
                {answered && opt.correct && <span className="quiz-mark">✓</span>}
                {answered && !opt.correct && i === selected && (
                  <span className="quiz-mark">✗</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="quiz-feedback">
          <div className={`quiz-verdict ${current.options[selected]?.correct ? 'good' : 'bad'}`}>
            {current.options[selected]?.correct ? 'Correct' : 'Not quite'}
          </div>
          <div className="quiz-explanation">
            <RichText>{current.card.explanation}</RichText>
          </div>
          <div className="quiz-next-row">
            <button className="btn btn-primary" onClick={next}>
              {index + 1 >= total ? 'See results' : 'Next question'}
            </button>
            <span className="muted small kbd-hint">
              <kbd>enter</kbd> to continue
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
