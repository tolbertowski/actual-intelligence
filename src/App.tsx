import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useHashRoute } from './hooks/useHashRoute';
import { DeckList } from './views/DeckList';
import { DeckView } from './views/DeckView';
import { ReviewSession } from './views/ReviewSession';
import './styles/app.css';

export function App() {
  const route = useHashRoute();

  return (
    <div className="app-shell">
      <Header />
      <main>
        {/* Keyed by route so a crash on one screen resets when navigating away. */}
        <ErrorBoundary key={`${route.name}:${'deckId' in route ? route.deckId : ''}`}>
          {route.name === 'decks' && <DeckList />}
          {route.name === 'deck' && <DeckView deckId={route.deckId} />}
          {route.name === 'review' && <ReviewSession deckId={route.deckId} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
