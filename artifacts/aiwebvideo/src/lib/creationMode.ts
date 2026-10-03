import { useSyncExternalStore } from "react";
import type { CreationIntent } from "./creationFeatures";

/**
 * Which feature the creator is on right now, shared between the chat box and the navbar menu. The chat box
 * publishes its mode; anything else can read it, ask for a different one, or ask for the feature menu to open.
 */
export const CREATION_INTENT_EVENT = "aiwebvideo:creation-intent";
export const OPEN_FEATURE_MENU_EVENT = "aiwebvideo:open-feature-menu";

let current: CreationIntent = "website";
const listeners = new Set<() => void>();

export function getCreationMode(): CreationIntent { return current; }

export function publishCreationMode(mode: CreationIntent) {
  if (mode === current) return;
  current = mode;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useCreationMode(): CreationIntent {
  return useSyncExternalStore(subscribe, getCreationMode, getCreationMode);
}

/** Ask the chat box to switch feature (works from anywhere on the page). */
export function requestCreationMode(intent: CreationIntent) {
  window.dispatchEvent(new CustomEvent<CreationIntent>(CREATION_INTENT_EVENT, { detail: intent }));
}

export function requestOpenFeatureMenu() {
  window.dispatchEvent(new Event(OPEN_FEATURE_MENU_EVENT));
}
