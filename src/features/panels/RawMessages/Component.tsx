import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { messageBus } from '@/core/pipeline/messageBus';
import { useMessagePipeline } from '@/core/pipeline/useMessagePipeline';
import { useTopicSeq } from '@/core/pipeline/useMessageBus';
import type { MessageEvent } from '@/core/types/ros';
import type { MessagePipelineState } from '@/core/pipeline/store';
import type { Player } from '@/core/types/player';
import { pickDefaultRawMessagesTopic } from '@/features/layout/autoLayout/pickDefaultRawMessagesTopic';
import { TopicQuickPicker } from '../framework/TopicQuickPicker';
import type { RawMessagesConfig } from './defaults';
import { buildRowsForShape, type FlatRow } from './shapeTree';

interface RawMessagesPanelProps {
  player: Player;
  panelId: string;
  topic: string;
  uiRefreshHz?: number;
  pauseUpdates?: boolean;
  latestOnly?: boolean;
  maxExpandedDepth?: number;
  maxRows?: number;
  maxBinaryPreviewBytes?: number;
  binaryCopyFormat?: RawMessagesConfig['binaryCopyFormat'];
  setConfig: (next: RawMessagesConfig | ((prev: RawMessagesConfig) => RawMessagesConfig)) => void;
}

type BinaryCopyFormat = RawMessagesConfig['binaryCopyFormat'];
type ValueKind = 'string' | 'number' | 'boolean' | 'null' | 'binary' | 'object' | 'array' | 'unknown';

interface ValueVisual {
  text: string;
  kind: ValueKind;
}

interface StreamStats {
  incomingUpdates: number;
  displayedUpdates: number;
  droppedUpdates: number;
  shapeMisses: number;
  framePatchMs: number;
}

const ROW_HEIGHT = 22;
const OVERSCAN_ROWS = 8;
const MAX_VISIBLE_PATCH_ROWS = 1200;
const MAX_OBJECT_PREVIEW_FIELDS = 3;
const MAX_PREVIEW_STRING_LENGTH = 80;

function toHex(data: Uint8Array): string {
  let out = '';
  for (let i = 0; i < data.length; i++) {
    out += data[i].toString(16).padStart(2, '0');
  }
  return out;
}

function toBase64(data: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, Math.min(i + chunkSize, data.length)));
  }
  return btoa(binary);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

function pathToParts(path: string): string[] {
  return path.split('.').filter((part) => part.length > 0);
}

function readValueAtPath(root: unknown, path: string): unknown {
  if (!path || path === 'message') return root;
  const parts = pathToParts(path.replace(/^message\./, ''));
  let current: unknown = root;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) return undefined;
      current = current[idx];
      continue;
    }
    if (!isPlainObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function getVisibleRows(rows: FlatRow[], expandedPaths: Set<string>): FlatRow[] {
  const out: FlatRow[] = [];
  const collapseStack: number[] = [];
  for (const row of rows) {
    while (collapseStack.length > 0 && row.depth <= collapseStack[collapseStack.length - 1]) {
      collapseStack.pop();
    }
    if (collapseStack.length > 0) continue;
    out.push(row);
    if (row.expandable && !expandedPaths.has(row.path)) {
      collapseStack.push(row.depth);
    }
  }
  return out;
}

function previewPrimitive(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    const text = JSON.stringify(value);
    return text.length > MAX_PREVIEW_STRING_LENGTH ? `${text.slice(0, MAX_PREVIEW_STRING_LENGTH)}...` : text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Uint8Array) return `Uint8Array(${value.byteLength})`;
  if (value instanceof ArrayBuffer) return `ArrayBuffer(${value.byteLength})`;
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isPlainObject(value)) return `{${Object.keys(value).length} keys}`;
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return value.toString();
  if (value !== null && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  if (value === undefined) {
    return 'undefined';
  }
  return Object.prototype.toString.call(value);
}

function previewObject(value: Record<string, unknown>): string | null {
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';

  const fields = keys.slice(0, MAX_OBJECT_PREVIEW_FIELDS).map((key) => `${JSON.stringify(key)}:${previewPrimitive(value[key])}`);
  return `{${fields.join(',')}${keys.length > MAX_OBJECT_PREVIEW_FIELDS ? ',...' : ''}}`;
}

function describeValue(value: unknown, maxBinaryPreviewBytes: number): ValueVisual {
  if (value instanceof Uint8Array) {
    const head = value.subarray(0, Math.min(value.byteLength, maxBinaryPreviewBytes));
    return {
      text: `Uint8Array(${value.byteLength}) 0x${toHex(head)}${value.byteLength > head.byteLength ? '...' : ''}`,
      kind: 'binary',
    };
  }
  if (value instanceof ArrayBuffer) {
    return describeValue(new Uint8Array(value), maxBinaryPreviewBytes);
  }
  if (Array.isArray(value)) return { text: `Array(${value.length})`, kind: 'array' };
  if (isPlainObject(value)) {
    return { text: previewObject(value) ?? `{${Object.keys(value).length} keys}`, kind: 'object' };
  }
  if (value === null) return { text: 'null', kind: 'null' };
  if (typeof value === 'string') return { text: JSON.stringify(value), kind: 'string' };
  if (typeof value === 'number') return { text: String(value), kind: 'number' };
  if (typeof value === 'boolean') return { text: value ? 'true' : 'false', kind: 'boolean' };
  if (typeof value === 'bigint') return { text: `${value.toString()}n`, kind: 'unknown' };
  if (typeof value === 'function') return { text: '[Function]', kind: 'unknown' };
  if (typeof value === 'symbol') return { text: value.toString(), kind: 'unknown' };
  if (value !== null && typeof value === 'object') {
    try {
      return { text: JSON.stringify(value), kind: 'unknown' };
    } catch {
      return { text: Object.prototype.toString.call(value), kind: 'unknown' };
    }
  }
  if (value === undefined) {
    return { text: 'undefined', kind: 'unknown' };
  }
  return { text: Object.prototype.toString.call(value), kind: 'unknown' };
}

function valueColor(kind: ValueKind): string {
  switch (kind) {
    case 'string':
      return 'rgb(163 230 53)'; // lime-300
    case 'number':
      return 'rgb(125 211 252)'; // sky-300
    case 'boolean':
      return 'rgb(196 181 253)'; // violet-300
    case 'null':
      return 'rgb(248 113 113)'; // red-400
    case 'binary':
      return 'rgb(251 191 36)'; // amber-400
    case 'object':
    case 'array':
      return 'rgb(203 213 225)'; // slate-300
    default:
      return 'rgb(229 231 235)'; // gray-200
  }
}

function serializeForCopy(value: unknown, binaryFormat: BinaryCopyFormat): unknown {
  if (value instanceof Uint8Array) {
    if (binaryFormat === 'hex') return { __type: 'Uint8Array', encoding: 'hex', data: toHex(value) };
    if (binaryFormat === 'base64') return { __type: 'Uint8Array', encoding: 'base64', data: toBase64(value) };
    return { __type: 'Uint8Array', data: Array.from(value) };
  }
  if (value instanceof ArrayBuffer) return serializeForCopy(new Uint8Array(value), binaryFormat);
  if (Array.isArray(value)) return value.map((entry) => serializeForCopy(entry, binaryFormat));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = serializeForCopy(entry, binaryFormat);
    return out;
  }
  return value;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function useScheduledTopicMessage(
  topic: string,
  topicSeq: number,
  uiRefreshHz: number,
  paused: boolean,
  latestOnly: boolean,
) {
  const [displayed, setDisplayed] = useState<MessageEvent | null>(() => messageBus.getLastMessage(topic));
  const [stats, setStats] = useState<StreamStats>({
    incomingUpdates: 0,
    displayedUpdates: 0,
    droppedUpdates: 0,
    shapeMisses: 0,
    framePatchMs: 0,
  });
  const latestRef = useRef<MessageEvent | null>(messageBus.getLastMessage(topic));
  const pendingRef = useRef(0);
  const lastDisplayedAtRef = useRef(0);

  useEffect(() => {
    latestRef.current = messageBus.getLastMessage(topic);
    pendingRef.current = latestOnly ? 1 : pendingRef.current + 1;
    setStats((prev) => ({ ...prev, incomingUpdates: prev.incomingUpdates + 1 }));
  }, [latestOnly, topic, topicSeq]);

  useEffect(() => {
    pendingRef.current = 0;
    setDisplayed(messageBus.getLastMessage(topic));
    lastDisplayedAtRef.current = performance.now();
  }, [topic]);

  useEffect(() => {
    let rafId = 0;
    const minInterval = 1000 / Math.max(1, uiRefreshHz);
    const tick = () => {
      const now = performance.now();
      if (!paused && pendingRef.current > 0 && now - lastDisplayedAtRef.current >= minInterval) {
        const dropped = Math.max(0, pendingRef.current - 1);
        pendingRef.current = 0;
        setDisplayed(latestRef.current);
        setStats((prev) => ({
          ...prev,
          displayedUpdates: prev.displayedUpdates + 1,
          droppedUpdates: prev.droppedUpdates + dropped,
        }));
        lastDisplayedAtRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [paused, uiRefreshHz]);

  return { displayed, stats, setStats };
}

export const RawMessagesPanel: React.FC<RawMessagesPanelProps> = ({
  player,
  panelId,
  topic,
  uiRefreshHz = 10,
  pauseUpdates = false,
  latestOnly = true,
  maxExpandedDepth = 4,
  maxRows = 2000,
  maxBinaryPreviewBytes = 256,
  binaryCopyFormat = 'uint8array',
  setConfig,
}) => {
  const { formatMessage } = useIntl();
  const topics = useMessagePipeline((state: MessagePipelineState) => state.sortedTopics);
  const didAutoPickTopicRef = useRef(false);

  useEffect(() => {
    if (didAutoPickTopicRef.current) return;
    if (topic && topic.trim().length > 0) {
      didAutoPickTopicRef.current = true;
      return;
    }
    if (topics.length === 0) return;
    const autoTopic = pickDefaultRawMessagesTopic(topics);
    if (!autoTopic) return;
    didAutoPickTopicRef.current = true;
    setConfig((prev) => ({ ...prev, topic: autoTopic }));
  }, [setConfig, topic, topics]);

  useEffect(() => {
    if (!topic || topic.trim().length === 0) {
      player.unregisterSubscriptions(panelId);
      return;
    }
    player.registerSubscriptions(panelId, [{ topic, subscriberId: panelId }]);
    return () => player.unregisterSubscriptions(panelId);
  }, [player, panelId, topic]);

  const topicSeq = useTopicSeq(topic);
  const { displayed: displayMessage, setStats } = useScheduledTopicMessage(
    topic,
    topicSeq,
    uiRefreshHz,
    pauseUpdates,
    latestOnly,
  );

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['message']));
  const [shapeRows, setShapeRows] = useState<FlatRow[]>([]);
  const [shapeSignature, setShapeSignature] = useState<string>('');
  const [viewportHeight, setViewportHeight] = useState(240);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const valueNodeRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const latestValueVisualRef = useRef<Map<string, ValueVisual>>(new Map());
  const pendingPatchRef = useRef<Map<string, ValueVisual>>(new Map());
  const patchRafRef = useRef<number | null>(null);
  const didInitializeExpansionRef = useRef(false);
  const visibleRows = useMemo(() => {
    if (shapeRows.length === 0) return [];
    return getVisibleRows(shapeRows, expandedPaths);
  }, [expandedPaths, shapeRows]);

  const totalRows = visibleRows.length;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2;
  const endRow = Math.min(totalRows, startRow + visibleCount);
  const windowRows = visibleRows.slice(startRow, endRow);

  useEffect(() => {
    if (!displayMessage) return;
    const nextShape = buildRowsForShape(displayMessage.message, maxExpandedDepth, maxRows);
    const shapeChanged = nextShape.signature !== shapeSignature;
    let patchRows = visibleRows.slice(startRow, endRow);
    if (shapeChanged) {
      setShapeRows(nextShape.rows);
      setShapeSignature(nextShape.signature);
      setStats((prev) => ({ ...prev, shapeMisses: prev.shapeMisses + 1 }));
      let expandedForShape = expandedPaths;
      if (!didInitializeExpansionRef.current) {
        const nextExpanded = new Set<string>(['message']);
        for (const row of nextShape.rows) {
          if (row.depth === 1 && row.expandable) {
            nextExpanded.add(row.path);
          }
        }
        setExpandedPaths(nextExpanded);
        expandedForShape = nextExpanded;
        didInitializeExpansionRef.current = true;
      }
      patchRows = getVisibleRows(nextShape.rows, expandedForShape).slice(startRow, startRow + visibleCount);
    }

    const patchMap = new Map<string, ValueVisual>();
    const maxPatchRows = Math.min(patchRows.length, MAX_VISIBLE_PATCH_ROWS);
    for (let i = 0; i < maxPatchRows; i++) {
      const row = patchRows[i];
      if (!row) continue;
      const value = readValueAtPath(displayMessage.message, row.path);
      const visual = describeValue(value, maxBinaryPreviewBytes);
      latestValueVisualRef.current.set(row.path, visual);
      const previousText = valueNodeRefs.current.get(row.path)?.textContent ?? null;
      if (previousText !== visual.text) {
        patchMap.set(row.path, visual);
      }
    }
    if (patchMap.size > 0) {
      for (const [path, visual] of patchMap) {
        pendingPatchRef.current.set(path, visual);
      }
      if (patchRafRef.current == null) {
        patchRafRef.current = requestAnimationFrame(() => {
          const frameStarted = performance.now();
          for (const [path, visual] of pendingPatchRef.current) {
            const node = valueNodeRefs.current.get(path);
            if (node) {
              node.textContent = visual.text;
              if (node.dataset.kind !== visual.kind) {
                node.dataset.kind = visual.kind;
                node.style.color = valueColor(visual.kind);
              }
            }
          }
          pendingPatchRef.current.clear();
          patchRafRef.current = null;
          setStats((prev) => ({ ...prev, framePatchMs: performance.now() - frameStarted }));
        });
      }
    }

  }, [
    displayMessage,
    endRow,
    expandedPaths,
    maxBinaryPreviewBytes,
    maxExpandedDepth,
    maxRows,
    setStats,
    shapeSignature,
    startRow,
    visibleCount,
    visibleRows,
  ]);

  useEffect(
    () => () => {
      if (patchRafRef.current != null) {
        cancelAnimationFrame(patchRafRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height && height > 0) {
        setViewportHeight(height);
      }
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setShapeSignature('');
    setShapeRows([]);
    latestValueVisualRef.current.clear();
    valueNodeRefs.current.clear();
    setExpandedPaths(new Set(['message']));
    didInitializeExpansionRef.current = false;
  }, [topic]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const copyField = useCallback(
    async (path: string) => {
      const value = readValueAtPath(displayMessage?.message, path);
      const serialized = serializeForCopy(value, binaryCopyFormat);
      const text =
        typeof serialized === 'string' || typeof serialized === 'number' || typeof serialized === 'boolean'
          ? String(serialized)
          : (JSON.stringify(serialized, null, 2) ?? 'undefined');
      const ok = await copyText(text);
      if (ok) {
        toast.success(formatMessage({ id: 'panels.rawMessages.copy.success' }, { path }));
      } else {
        toast.error(formatMessage({ id: 'panels.rawMessages.copy.error' }));
      }
    },
    [binaryCopyFormat, displayMessage?.message, formatMessage],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b bg-muted px-2 py-1">
        <TopicQuickPicker
          value={topic}
          onChange={(nextTopic) => setConfig((prev) => ({ ...prev, topic: nextTopic }))}
          placeholder={formatMessage({ id: 'panels.framework.topicPicker.placeholder' })}
          className="min-w-0 w-full"
        />
      </div>

      <div
        ref={viewportRef}
        className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[11px]"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {displayMessage && totalRows > 0 ? (
          <div style={{ height: totalRows * ROW_HEIGHT, position: 'relative' }}>
            <div style={{ transform: `translateY(${startRow * ROW_HEIGHT}px)` }}>
              {windowRows.map((row) => (
                <div
                  key={row.id}
                  className="group flex h-[22px] items-center border-b border-border/30"
                  style={{ paddingLeft: row.depth * 14 }}
                >
                  <button
                    type="button"
                    className={`mr-1 inline-flex h-4 w-4 items-center justify-center rounded ${row.expandable ? 'hover:bg-muted' : 'opacity-20'}`}
                    onClick={() => row.expandable && toggleExpand(row.path)}
                  >
                    {row.expandable ? (
                      <ChevronRight
                        className={`size-3 transition-transform ${expandedPaths.has(row.path) ? 'rotate-90' : ''}`}
                      />
                    ) : null}
                  </button>
                  <span className="mr-2 text-cyan-300">{row.key}:</span>
                  <span
                    ref={(node) => {
                      if (node) {
                        valueNodeRefs.current.set(row.path, node);
                        const initial = latestValueVisualRef.current.get(row.path);
                        if (initial != null) {
                          node.textContent = initial.text;
                          node.dataset.kind = initial.kind;
                          node.style.color = valueColor(initial.kind);
                        }
                      } else {
                        valueNodeRefs.current.delete(row.path);
                      }
                    }}
                    className="truncate"
                  />
                  <button
                    type="button"
                    className="ml-2 rounded px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    onClick={() => void copyField(row.path)}
                  >
                    COPY
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs italic text-muted-foreground">
            Waiting for messages...
          </div>
        )}
      </div>
    </div>
  );
};
