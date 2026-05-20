import type { Time } from '@/core/types/ros';

export function fromNano(nsec: bigint): Time {
  const sec = Number(nsec / 1000000000n);
  const n = Number(nsec % 1000000000n);
  return { sec, nsec: n };
}

export function toNano(time: Time): bigint {
  return BigInt(time.sec) * 1000000000n + BigInt(time.nsec);
}

export function addMs(time: Time, ms: number): Time {
  let nsec = time.nsec + Math.round(ms * 1000000);
  let sec = time.sec;
  while (nsec >= 1000000000) {
    sec += 1;
    nsec -= 1000000000;
  }
  return { sec, nsec };
}

/** Subtract a nanosecond delta (may be negative to add time). Clamps at 0. */
export function addNano(time: Time, deltaNs: bigint): Time {
  let n = toNano(time) + deltaNs;
  if (n < 0n) n = 0n;
  return fromNano(n);
}

export function formatTime(time?: Time): string {
  if (!time) return '00:00.000';
  const date = new Date(time.sec * 1000);
  const iso = date.toISOString();
  const ms = Math.floor(time.nsec / 1000000).toString().padStart(3, '0');
  return `${iso.substr(14, 5)}.${ms}`;
}

export function formatLocalTimestamp(time?: Time): string {
  if (!time) return '--';
  const date = new Date(time.sec * 1000 + Math.floor(time.nsec / 1000000));
  const datePart = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  const ms = Math.floor(time.nsec / 1000000)
    .toString()
    .padStart(3, '0');
  return `${datePart} ${timePart}.${ms}`;
}

/** Format a non-negative duration as mm:ss.mmm or h:mm:ss.mmm (same shape as formatRelativeTime). */
export function formatDurationNs(deltaNs: bigint): string {
  let d = deltaNs;
  if (d < 0n) d = 0n;
  const totalMs = Number(d / 1000000n);
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  const mmm = ms.toString().padStart(3, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}.${mmm}`;
  }
  return `${mm}:${ss}.${mmm}`;
}

export function formatRelativeTime(time?: Time, startTime?: Time): string {
  if (!time || !startTime) return '00:00.000';
  let deltaNs = toNano(time) - toNano(startTime);
  if (deltaNs < 0n) deltaNs = 0n;
  return formatDurationNs(deltaNs);
}
