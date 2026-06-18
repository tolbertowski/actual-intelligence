// Core content model for Actual Intelligence.
//
// Two card kinds share a common envelope (id, deck, tags, status, review
// state, timestamps). Quiz decks shipped with the app and flashcards authored
// by the user both use these types — the difference is only where they live
// (bundled JSON vs. IndexedDB), not their shape.

/** The fixed set of chapters from the COMP90054 course notes. */
export const CHAPTER_IDS = [
  'introduction',
  'modelling',
  'search',
  'heuristics',
  'relaxation',
  'mdps',
  'mcts',
  'model_free_prediction',
  'model_free_control',
  'approximation',
  'policy_gradient',
  'deep_learning',
  'transformers',
  'appendix',
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

/** A deck is keyed to exactly one chapter. */
export type DeckId = ChapterId;

/** Where a card came from — shipped quiz content vs. the user's own writing. */
export type CardSource = 'shipped' | 'user';

/**
 * Learning status, distinct from spaced-repetition scheduling.
 * `suspended` cards are kept but never surface for review or quiz.
 */
export type CardStatus = 'new' | 'learning' | 'review' | 'suspended';

export type CardKind = 'flashcard' | 'mcq';

/** Fields every card carries, regardless of kind. */
interface CardBase {
  /** Stable, unique id. Generated with crypto.randomUUID() for user cards. */
  id: string;
  deck: DeckId;
  tags: string[];
  status: CardStatus;
  source: CardSource;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
}

/** A two-sided flashcard. Front and back may contain LaTeX (KaTeX-rendered). */
export interface Flashcard extends CardBase {
  kind: 'flashcard';
  front: string;
  back: string;
}

/** A multiple-choice question. May contain LaTeX in every text field. */
export interface MCQCard extends CardBase {
  kind: 'mcq';
  question: string;
  options: string[];
  /**
   * Indices into `options` of the correct answer(s). One index is an ordinary
   * single-answer question; two or more makes it "select all that apply".
   */
  answers: number[];
  /** Always shown after answering, even on a correct response. */
  explanation: string;
}

export type Card = Flashcard | MCQCard;

/**
 * SM-2 spaced-repetition state. See lib/sm2.ts for the scheduling algorithm.
 */
export interface ReviewState {
  /** Easiness factor; SM-2 floor is 1.3. */
  ease: number;
  /** Current inter-repetition interval, in days. */
  interval: number;
  /** Number of consecutive successful recalls. */
  repetitions: number;
  /** Epoch milliseconds when the card next becomes due. */
  due: number;
  /** Epoch milliseconds of the most recent review. */
  lastReviewed: number;
}

/**
 * A review record persisted in its own IndexedDB store, keyed by card id.
 * Kept separate from the card so that scheduling state can attach to shipped
 * cards (which aren't stored in IndexedDB) as well as to user cards.
 */
export interface ReviewRecord extends ReviewState {
  cardId: string;
  deck: DeckId;
}

/** A recall grade, 0–5 in SM-2. The UI maps keys 1–4 onto the useful range. */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * User customisation of a deck, persisted in IndexedDB. For a built-in chapter
 * it holds title/description overrides (custom = false); for a user-created set
 * it is the set's own definition (custom = true).
 */
export interface DeckMeta {
  id: string;
  title?: string;
  description?: string;
  custom: boolean;
  createdAt: number;
  updatedAt: number;
}

/** User settings, persisted as a single record in IndexedDB. */
export interface AppSettings {
  /** Consecutive correct recalls before a card counts as "mature". */
  matureThreshold: number;
}

export const DEFAULT_SETTINGS: AppSettings = { matureThreshold: 3 };

/** Static metadata describing a chapter / deck. Not persisted — derived. */
export interface ChapterMeta {
  id: ChapterId;
  /** Sentence-case title shown in the UI. */
  title: string;
  /** One quiet line describing the chapter. */
  blurb: string;
  /** Path (relative to the site root) of the course-notes chapter. */
  notesPath: string;
}

/** Shape of a shipped quiz deck JSON file in /public/decks/. */
export interface ShippedDeck {
  deck: DeckId;
  /** Schema/version marker so importers can adapt later. */
  version: number;
  cards: ShippedCard[];
}

/**
 * A card as authored in shipped JSON: no per-user fields (id is assigned a
 * deterministic `shipped:` prefix on load; status/source/timestamps are
 * synthesised). Keeping the file format minimal makes decks easy to hand-edit.
 */
export type ShippedCard =
  | (Pick<Flashcard, 'kind' | 'front' | 'back'> & { id: string; tags?: string[] })
  | (Pick<MCQCard, 'kind' | 'question' | 'options' | 'explanation'> & {
      id: string;
      tags?: string[];
      /** Single correct option (convenient for hand-authoring). */
      answer?: number;
      /** Or several correct options for "select all that apply". */
      answers?: number[];
    });
