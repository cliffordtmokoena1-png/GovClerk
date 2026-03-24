type TimerEvent =
  | "dashboard_get_serverside_props"
  | "get_customer_details"
  | "get_current_balance"
  | "get_auth"
  | "get_transcript_status"
  | "get_sidebar_items"
  | "promise_all"
  | "on_drop"
  | "on_drop_upload";

class Timer {
  spans: Map<string, [number, number | undefined]> = new Map();

  // Overwrites event start if it already exists
  start(event: TimerEvent) {
    const start = performance.now();
    this.spans.delete(event);
    this.spans.set(event, [start, undefined]);
  }

  // Overwrites event stop if it already exists
  // Returns the duration
  stop(event: TimerEvent): number | undefined {
    const stop = performance.now();
    const span = this.spans.get(event);
    if (span) {
      span[1] = stop;
      return Math.round(span[1] - span[0]);
    }
    return undefined;
  }

  get(event: TimerEvent): number | undefined {
    const span = this.spans.get(event);
    if (span == null || span[1] == null) {
      return undefined;
    }
    return Math.round(span[1] - span[0]);
  }
}

const GLOBAL_TIMER = new Timer();

export function getTimer(options?: { clearTimer?: boolean }): Timer {
  if (options?.clearTimer) {
    GLOBAL_TIMER.spans.clear();
  }
  return GLOBAL_TIMER;
}
