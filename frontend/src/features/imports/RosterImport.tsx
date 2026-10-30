import { useState } from 'react';
import { errorMessage } from '../../api/client';
import { UploadForm } from './UploadForm';
import { BatchDetails } from './BatchDetails';

export function RosterImport({ onImported }: { onImported: () => Promise<void> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  return (
    <details className="roster-import">
      <summary>Temsilci kadrosu yükle</summary>
      <UploadForm
        kind="agents"
        onComplete={(batches) => {
          setSelected(batches[0]?.id ?? null);
          setVersion((value) => value + 1);
          setError('');
          void onImported().catch((reason) =>
            setError(`Kadro görünümü yenilenemedi. ${errorMessage(reason)}`),
          );
        }}
      />
      {error && <p role="alert">{error}</p>}
      {selected !== null && <BatchDetails key={`${selected}:${version}`} id={selected} />}
    </details>
  );
}
