import { useEffect, useState } from 'react';

// A minimal hash router. Hash routing avoids needing server-side rewrites,
// so the app works as plain static files on GitHub Pages with no 404 dance.
//
// Routes:
//   #/                 deck list
//   #/deck/:deckId      a single deck

export type Route =
  | { name: 'decks' }
  | { name: 'deck'; deckId: string };

function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean); // ['deck', 'mdps']
  if (parts[0] === 'deck' && parts[1]) {
    return { name: 'deck', deckId: decodeURIComponent(parts[1]) };
  }
  return { name: 'decks' };
}

export function navigate(route: Route): void {
  const hash =
    route.name === 'deck' ? `#/deck/${encodeURIComponent(route.deckId)}` : '#/';
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
