import { useEffect, useState } from 'react';

// A minimal hash router. Hash routing avoids needing server-side rewrites,
// so the app works as plain static files on GitHub Pages with no 404 dance.
//
// Routes:
//   #/                       deck list
//   #/progress                collection-wide progress / stats
//   #/deck/:deckId            a single deck
//   #/review · #/practice · #/quiz            across every deck
//   #/deck/:deckId/review · …/practice · …/quiz   scoped to one deck

type Session = {
  name: 'review' | 'practice' | 'quiz' | 'flashquiz';
  deckId?: string;
};

export type Route =
  | { name: 'decks' }
  | { name: 'progress' }
  | { name: 'deck'; deckId: string }
  | Session;

const SESSIONS = ['review', 'practice', 'quiz', 'flashquiz'] as const;
type SessionName = (typeof SESSIONS)[number];

function isSession(s: string): s is SessionName {
  return (SESSIONS as readonly string[]).includes(s);
}

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean); // ['deck', 'mdps', 'review']
  if (parts[0] === 'progress') return { name: 'progress' };
  // Global session: #/review, #/practice, #/quiz
  if (parts.length === 1 && isSession(parts[0])) return { name: parts[0] };
  if (parts[0] === 'deck' && parts[1]) {
    const deckId = decodeURIComponent(parts[1]);
    if (parts[2] && isSession(parts[2])) return { name: parts[2], deckId };
    return { name: 'deck', deckId };
  }
  return { name: 'decks' };
}

export function navigate(route: Route): void {
  let hash = '#/';
  if (route.name === 'progress') hash = '#/progress';
  else if (route.name === 'deck') hash = `#/deck/${encodeURIComponent(route.deckId)}`;
  else if (
    route.name === 'review' ||
    route.name === 'practice' ||
    route.name === 'quiz' ||
    route.name === 'flashquiz'
  ) {
    hash = route.deckId
      ? `#/deck/${encodeURIComponent(route.deckId)}/${route.name}`
      : `#/${route.name}`;
  }
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}
