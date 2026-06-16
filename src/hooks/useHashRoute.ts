import { useEffect, useState } from 'react';

// A minimal hash router. Hash routing avoids needing server-side rewrites,
// so the app works as plain static files on GitHub Pages with no 404 dance.
//
// Routes:
//   #/                       deck list
//   #/progress                collection-wide progress / stats
//   #/deck/:deckId            a single deck
//   #/deck/:deckId/review     a review session for that deck
//   #/deck/:deckId/practice   drill all of a deck's flashcards (no scheduling)
//   #/deck/:deckId/quiz       a quiz run over that deck's MCQs

export type Route =
  | { name: 'decks' }
  | { name: 'progress' }
  | { name: 'deck'; deckId: string }
  | { name: 'review'; deckId: string }
  | { name: 'practice'; deckId: string }
  | { name: 'quiz'; deckId: string };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean); // ['deck', 'mdps', 'review']
  if (parts[0] === 'progress') return { name: 'progress' };
  if (parts[0] === 'deck' && parts[1]) {
    const deckId = decodeURIComponent(parts[1]);
    if (parts[2] === 'review') return { name: 'review', deckId };
    if (parts[2] === 'practice') return { name: 'practice', deckId };
    if (parts[2] === 'quiz') return { name: 'quiz', deckId };
    return { name: 'deck', deckId };
  }
  return { name: 'decks' };
}

export function navigate(route: Route): void {
  let hash = '#/';
  if (route.name === 'progress') hash = '#/progress';
  else if (route.name === 'deck') hash = `#/deck/${encodeURIComponent(route.deckId)}`;
  else if (route.name === 'review')
    hash = `#/deck/${encodeURIComponent(route.deckId)}/review`;
  else if (route.name === 'practice')
    hash = `#/deck/${encodeURIComponent(route.deckId)}/practice`;
  else if (route.name === 'quiz')
    hash = `#/deck/${encodeURIComponent(route.deckId)}/quiz`;
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
