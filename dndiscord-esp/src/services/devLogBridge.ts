import { getApiUrl } from "./config";

/**
 * Dev-only: wraps console.log/warn/error/info/debug and POSTs each call
 * (batched, debounced) to the back's /api/dev/log endpoint, which appends to
 * logs/front-YYYY-MM-DD.log. Lets Claude Read the front log directly instead
 * of asking the user to paste. Init from index.tsx, gated on import.meta.env.DEV.
 */

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

interface QueuedEntry {
  level: LogLevel;
  message: string;
  ts: string;
}

const FLUSH_INTERVAL_MS = 500;
const MAX_BATCH = 100;
const MAX_QUEUE = 2000;

let initialised = false;
const queue: QueuedEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

function safeStringify(value: unknown): string {
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value, (_k, v) => {
      if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
      return v;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserialisable]";
    }
  }
}

function formatArgs(args: unknown[]): string {
  return args.map(safeStringify).join(" ");
}

async function flush() {
  if (inFlight || queue.length === 0) return;
  inFlight = true;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await fetch(`${getApiUrl()}/api/dev/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: batch }),
      keepalive: true,
    });
  } catch {
    // Swallow — we never want the bridge to surface its own errors (would recurse).
  } finally {
    inFlight = false;
    if (queue.length > 0) scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

function enqueue(level: LogLevel, args: unknown[]) {
  if (queue.length >= MAX_QUEUE) return;
  queue.push({ level, message: formatArgs(args), ts: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
  } else {
    scheduleFlush();
  }
}

export function initDevLogBridge() {
  if (initialised) return;
  initialised = true;

  const native = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  (["log", "info", "warn", "error", "debug"] as LogLevel[]).forEach((level) => {
    const original = native[level];
    console[level] = (...args: unknown[]) => {
      original(...args);
      enqueue(level, args);
    };
  });

  window.addEventListener("error", (ev) => {
    enqueue("error", [`window.error: ${ev.message}`, ev.filename, ev.lineno, ev.colno, ev.error]);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    enqueue("error", [`unhandledrejection:`, ev.reason]);
  });
  window.addEventListener("beforeunload", () => {
    if (queue.length === 0) return;
    try {
      const payload = JSON.stringify({ entries: queue.splice(0) });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(`${getApiUrl()}/api/dev/log`, blob);
    } catch {
      /* best effort */
    }
  });
}
