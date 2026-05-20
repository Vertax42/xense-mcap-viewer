import { useEffect, useState } from 'react';
import type { SampleDataset } from '@/services/sampleDatasets';
import { loadSampleDatasets } from '@/services/sampleDatasets';

export function useSampleDatasets() {
  const [samples, setSamples] = useState<SampleDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await loadSampleDatasets();
        if (!cancelled) {
          setSamples(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setSamples([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { samples, loading, error };
}
