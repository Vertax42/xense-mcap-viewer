import type { DataQualityReport, Initialization } from '@/core/types/ros';
import type { IIterableSource } from '@/infra/sources/IIterableSource';
import {
  createIdleDataQualityReport,
  scanDataQualityFromSource,
  shouldAutoScanDataQuality,
  totalMessagesFromInitialization,
} from '@/infra/quality/scanRunner';
import { createInitialDataQualityReport } from '@/core/quality/scanSession';

export class DataQualityScanController {
  private _source?: IIterableSource;
  private _initialization?: Initialization;
  private _report: DataQualityReport = createInitialDataQualityReport();
  private _scanPromise?: Promise<void>;

  initialize(source: IIterableSource, initialization: Initialization, autoRequested: boolean): void {
    this._source = source;
    this._initialization = initialization;
    this._report = createIdleDataQualityReport(initialization);

    if (autoRequested && shouldAutoScanDataQuality(totalMessagesFromInitialization(initialization))) {
      void this.start();
    }
  }

  getReport(): DataQualityReport {
    return this._report;
  }

  start(): Promise<void> {
    if (this._scanPromise) {
      return this._scanPromise;
    }
    if (!this._source || !this._initialization) {
      this._report = { ...createInitialDataQualityReport(), status: 'ready', updatedAt: Date.now() };
      return Promise.resolve();
    }

    this._report = {
      ...createInitialDataQualityReport(),
      status: 'scanning',
      totalMessages: totalMessagesFromInitialization(this._initialization),
      scanCoverage: {
        mode: 'complete',
        activeRange: { start: this._initialization.start, end: this._initialization.end },
        scannedRanges: [{ start: this._initialization.start, end: this._initialization.end }],
      },
      updatedAt: Date.now(),
    };

    this._scanPromise = scanDataQualityFromSource(this._source, this._initialization, (partial) => {
      this._report = partial;
    })
      .then((report) => {
        this._report = report;
      })
      .catch((error) => {
        console.warn('Data quality scan failed', error);
        this._report = {
          ...this._report,
          status: 'ready',
          noticePayload: { key: 'quality.scan.failed', values: {} },
          updatedAt: Date.now(),
        };
      })
      .finally(() => {
        this._scanPromise = undefined;
      });

    return this._scanPromise;
  }
}
