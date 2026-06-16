import type { DeckId, MCQCard } from '../types';
import { loadDeck } from './decks';

// Builds a quiz run over a deck's multiple-choice cards (shipped + user). The
// quiz is ephemeral — immediate feedback with the explanation always shown, no
// scheduling or persistence. Flashcards are handled by review/SM-2 instead.

export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizItem {
  card: MCQCard;
  /** Options in presentation order (shuffled), with the answer flagged. */
  options: QuizOption[];
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
  const options = shuffled(
    card.options.map((text, i) => ({ text, correct: i === card.answer })),
  );
  return { card, options };
}

/** Build a fresh, shuffled quiz queue for a deck (questions and options). */
export async function loadQuizQueue(deck: DeckId): Promise<QuizItem[]> {
  const contents = await loadDeck(deck);
  const mcqs = contents.all.filter(
    (c): c is MCQCard => c.kind === 'mcq' && c.status !== 'suspended',
  );
  return shuffled(mcqs).map(toItem);
}
