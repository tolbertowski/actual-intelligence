import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, CardKind, DeckId } from '../types';
import {
  type CardDraft,
  type DraftError,
  createCard,
  draftFromCard,
  emptyDraft,
  parseTags,
  updateCard,
  validateDraft,
} from '../lib/authoring';
import { getChapter, isChapterId } from '../data/chapters';
import { RichText } from './RichText';

// Modal editor for a user card. The card is the hero: a wide writing surface,
// a live LaTeX preview, and keyboard shortcuts so authoring stays fast —
//   Esc           cancel
//   Cmd/Ctrl+Enter save
// New cards offer "save and add another" to keep momentum.

interface CardEditorProps {
  deck: DeckId;
  /** Resolved deck title for the header (falls back to chapter/id). */
  deckTitle?: string;
  /** When present, we're editing; otherwise creating. */
  card?: Card;
  /** Kind to start a new card with (ignored when editing). */
  initialKind?: CardKind;
  onClose: () => void;
  /** Called after any successful create/update so the deck can refresh. */
  onSaved: (card: Card) => void;
}

function errorFor(errors: DraftError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

export function CardEditor({
  deck,
  deckTitle,
  card,
  initialKind = 'flashcard',
  onClose,
  onSaved,
}: CardEditorProps) {
  const editing = Boolean(card);
  const [draft, setDraft] = useState<CardDraft>(() =>
    card ? draftFromCard(card) : emptyDraft(initialKind),
  );
  const [tagsText, setTagsText] = useState<string>(() =>
    (card?.tags ?? []).join(', '),
  );
  const [errors, setErrors] = useState<DraftError[]>([]);
  const [saving, setSaving] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);

  const chapterTitle =
    deckTitle ?? (isChapterId(deck) ? getChapter(deck)?.title : undefined) ?? deck;

  // Compose the draft with its parsed tags at save time.
  const withTags = useCallback(
    (d: CardDraft): CardDraft => ({ ...d, tags: parseTags(tagsText) }),
    [tagsText],
  );

  const save = useCallback(
    async (addAnother: boolean) => {
      const candidate = withTags(draft);
      const found = validateDraft(candidate);
      if (found.length > 0) {
        setErrors(found);
        return;
      }
      setSaving(true);
      try {
        const saved = editing
          ? await updateCard(card!.id, candidate)
          : await createCard(deck, candidate);
        onSaved(saved);
        if (addAnother && !editing) {
          // Reset for the next card, keep the kind and tags, refocus.
          setDraft(emptyDraft(candidate.kind));
          setErrors([]);
          firstFieldRef.current?.focus();
        } else {
          onClose();
        }
      } finally {
        setSaving(false);
      }
    },
    [draft, withTags, editing, card, deck, onSaved, onClose],
  );

  // Keyboard: Esc closes, Cmd/Ctrl+Enter saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        void save(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, save]);

  // Autofocus the first field on open.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Simple focus trap: keep Tab within the dialog.
  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const setKind = (kind: CardKind) => {
    setDraft((d) => {
      if (d.kind === kind) return d;
      const base = emptyDraft(kind);
      // Carry over text between kinds where it makes sense.
      if (kind === 'mcq' && d.kind === 'flashcard') {
        return { ...base, question: d.front } as CardDraft;
      }
      if (kind === 'flashcard' && d.kind === 'mcq') {
        return { ...base, front: d.question } as CardDraft;
      }
      return base;
    });
    setErrors([]);
  };

  const titleId = 'card-editor-title';

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onKeyDown={onDialogKeyDown}
      >
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{editing ? 'Edit card' : 'Write a card'}</h2>
            <p className="muted small">in {chapterTitle}</p>
          </div>
          {!editing && (
            <div className="kind-toggle" role="tablist" aria-label="Card type">
              <button
                role="tab"
                aria-selected={draft.kind === 'flashcard'}
                className={draft.kind === 'flashcard' ? 'active' : ''}
                onClick={() => setKind('flashcard')}
              >
                Flashcard
              </button>
              <button
                role="tab"
                aria-selected={draft.kind === 'mcq'}
                className={draft.kind === 'mcq' ? 'active' : ''}
                onClick={() => setKind('mcq')}
              >
                Quiz
              </button>
            </div>
          )}
        </div>

        <div className="modal-body">
          {draft.kind === 'flashcard' ? (
            <FlashcardFields
              draft={draft}
              setDraft={setDraft}
              errors={errors}
              firstFieldRef={firstFieldRef}
            />
          ) : (
            <MCQFields
              draft={draft}
              setDraft={setDraft}
              errors={errors}
              firstFieldRef={firstFieldRef}
            />
          )}

          <label className="field">
            <span className="field-label">Tags</span>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="comma, separated (optional)"
            />
          </label>

          <Preview draft={withTags(draft)} />
        </div>

        <div className="modal-foot">
          <span className="muted small kbd-hint">
            <kbd>Esc</kbd> to cancel · <kbd>⌘</kbd>
            <kbd>↵</kbd> to save
          </span>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            {!editing && (
              <button
                className="btn"
                onClick={() => void save(true)}
                disabled={saving}
              >
                Save and add another
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => void save(false)}
              disabled={saving}
            >
              {editing ? 'Save changes' : 'Save card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldsProps<D extends CardDraft> {
  draft: D;
  setDraft: React.Dispatch<React.SetStateAction<CardDraft>>;
  errors: DraftError[];
  firstFieldRef: React.RefObject<HTMLTextAreaElement>;
}

function FlashcardFields({
  draft,
  setDraft,
  errors,
  firstFieldRef,
}: FieldsProps<Extract<CardDraft, { kind: 'flashcard' }>>) {
  const frontErr = errorFor(errors, 'front');
  const backErr = errorFor(errors, 'back');
  return (
    <>
      <label className="field">
        <span className="field-label">Front</span>
        <textarea
          ref={firstFieldRef}
          rows={3}
          value={draft.front}
          onChange={(e) => setDraft({ ...draft, front: e.target.value })}
          placeholder="The prompt. LaTeX with $…$ is supported."
          aria-invalid={Boolean(frontErr)}
        />
        {frontErr && <span className="field-error">{frontErr}</span>}
      </label>
      <label className="field">
        <span className="field-label">Back</span>
        <textarea
          rows={4}
          value={draft.back}
          onChange={(e) => setDraft({ ...draft, back: e.target.value })}
          placeholder="The answer."
          aria-invalid={Boolean(backErr)}
        />
        {backErr && <span className="field-error">{backErr}</span>}
      </label>
    </>
  );
}

function MCQFields({
  draft,
  setDraft,
  errors,
  firstFieldRef,
}: FieldsProps<Extract<CardDraft, { kind: 'mcq' }>>) {
  const setOption = (i: number, value: string) => {
    const options = draft.options.slice();
    options[i] = value;
    setDraft({ ...draft, options });
  };
  const addOption = () => {
    if (draft.options.length >= 6) return;
    setDraft({ ...draft, options: [...draft.options, ''] });
  };
  const toggleCorrect = (i: number) => {
    const answers = draft.answers.includes(i)
      ? draft.answers.filter((a) => a !== i)
      : [...draft.answers, i].sort((a, b) => a - b);
    setDraft({ ...draft, answers });
  };
  const removeOption = (i: number) => {
    if (draft.options.length <= 2) return;
    const options = draft.options.filter((_, idx) => idx !== i);
    // Drop the removed option from the correct set and shift later indices down.
    const answers = draft.answers
      .filter((a) => a !== i)
      .map((a) => (a > i ? a - 1 : a));
    setDraft({ ...draft, options, answers });
  };

  return (
    <>
      <label className="field">
        <span className="field-label">Question</span>
        <textarea
          ref={firstFieldRef}
          rows={2}
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          placeholder="The question. LaTeX with $…$ is supported."
          aria-invalid={Boolean(errorFor(errors, 'question'))}
        />
        {errorFor(errors, 'question') && (
          <span className="field-error">{errorFor(errors, 'question')}</span>
        )}
      </label>

      <div className="field">
        <span className="field-label">
          Options <span className="muted">— tick every correct answer</span>
        </span>
        <div className="option-rows">
          {draft.options.map((opt, i) => (
            <div className="option-row" key={i}>
              <input
                type="checkbox"
                checked={draft.answers.includes(i)}
                onChange={() => toggleCorrect(i)}
                aria-label={`Mark option ${i + 1} correct`}
              />
              <input
                type="text"
                value={opt}
                onChange={(e) => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeOption(i)}
                disabled={draft.options.length <= 2}
                aria-label={`Remove option ${i + 1}`}
                title="Remove option"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {errorFor(errors, 'options') && (
          <span className="field-error">{errorFor(errors, 'options')}</span>
        )}
        {errorFor(errors, 'answer') && (
          <span className="field-error">{errorFor(errors, 'answer')}</span>
        )}
        {draft.options.length < 6 && (
          <button type="button" className="btn btn-ghost add-option" onClick={addOption}>
            + Add option
          </button>
        )}
      </div>

      <label className="field">
        <span className="field-label">Explanation</span>
        <textarea
          rows={3}
          value={draft.explanation}
          onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
          placeholder="Always shown after answering — make it teach."
          aria-invalid={Boolean(errorFor(errors, 'explanation'))}
        />
        {errorFor(errors, 'explanation') && (
          <span className="field-error">{errorFor(errors, 'explanation')}</span>
        )}
      </label>
    </>
  );
}

function Preview({ draft }: { draft: CardDraft }) {
  const hasContent = useMemo(() => {
    if (draft.kind === 'flashcard') return draft.front.trim() || draft.back.trim();
    return draft.question.trim() || draft.options.some((o) => o.trim());
  }, [draft]);

  if (!hasContent) return null;

  return (
    <div className="preview" aria-live="polite">
      <span className="field-label muted">Preview</span>
      {draft.kind === 'flashcard' ? (
        <div className="preview-card">
          {draft.front.trim() && (
            <div className="preview-front">
              <RichText serif>{draft.front}</RichText>
            </div>
          )}
          {draft.back.trim() && (
            <>
              <hr className="hairline" />
              <div className="preview-back">
                <RichText serif>{draft.back}</RichText>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="preview-card">
          {draft.question.trim() && (
            <div className="preview-front">
              <RichText serif>{draft.question}</RichText>
            </div>
          )}
          <ul className="preview-options">
            {draft.options.map(
              (opt, i) =>
                opt.trim() && (
                  <li key={i} className={draft.answers.includes(i) ? 'correct' : ''}>
                    <RichText>{opt}</RichText>
                    {draft.answers.includes(i) && <span className="muted small"> ✓</span>}
                  </li>
                ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
