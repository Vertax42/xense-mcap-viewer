import React from 'react';
import { useIntl } from 'react-intl';
import type { SampleDataset } from '@/services/sampleDatasets';
import { useSampleDatasets } from '@/hooks/useSampleDatasets';
import { SampleDatasetList } from '@/features/workspace/welcome/SampleDatasetList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

interface SampleDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sample: SampleDataset) => void | Promise<void>;
}

export const SampleDatasetDialog: React.FC<SampleDatasetDialogProps> = ({ open, onOpenChange, onSelect }) => {
  const { formatMessage } = useIntl();
  const { samples, loading } = useSampleDatasets();

  const handleSelect = async (sample: SampleDataset) => {
    await onSelect(sample);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'welcome.samplesDialogTitle' })}</DialogTitle>
          <DialogDescription>{formatMessage({ id: 'welcome.samplesDialogDescription' })}</DialogDescription>
        </DialogHeader>
        <SampleDatasetList samples={samples} loading={loading} onSelect={handleSelect} />
      </DialogContent>
    </Dialog>
  );
};
