import type { ChapterId, ChapterMeta } from '../types';
import { CHAPTER_IDS } from '../types';

// Static chapter metadata. Titles and blurbs mirror the structure of the
// COMP90054 course notes (https://comp90054.github.io/reinforcement-learning/).
// Order here is the order chapters are taught, which is the order we render.

const META: Record<ChapterId, Omit<ChapterMeta, 'id' | 'notesPath'>> = {
  introduction: {
    title: 'Introduction',
    blurb: 'What reinforcement learning is, and the shape of the problem.',
  },
  modelling: {
    title: 'Modelling',
    blurb: 'Framing a task as states, actions, and rewards.',
  },
  search: {
    title: 'Search',
    blurb: 'Uninformed and informed search over state spaces.',
  },
  heuristics: {
    title: 'Heuristics',
    blurb: 'Guiding search with admissible, consistent estimates.',
  },
  relaxation: {
    title: 'Relaxation',
    blurb: 'Deriving heuristics by relaxing the problem.',
  },
  mdps: {
    title: 'Markov decision processes',
    blurb: 'Value functions, Bellman equations, and dynamic programming.',
  },
  mcts: {
    title: 'Monte Carlo tree search',
    blurb: 'Planning by sampling: selection, expansion, simulation, backup.',
  },
  model_free_prediction: {
    title: 'Model-free prediction',
    blurb: 'Estimating value without a model — Monte Carlo and TD.',
  },
  model_free_control: {
    title: 'Model-free control',
    blurb: 'Q-learning, SARSA, and the control problem.',
  },
  approximation: {
    title: 'Function approximation',
    blurb: 'Scaling value functions beyond a lookup table.',
  },
  policy_gradient: {
    title: 'Policy gradients',
    blurb: 'Optimising the policy directly. REINFORCE and actor–critic.',
  },
  deep_learning: {
    title: 'Deep learning',
    blurb: 'Neural networks as the function approximator.',
  },
  transformers: {
    title: 'Transformers',
    blurb: 'Attention, sequence models, and their use in RL.',
  },
  appendix: {
    title: 'Appendix',
    blurb: 'Background, notation, and supporting material.',
  },
};

/** The site path for a chapter's notes, used for "read the notes" links. */
const NOTES_BASE = 'https://comp90054.github.io/reinforcement-learning';

export const CHAPTERS: ChapterMeta[] = CHAPTER_IDS.map((id) => ({
  id,
  notesPath: `${NOTES_BASE}/${id}.html`,
  ...META[id],
}));

const BY_ID = new Map<ChapterId, ChapterMeta>(CHAPTERS.map((c) => [c.id, c]));

export function getChapter(id: ChapterId): ChapterMeta | undefined {
  return BY_ID.get(id);
}

export function isChapterId(value: string): value is ChapterId {
  return BY_ID.has(value as ChapterId);
}
