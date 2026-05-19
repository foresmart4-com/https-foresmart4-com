// Centralized typed event bus for the fusion engine
import type { FusionEvent } from "./types";

type Handler<E extends FusionEvent = FusionEvent> = (event: E) => void;

class EventBus {
  private handlers = new Set<Handler>();
  private byType = new Map<FusionEvent["type"], Set<Handler>>();
  private recent: FusionEvent[] = [];
  private readonly cap = 500;

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onType<T extends FusionEvent["type"]>(
    type: T,
    handler: (event: Extract<FusionEvent, { type: T }>) => void,
  ): () => void {
    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    set.add(handler as Handler);
    return () => set!.delete(handler as Handler);
  }

  emit(event: FusionEvent): void {
    this.recent.push(event);
    if (this.recent.length > this.cap) this.recent.shift();
    this.handlers.forEach((h) => {
      try { h(event); } catch { /* swallow */ }
    });
    const typed = this.byType.get(event.type);
    typed?.forEach((h) => {
      try { h(event); } catch { /* swallow */ }
    });
  }

  history(): readonly FusionEvent[] {
    return this.recent;
  }

  clear(): void {
    this.recent = [];
  }
}

export const fusionBus = new EventBus();
