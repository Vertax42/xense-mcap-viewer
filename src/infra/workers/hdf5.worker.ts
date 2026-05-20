import * as Comlink from 'comlink';
import type { Initialization } from '@/core/types/ros';
import type {
  GetAdjacentMessageArgs,
  GetBackfillMessagesArgs,
  IMessageCursor,
  IWorkerSerializedSourceWorker,
  LoadProgress,
  MessageIteratorArgs,
  PlaybackBufferStatus,
  PreparePlaybackBufferArgs,
} from './types';
import type { TransportDiagnostics, WorkerTransportConfig } from './transport';
import { SharedPayloadRing } from './sharedPayloadRing';
import { MessageCursor } from './MessageCursor';
import { Hdf5IterableSource } from '@/infra/sources/hdf5/Hdf5IterableSource';
import { mountBlobAsFile, mountUrlAsLazyFile, type MountedFile } from '@/infra/sources/hdf5/H5FileSystem';
import { resolveWorkerHttpUrl } from '@/shared/utils/resolveWorkerHttpUrl';
import { DataQualityScanController } from './dataQualityScanController';

class Hdf5WorkerImpl implements IWorkerSerializedSourceWorker {
  private _source?: Hdf5IterableSource;
  private _initialization?: Initialization;
  private _mounted?: MountedFile;
  private _h5file?: { close(): unknown };
  private _transportConfig: WorkerTransportConfig = {
    mode: 'comlink',
    binaryPayloadThresholdBytes: 64 * 1024,
  };
  private _qualityScan = new DataQualityScanController();

  async initialize(args: { url?: string; file?: Blob; autoDataQualityScan?: boolean }): Promise<Initialization> {
    const h5mod = (await import('@ioai/hdf5')).default;
    await h5mod.ready;
    const h5 = h5mod as unknown as Parameters<typeof mountBlobAsFile>[0];

    if (args.file) {
      const name = (args.file as File).name ?? 'upload.h5';
      this._mounted = await mountBlobAsFile(h5, args.file, name);
    } else if (args.url) {
      this._mounted = await mountUrlAsLazyFile(h5, resolveWorkerHttpUrl(args.url));
    } else {
      throw new Error('Hdf5Worker: neither url nor file provided');
    }

    const File = (h5mod as unknown as { File: new (path: string, mode: string) => unknown }).File;
    try {
      this._h5file = new File(this._mounted.path, 'r') as typeof this._h5file;
    } catch (err) {
      console.error('[Hdf5Worker] failed to open HDF5 file', err);
      throw err;
    }

    this._source = new Hdf5IterableSource(this._h5file as never, {
      fileName: this._mounted.path,
    });
    const init = await this._source.initialize();
    this._initialization = init;
    this._qualityScan.initialize(this._source, init, args.autoDataQualityScan === true);
    return init;
  }

  configureTransport(config: WorkerTransportConfig): Promise<void> {
    this._transportConfig = config;
    return Promise.resolve();
  }

  getMessageCursor(args: MessageIteratorArgs): Promise<IMessageCursor<unknown>> {
    if (!this._source) throw new Error('Hdf5Worker: not initialized');
    const iterator = this._source.messageIterator(args);
    return Promise.resolve(Comlink.proxy(new MessageCursor(iterator, {
      ...this._transportConfig,
      latestOnlyTopics: args.latestOnlyTopics,
    })));
  }

  async getBackfillMessages(args: GetBackfillMessagesArgs) {
    if (!this._source) throw new Error('Hdf5Worker: not initialized');
    return await this._source.getBackfillMessages(args);
  }

  async getAdjacentMessage(args: GetAdjacentMessageArgs) {
    if (!this._source) throw new Error('Hdf5Worker: not initialized');
    return (await this._source.getAdjacentMessage?.(args)) ?? null;
  }

  preparePlaybackBuffer(_args: PreparePlaybackBufferArgs): Promise<PlaybackBufferStatus> {
    return Promise.resolve({ ready: true });
  }

  getLoadProgress(): Promise<LoadProgress> {
    // We have no incremental transfer statistics (@ioai/hdf5 reads chunks on
    // demand through the Emscripten FS layer, transparent to us). Report a
    // single filled range so the UI shows "ready".
    const total = this._mounted?.totalBytes ?? 0;
    if (total <= 0) {
      return Promise.resolve({ downloadedByteRanges: [], totalBytes: 0, percent: 100, parsedMessageRanges: [] });
    }
    return Promise.resolve({
      downloadedByteRanges: [{ start: 0, end: total }],
      totalBytes: total,
      percent: 100,
      parsedMessageRanges:
        this._initialization == undefined
          ? []
          : [{ start: this._initialization.start, end: this._initialization.end }],
    });
  }

  getDataQualityReport() {
    return Promise.resolve(this._qualityScan.getReport());
  }

  startDataQualityScan(): Promise<void> {
    return this._qualityScan.start();
  }

  getTransportDiagnostics(): Promise<TransportDiagnostics> {
    let droppedPayloads = 0;
    const ring = this._transportConfig.payloadRing;
    if (this._transportConfig.mode === 'sab' && this._transportConfig.payloadRing) {
      droppedPayloads = new SharedPayloadRing(this._transportConfig.payloadRing).droppedPayloads();
    }
    return Promise.resolve({
      mode: this._transportConfig.mode,
      binaryPayloadThresholdBytes: this._transportConfig.binaryPayloadThresholdBytes,
      sharedPayloadRing: ring
        ? {
            slotCount: ring.slotCount,
            slotSizeBytes: ring.slotSizeBytes,
            totalBytes: ring.slotCount * ring.slotSizeBytes,
          }
        : undefined,
      droppedPayloads,
      stalePayloadRefs: 0,
    });
  }
}

Comlink.expose(new Hdf5WorkerImpl());
