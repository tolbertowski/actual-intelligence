import { useCallback, useEffect, useState } from 'react';
import { isChapterId } from '../data/chapters';
import { loadDeckMeta } from '../lib/decksMeta';
import {
  loadAllFlashcardQuiz,
  loadAllQuizQueue,
  loadFlashcardQuiz,
  loadQuizQueue,
  quizItemFromCard,
  type QuizItem,
} from '../lib/quiz';
import { navigate } from '../hooks/useHashRoute';
import { RichText } from '../components/RichText';
import { CardEditor } from '../components/CardEditor';
import type { DeckId, MCQCard } from '../types';

type Phase = 'loading' | 'quizzing' | 'done' | 'invalid';

export function QuizSession({
  deckId,
  from = 'mcq',
}: {
  deckId?: string;
  /** 'mcq' quizzes real MCQs; 'flashcards' templates flashcards into MCQs. */
  from?: 'mcq' | 'flashcards';
}) {
  const global = deckId === undefined;
  const fromFlashcards = from === 'flashcards';

  const [queue, setQueue] = useState<QuizItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [scopeTitle, setScopeTitle] = useState(global ? 'All decks' : '');
  const [editing, setEditing] = useState<MCQCard | null>(null);

  useEffect(() => {
    if (deckId) void loadDeckMeta(deckId).then((d) => d && setScopeTitle(d.title));
    else setScopeTitle('All decks');
  }, [deckId]);

  const loadQueue = () => {
    if (fromFlashcards) {
      return deckId ? loadFlashcardQuiz(deckId as DeckId) : loadAllFlashcardQuiz();
    }
    return deckId ? loadQuizQueue(deckId as DeckId) : loadAllQuizQueue();
  };

  const start = useCallback(() => {
    setPhase('loading');
    void (async () => {
      // A deck exists if it's a chapter or a resolved custom set.
      if (deckId && !isChapterId(deckId) && !(await loadDeckMeta(deckId))) {
        setPhase('invalid');
        return;
      }
      const q = await loadQueue();
      setQueue(q);
      setIndex(0);
      setSelected([]);
      setAnswered(false);
      setScore(0);
      setPhase(q.length === 0 ? 'done' : 'quizzing');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, fromFlashcards]);

  useEffect(() => {
    start();
  }, [start]);

  const current = queue[index];

  // Did `sel` exactly match the set of correct options?
  const isFullyCorrect = useCallback(
    (sel: number[], item: QuizItem) => {
      const correct = item.options.reduce<number[]>((acc, o, i) => {
        if (o.correct) acc.push(i);
        return acc;
      }, []);
      return (
        sel.length === correct.length && correct.every((i) => sel.includes(i))
      );
    },
    [],
  );

  // Lock in an answer (single-answer is instant; multi waits for "Check").
  const finalize = useCallback(
    (sel: number[]) => {
      if (!current || sel.length === 0) return;
      setSelected(sel);
      setAnswered(true);
      if (isFullyCorrect(sel, current)) setScore((s) => s + 1);
    },
    [current, isFullyCorrect],
  );

  const choose = useCallback(
    (i: number) => {
      if (answered || !current) return;
      if (current.multi) {
        // Toggle membership; the user submits with "Check answer".
        setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
      } else {
        finalize([i]);
      }
    },
    [answered, current, finalize],
  );

  const next = useCallback(() => {
    setSelected([]);
    setAnswered(false);
    if (index + 1 >= queue.length) setPhase('done');
    else setIndex((i) => i + 1);
  }, [index, queue.length]);

  // Keyboard: number keys pick/toggle options; Enter submits a multi-answer
  // question, then advances once answered.
  useEffect(() => {
    if (phase !== 'quizzing') return;
    const onKey = (e: KeyboardEvent) => {
      if (editing) return; // the editor handles its own keys
      if (answered) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          next();
        }
        return;
      }
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && current && n <= current.options.length) {
        e.preventDefault();
        choose(n - 1);
      } else if (e.key === 'Enter' && current?.multi && selected.length > 0) {
        e.preventDefault();
        finalize(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answered, current, choose, next, finalize, selected, editing]);

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
    const total = queue.length;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    return (
      <div className="page review-done">
        <button className="btn-ghost back-link" onClick={goBack}>
          ← {backLabel}
        </button>
        <div className="review-done-body">
          <h1>{total > 0 ? `You scored ${score} / ${total}` : 'No quiz questions'}</h1>
          <p className="muted">
            {total > 0
              ? `${pct}% on this run. The explanations are where the learning is — worth another pass.`
              : global
                ? 'There are no multiple-choice questions yet.'
                : 'This chapter has no multiple-choice questions yet.'}
          </p>
          <div className="quiz-done-actions">
            {total > 0 && (
              <button className="btn btn-primary" onClick={start}>
                Try again
              </button>
            )}
            <button className="btn" onClick={goBack}>
              {global ? 'Back to decks' : `Back to ${scopeTitle.toLowerCase()}`}
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
        <button className="btn-ghost back-link" onClick={goBack}>
          ← {backLabel}
        </button>
        <span className="review-top-right muted small">
          {current.card.source === 'user' && !current.generated && (
            <button
              className="btn btn-ghost small"
              onClick={() => setEditing(current.card)}
            >
              Edit
            </button>
          )}
          {index + 1} of {total} · {score} right
        </span>
      </div>
      <div className="review-progress" aria-hidden="true">
        <div className="review-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-question">
        <RichText serif>{current.card.question}</RichText>
        {current.multi && (
          <span className="quiz-multi-hint muted small">Select all that apply</span>
        )}
      </div>

      <ul className="quiz-options" role="list">
        {current.options.map((opt, i) => {
          const picked = selected.includes(i);
          let state = '';
          if (answered) {
            if (opt.correct) state = ' correct';
            else if (picked) state = ' wrong';
            else state = ' dim';
          } else if (picked) {
            state = ' picked';
          }
          return (
            <li key={i}>
              <button
                className={`quiz-option${state}`}
                onClick={() => choose(i)}
                disabled={answered}
                aria-pressed={picked}
              >
                <span className="quiz-option-key">{i + 1}</span>
                <span className="quiz-option-text">
                  <RichText>{opt.text}</RichText>
                </span>
                {answered && opt.correct && <span className="quiz-mark">✓</span>}
                {answered && !opt.correct && picked && (
                  <span className="quiz-mark">✗</span>
                )}
                {!answered && current.multi && picked && (
                  <span className="quiz-mark">●</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!answered && current.multi && (
        <div className="quiz-next-row">
          <button
            className="btn btn-primary"
            onClick={() => finalize(selected)}
            disabled={selected.length === 0}
          >
            Check answer
          </button>
          <span className="muted small kbd-hint">
            <kbd>enter</kbd> to check
          </span>
        </div>
      )}

      {answered && (
        <div className="quiz-feedback">
          <div className={`quiz-verdict ${isFullyCorrect(selected, current) ? 'good' : 'bad'}`}>
            {isFullyCorrect(selected, current) ? 'Correct' : 'Not quite'}
          </div>
          {current.card.explanation && (
            <div className="quiz-explanation">
              <RichText>{current.card.explanation}</RichText>
            </div>
          )}
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

      {editing && (
        <CardEditor
          deck={editing.deck}
          deckTitle={global ? undefined : scopeTitle}
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            // Rebuild this question from the edit and let the user re-answer it.
            setQueue((q) =>
              q.map((it, i) =>
                i === index ? quizItemFromCard(saved as MCQCard) : it,
              ),
            );
            setSelected([]);
            setAnswered(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
