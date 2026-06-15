import { useRef, useState } from 'react';
import { buildBackup, downloadBackup, importFromFile, type ImportResult } from '../lib/backup';

// Export / import controls. Lives on the Progress page (reachable from the
// header on every screen). Import is available even with no cards, so a fresh
// device can restore from a backup file.

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; result: ImportResult }
  | { kind: 'error'; message: string };

function summarise(r: ImportResult): string {
  const parts: string[] = [];
  if (r.cardsAdded) parts.push(`${r.cardsAdded} added`);
  if (r.cardsUpdated) parts.push(`${r.cardsUpdated} updated`);
  if (r.cardsSkipped) parts.push(`${r.cardsSkipped} already current`);
  const cards = parts.length ? parts.join(', ') : 'no new cards';
  const reviews = r.reviewsMerged ? `, ${r.reviewsMerged} review record${r.reviewsMerged === 1 ? '' : 's'} merged` : '';
  return `Imported: ${cards}${reviews}.`;
}

export function BackupPanel({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const onExport = async () => {
    setStatus({ kind: 'working' });
    try {
      downloadBackup(await buildBackup());
      setStatus({ kind: 'idle' });
    } catch (e) {
      setStatus({ kind: 'error', message: String(e instanceof Error ? e.message : e) });
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    setStatus({ kind: 'working' });
    try {
      const result = await importFromFile(file);
      setStatus({ kind: 'done', result });
      onImported?.();
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <section className="backup-panel">
      <div className="backup-head">
        <h2>Your data</h2>
        <p className="muted small">
          Your cards live in this browser, on purpose. A backup file is how you
          keep them safe and move them between devices.
        </p>
      </div>
      <div className="backup-actions">
        <button className="btn btn-primary" onClick={() => void onExport()} disabled={status.kind === 'working'}>
          Export backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={status.kind === 'working'}>
          Import backup…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void onFile(e)}
          hidden
        />
      </div>
      {status.kind === 'done' && (
        <p className="backup-msg" role="status">
          {summarise(status.result)}
        </p>
      )}
      {status.kind === 'error' && (
        <p className="backup-msg error" role="alert">
          {status.message}
        </p>
      )}
      <p className="muted small">
        Importing merges into what’s here — it never deletes, and a card is only
        overwritten by a newer version of the same card.
      </p>
    </section>
  );
}
