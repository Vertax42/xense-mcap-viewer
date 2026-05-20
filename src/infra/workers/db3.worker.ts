import * as Comlink from "comlink";
import type { Initialization, MessageEvent } from '@/core/types/ros';
import type {
  IWorkerSerializedSourceWorker,
  MessageIteratorArgs,
  GetBackfillMessagesArgs,
  GetAdjacentMessageArgs,
  IMessageCursor,
  PlaybackBufferStatus,
  PreparePlaybackBufferArgs,
} from "./types";
import { RosDb3IterableSource } from '@/infra/sources/RosDb3IterableSource';
import { MessageCursor } from "./MessageCursor";
import type { LoadProgress } from "./types";
import type { TransportDiagnostics, WorkerTransportConfig } from "./transport";
import { SharedPayloadRing } from "./sharedPayloadRing";
import { DataQualityScanController } from './dataQualityScanController';

class Db3Worker implements IWorkerSerializedSourceWorker {
  private _source?: RosDb3IterableSource;
  private _initialization?: Initialization;
  private _totalBytes = 0;
  private _transportConfig: WorkerTransportConfig = {
    mode: "comlink",
    binaryPayloadThresholdBytes: 64 * 1024,
  };
  private _qualityScan = new DataQualityScanController();

  async initialize(args: Record<string, unknown>): Promise<Initialization> {
    const rawFiles = args.files;
    const file = args.file;
    const files: File[] = Array.isArray(rawFiles)
      ? (rawFiles as unknown[]).filter((f): f is File => f instanceof File)
      : file instanceof File
        ? [file]
        : [];
    if (files.length === 0) {
      throw new Error("Invalid arguments for Db3Worker: files required");
    }

    const sqlWasmBinary = args.sqlWasmBinary instanceof ArrayBuffer ? args.sqlWasmBinary : undefined;
    this._source = new RosDb3IterableSource({ type: "files", files }, { sqlWasmBinary });
    this._totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const init = await this._source.initialize();
    this._initialization = init;
    this._qualityScan.initialize(this._source, init, args.autoDataQualityScan === true);
    return init;
  }

  getMessageCursor(args: MessageIteratorArgs): Promise<IMessageCursor<unknown>> {
    if (!this._source) throw new Error("Not initialized");

    const iterator = this._source.messageIterator(args);
    return Promise.resolve(Comlink.proxy(new MessageCursor(iterator, {
      ...this._transportConfig,
      latestOnlyTopics: args.latestOnlyTopics,
    })));
  }

  async getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    if (!this._source) throw new Error("Not initialized");
    return await this._source.getBackfillMessages(args);
  }

  async getAdjacentMessage(args: GetAdjacentMessageArgs): Promise<MessageEvent | null> {
    if (!this._source) throw new Error("Not initialized");
    return (await this._source.getAdjacentMessage?.(args)) ?? null;
  }

  preparePlaybackBuffer(_args: PreparePlaybackBufferArgs): Promise<PlaybackBufferStatus> {
    return Promise.resolve({ ready: true });
  }

  getLoadProgress(): Promise<LoadProgress> {
    if (this._totalBytes <= 0) {
      return Promise.resolve({ downloadedByteRanges: [], totalBytes: 0, percent: 0, parsedMessageRanges: [] });
    }
    return Promise.resolve({
      downloadedByteRanges: [{ start: 0, end: this._totalBytes }],
      totalBytes: this._totalBytes,
      percent: 100,
      parsedMessageRanges:
        this._initialization == undefined
          ? []
          : [{ start: this._initialization.start, end: this._initialization.end }],
    });
  }

  configureTransport(config: WorkerTransportConfig): Promise<void> {
    this._transportConfig = config;
    return Promise.resolve();
  }

  startDataQualityScan(): Promise<void> {
    return this._qualityScan.start();
  }

  getDataQualityReport() {
    return Promise.resolve(this._qualityScan.getReport());
  }

  getTransportDiagnostics(): Promise<TransportDiagnostics> {
    let droppedPayloads = 0;
    const ring = this._transportConfig.payloadRing;
    if (this._transportConfig.mode === "sab" && this._transportConfig.payloadRing) {
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

Comlink.expose(new Db3Worker());
