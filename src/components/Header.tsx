import { useTheme } from '../hooks/useTheme';
import { navigate, useHashRoute } from '../hooks/useHashRoute';

export function Header() {
  const { theme, toggle } = useTheme();
  const route = useHashRoute();

  return (
    <header className="app-header">
      <a
        className="app-mark"
        href="#/"
        onClick={(e) => {
          e.preventDefault();
          navigate({ name: 'decks' });
        }}
      >
        Actual intelligence
      </a>
      <nav className="app-nav">
        <a
          className={`app-nav-link${route.name === 'decks' ? ' active' : ''}`}
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            navigate({ name: 'decks' });
          }}
        >
          Decks
        </a>
        <a
          className={`app-nav-link${route.name === 'progress' ? ' active' : ''}`}
          href="#/progress"
          onClick={(e) => {
            e.preventDefault();
            navigate({ name: 'progress' });
          }}
        >
          Progress
        </a>
      </nav>
      <button
        className="icon-btn"
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          // Sun
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </svg>
        ) : (
          // Moon
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        )}
      </button>
    </header>
  );
}
