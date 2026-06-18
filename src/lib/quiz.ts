import type { DeckId, MCQCard } from '../types';
import { loadDeck, loadShippedDeck } from './decks';
import { getAllCards } from './db';
import { CHAPTERS } from '../data/chapters';

// Builds a quiz run over a deck's multiple-choice cards (shipped + user). The
// quiz is ephemeral — immediate feedback with the explanation always shown, no
// scheduling or persistence. Flashcards are handled by review/SM-2 instead.

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
