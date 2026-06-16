import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useHashRoute } from './hooks/useHashRoute';
import { DeckList } from './views/DeckList';
import { DeckView } from './views/DeckView';
import { ReviewSession } from './views/ReviewSession';
import { QuizSession } from './views/QuizSession';
import { Progress } from './views/Progress';
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
          {route.name === 'progress' && <Progress />}
          {route.name === 'deck' && <DeckView deckId={route.deckId} />}
          {route.name === 'review' && <ReviewSession deckId={route.deckId} />}
          {route.name === 'practice' && (
            <ReviewSession deckId={route.deckId} mode="practice" />
          )}
          {route.name === 'quiz' && <QuizSession deckId={route.deckId} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
