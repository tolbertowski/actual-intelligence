import type { DeckStats } from '../lib/stats';
import { FORECAST_DAYS } from '../lib/stats';

// Library-free stat visuals shared by the Progress page and the deck panel.
// Colours come from the global tokens; everything degrades gracefully when a
// scope has no cards.

/** A stacked bar of new / young / mature proportions. */
export function MaturityBar({ stats, showLegend = true }: { stats: DeckStats; showLegend?: boolean }) {
  const { new: fresh, young, mature, total } = stats;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  return (
    <div className="maturity">
      <div
        className="maturity-bar"
        role="img"
        aria-label={`${mature} mature, ${young} in progress, ${fresh} new of ${total} cards`}
      >
        {mature > 0 && <span className="seg seg-mature" style={{ width: `${pct(mature)}%` }} />}
        {young > 0 && <span className="seg seg-young" style={{ width: `${pct(young)}%` }} />}
        {fresh > 0 && <span className="seg seg-new" style={{ width: `${pct(fresh)}%` }} />}
        {total === 0 && <span className="seg seg-empty" style={{ width: '100%' }} />}
      </div>
      {showLegend && (
        <ul className="maturity-legend" aria-hidden="true">
          <li><span className="dot dot-mature" />Mature {mature}</li>
          <li><span className="dot dot-young" />In progress {young}</li>
          <li><span className="dot dot-new" />New {fresh}</li>
        </ul>
      )}
    </div>
  );
}

function formatEase(ease: number | null): string {
  return ease == null ? '—' : ease.toFixed(2);
}

/** Labelled number tiles. */
export function StatGrid({ stats }: { stats: DeckStats }) {
  const reviewed = stats.total - stats.new;
  const tiles: { label: string; value: string | number }[] = [
    { label: 'Flashcards', value: stats.total },
    { label: 'Reviewed', value: reviewed },
    { label: 'Due today', value: stats.dueToday },
    { label: 'Avg. ease', value: formatEase(stats.avgEase) },
  ];
  return (
    <dl className="stat-grid">
      {tiles.map((t) => (
        <div className="stat-tile" key={t.label}>
          <dt>{t.label}</dt>
          <dd>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const DAY_LABELS = ['Today', '+1', '+2', '+3', '+4', '+5', '+6'];

/** Seven CSS bars showing how many cards are due each of the next days. */
export function DueForecast({ forecast }: { forecast: number[] }) {
  const max = Math.max(1, ...forecast);
  return (
    <div className="due-forecast">
      <span className="field-label muted">Due in the next {FORECAST_DAYS} days</span>
      <div className="forecast-bars">
        {forecast.map((count, i) => (
          <div className="forecast-col" key={i}>
            <span className="forecast-count muted">{count > 0 ? count : ''}</span>
            <div className="forecast-track" aria-hidden="true">
              <div
                className="forecast-fill"
                style={{ height: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="forecast-day muted">{DAY_LABELS[i] ?? `+${i}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
