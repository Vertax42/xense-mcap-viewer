import React from 'react';
import type { SampleDataset } from '@/services/sampleDatasets';

interface SampleDatasetCardProps {
  sample: SampleDataset;
  onSelect: (sample: SampleDataset) => void | Promise<void>;
  layout?: 'row' | 'grid';
}

export const SampleDatasetCard: React.FC<SampleDatasetCardProps> = ({ sample, onSelect, layout = 'row' }) => {
  const title = sample.title || sample.name;
  const cover = sample.coverImageUrl;

  if (layout === 'grid') {
    return (
      <button
        type="button"
        onClick={() => void onSelect(sample)}
        className="group flex h-full flex-col overflow-hidden rounded-lg bg-muted/20 text-left transition-colors hover:bg-muted/35"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 bg-muted">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/40 text-xs font-medium text-muted-foreground">
              MCAP
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1 p-3">
          <div className="line-clamp-2 text-sm font-medium leading-snug">{title}</div>
          {sample.description ? (
            <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{sample.description}</div>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void onSelect(sample)}
      className="group flex w-full overflow-hidden rounded-lg bg-muted/20 text-left transition-colors hover:bg-muted/35"
    >
      <div className="relative h-[4.5rem] w-20 shrink-0 bg-muted">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/40 text-[10px] font-medium text-muted-foreground">
            MCAP
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
        <div className="truncate text-sm font-medium leading-snug">{title}</div>
        {sample.description ? (
          <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{sample.description}</div>
        ) : null}
      </div>
    </button>
  );
};
