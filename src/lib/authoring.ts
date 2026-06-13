import type { Card, CardKind, DeckId, Flashcard, MCQCard } from '../types';
import {
  deleteCard,
  getAllCards,
  getCard,
  putCard,
  requestPersistence,
} from './db';

// Create / edit / delete for user-authored cards. Sits on top of the db
// wrapper and owns the rules that matter for durability and identity:
// stable ids, timestamps, and asking for persistent storage the first time
// the user commits a card to this device.

/** Editable fields shared by the editor form, before they become a Card. */
export interface FlashcardDraft {
  kind: 'flashcard';
  front: string;
  back: string;
  tags: string[];
}

export interface MCQDraft {
  kind: 'mcq';
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  tags: string[];
}

export type CardDraft = FlashcardDraft | MCQDraft;

/** A blank draft for the editor to start from. */
export function emptyDraft(kind: CardKind): CardDraft {
  if (kind === 'mcq') {
    return {
      kind: 'mcq',
      question: '',
      options: ['', '', '', ''],
      answer: 0,
      explanation: '',
      tags: [],
    };
  }
  return { kind: 'flashcard', front: '', back: '', tags: [] };
}

/** Turn an existing card back into an editable draft. */
export function draftFromCard(card: Card): CardDraft {
  if (card.kind === 'mcq') {
    return {
      kind: 'mcq',
      question: card.question,
      options: [...card.options],
      answer: card.answer,
      explanation: card.explanation,
      tags: [...card.tags],
    };
  }
  return {
    kind: 'flashcard',
    front: card.front,
    back: card.back,
    tags: [...card.tags],
  };
}

/** Parse a free-text tag field ("bellman, mdp") into a clean tag list. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,\n]/)) {
    const t = raw.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

export interface DraftError {
  field: string;
  message: string;
}

/** Validate a draft; empty array means it's saveable. */
export function validateDraft(draft: CardDraft): DraftError[] {
  const errors: DraftError[] = [];
  if (draft.kind === 'flashcard') {
    if (!draft.front.trim())
      errors.push({ field: 'front', message: 'The front needs some text.' });
    if (!draft.back.trim())
      errors.push({ field: 'back', message: 'The back needs some text.' });
  } else {
    if (!draft.question.trim())
      errors.push({ field: 'question', message: 'The question needs some text.' });
    const filled = draft.options.filter((o) => o.trim());
    if (filled.length < 2)
      errors.push({ field: 'options', message: 'Give at least two options.' });
    if (!draft.options[draft.answer]?.trim())
      errors.push({ field: 'answer', message: 'Mark the correct option.' });
    if (!draft.explanation.trim())
      errors.push({
        field: 'explanation',
        message: 'Add an explanation — it always shows after answering.',
      });
  }
  return errors;
}

/** The kind-agnostic fields every card carries. */
type CardEnvelope = Omit<
  Flashcard,
  'kind' | 'front' | 'back' | 'tags'
>;

/**
 * Build a clean Card from an envelope plus a draft. Rebuilding from scratch
 * (rather than spreading + deleting) keeps the discriminated union honest when
 * the user switches a card's kind in the editor.
 */
function buildCard(env: CardEnvelope, draft: CardDraft): Card {
  if (draft.kind === 'flashcard') {
    const card: Flashcard = {
      ...env,
      kind: 'flashcard',
      front: draft.front.trim(),
      back: draft.back.trim(),
      tags: draft.tags,
    };
    return card;
  }
  // Filtering empty options can shift indices, so remap the answer to the
  // surviving option's new position.
  const kept: { text: string; original: number }[] = [];
  draft.options.forEach((o, i) => {
    const text = o.trim();
    if (text) kept.push({ text, original: i });
  });
  const answer = Math.max(
    0,
    kept.findIndex((k) => k.original === draft.answer),
  );
  const card: MCQCard = {
    ...env,
    kind: 'mcq',
    question: draft.question.trim(),
    options: kept.map((k) => k.text),
    answer,
    explanation: draft.explanation.trim(),
    tags: draft.tags,
  };
  return card;
}

/** Create a new user card in the given deck. Requests persistence on first card. */
export async function createCard(deck: DeckId, draft: CardDraft): Promise<Card> {
  const existing = await getAllCards();
  const now = Date.now();
  const card = buildCard(
    {
      id: crypto.randomUUID(),
      deck,
      status: 'new',
      source: 'user',
      createdAt: now,
      updatedAt: now,
    },
    draft,
  );
  await putCard(card);

  // On the very first card the user commits, ask the browser to keep our
  // storage through eviction pressure. Best-effort; export is still the backup.
  if (existing.length === 0) {
    await requestPersistence();
  }
  return card;
}

/** Update an existing user card. */
export async function updateCard(id: string, draft: CardDraft): Promise<Card> {
  const existing = await getCard(id);
  if (!existing) throw new Error(`No card with id ${id}`);
  const { id: _id, deck, status, source, review, createdAt } = existing;
  const card = buildCard(
    { id: _id, deck, status, source, review, createdAt, updatedAt: Date.now() },
    draft,
  );
  await putCard(card);
  return card;
}

export async function removeCard(id: string): Promise<void> {
  await deleteCard(id);
}
