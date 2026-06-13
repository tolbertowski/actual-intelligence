import { Header } from './components/Header';
import { useHashRoute } from './hooks/useHashRoute';
import { DeckList } from './views/DeckList';
import { DeckView } from './views/DeckView';
import './styles/app.css';

export function App() {
  const route = useHashRoute();

  return (
    <div className="app-shell">
      <Header />
      <main>
        {route.name === 'decks' && <DeckList />}
        {route.name === 'deck' && <DeckView deckId={route.deckId} />}
      </main>
    </div>
  );
}
