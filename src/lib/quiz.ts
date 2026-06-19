import type { DeckId, Flashcard, MCQCard } from '../types';
import { loadDeck, loadShippedDeck } from './decks';
import { getAllCards } from './db';
import { CHAPTERS } from '../data/chapters';

// Builds a quiz run over a deck's multiple-choice cards (shipped + user). The
// quiz is ephemeral — immediate feedback with the explanation always shown, no
// scheduling or persistence. Flashcards are handled by review/SM-2 instead,
// except in flashcard-quiz mode, where flashcards are templated into MCQs on
// the fly (front as the stem, sibling backs as distractors — no LLM).

export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizItem {
  card: MCQCard;
  /** Options in presentation order (shuffled), with the answer(s) flagged. */
  options: QuizOption[];
  /** True when more than one option is correct ("select all that apply"). */
  multi: boolean;
  /** True when templated from a flashcard (not a real MCQ; not editable). */
  generated?: boolean;
}

/** In-place Fisher–Yates shuffle on a copy. */
function shuffled<T>(input: readonly T[]): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toItem(card: MCQCard): QuizItem {
  const correct = new Set(card.answers);
  const options = shuffled(
    card.options.map((text, i) => ({ text, correct: correct.has(i) })),
  );
  return { card, options, multi: correct.size > 1 };
}

/** Rebuild a single quiz item from a (possibly just-edited) card. */
export function quizItemFromCard(card: MCQCard): QuizItem {
  return toItem(card);
}

const isQuizzable = (c: { kind: string; status: string }): boolean =>
  c.kind === 'mcq' && c.status !== 'suspended';

/** Build a fresh, shuffled quiz queue for a deck (questions and options). */
export async function loadQuizQueue(deck: DeckId): Promise<QuizItem[]> {
  const contents = await loadDeck(deck);
  const mcqs = contents.all.filter((c): c is MCQCard => isQuizzable(c));
  return shuffled(mcqs).map(toItem);
}

/** Build a quiz over every multiple-choice question across all decks. */
export async function loadAllQuizQueue(): Promise<QuizItem[]> {
  const [shippedByDeck, userCards] = await Promise.all([
    Promise.all(CHAPTERS.map((c) => loadShippedDeck(c.id))),
    getAllCards(),
  ]);
  const mcqs = [...shippedByDeck.flat(), ...userCards].filter(
    (c): c is MCQCard => isQuizzable(c),
  );
  return shuffled(mcqs).map(toItem);
}

// ---- Flashcard → quiz (in-browser templating, no LLM) --------------------

const OPTION_COUNT = 4;

const isFlashcard = (c: { kind: string; status: string }): boolean =>
  c.kind === 'flashcard' && c.status !== 'suspended';

/** Template one flashcard into an MCQ; null if there are no usable distractors. */
function templateFlashcard(card: Flashcard, pool: Flashcard[]): QuizItem | null {
  const correct = card.back.trim();
  if (!correct) return null;

  // Distractors are sibling backs — same tag first, then any — deduped and
  // never equal to the correct answer.
  const sharesTag = (o: Flashcard) => o.tags.some((t) => card.tags.includes(t));
  const seen = new Set<string>([correct]);
  const candidates: string[] = [];
  for (const o of [...pool.filter(sharesTag), ...pool]) {
    if (o.id === card.id) continue;
    const back = o.back.trim();
    if (back && !seen.has(back)) {
      seen.add(back);
      candidates.push(back);
    }
  }
  if (candidates.length === 0) return null;

  const distractors = shuffled(candidates).slice(0, OPTION_COUNT - 1);
  const options = shuffled([
    { text: correct, correct: true },
    ...distractors.map((text) => ({ text, correct: false })),
  ]);
  // Synthetic MCQ card carrying the flashcard's identity (for display/source).
  const mcq: MCQCard = {
    id: card.id,
    deck: card.deck,
    tags: card.tags,
    status: card.status,
    source: card.source,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    kind: 'mcq',
    question: card.front,
    options: options.map((o) => o.text),
    answers: [options.findIndex((o) => o.correct)],
    explanation: '',
  };
  return { card: mcq, options, multi: false, generated: true };
}

function generateFlashcardQuiz(flashcards: Flashcard[]): QuizItem[] {
  return shuffled(flashcards)
    .map((f) => templateFlashcard(f, flashcards))
    .filter((it): it is QuizItem => it !== null);
}

/** A quiz templated from a deck's flashcards. */
export async function loadFlashcardQuiz(deck: DeckId): Promise<QuizItem[]> {
  const contents = await loadDeck(deck);
  const flashcards = contents.all.filter((c): c is Flashcard => isFlashcard(c));
  return generateFlashcardQuiz(flashcards);
}

/** A quiz templated from every flashcard across all decks. */
export async function loadAllFlashcardQuiz(): Promise<QuizItem[]> {
  const [shippedByDeck, userCards] = await Promise.all([
    Promise.all(CHAPTERS.map((c) => loadShippedDeck(c.id))),
    getAllCards(),
  ]);
  const flashcards = [...shippedByDeck.flat(), ...userCards].filter(
    (c): c is Flashcard => isFlashcard(c),
  );
  return generateFlashcardQuiz(flashcards);
}
