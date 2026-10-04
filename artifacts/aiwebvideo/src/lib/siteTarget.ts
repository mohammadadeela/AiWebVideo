/**
 * What the customer points at on the site: the whole building, one shop or unit, one floor, or empty land, and WHERE on a
 * picture (Street View or one of their own photos). The server turns this into instructions for the AI and draws the same box
 * on a copy of the picture, so the sizes below mirror the server's (api-server/src/lib/target-marker.ts); a test keeps them equal.
 */
export type TargetKind = "building" | "unit" | "floor" | "land";
export type TargetLevel = "basement" | "ground" | "1" | "2" | "3" | "4" | "5" | "6+" | "roof";

export interface SiteSelection {
  /** Street View camera. heading null = face the plot (the default). */
  heading: number | null;
  pitch: number;
  fov: number;
  kind: TargetKind | null;
  level: TargetLevel;
  /** Where the customer tapped, 0-1 from the left / top; null = not marked. */
  x: number | null;
  y: number | null;
  /** Tapped on the Street View frame, on one of their own photos (which one), or on a nearby street photo they picked. */
  source: "street" | "photo" | "nearby";
  photo: number;
  /** The nearby street photo (Mapillary id) picked to design from; null = none. */
  nearbyId: string | null;
}

export const DEFAULT_PITCH = 5;
export const DEFAULT_FOV = 90;
export const EMPTY_SELECTION: SiteSelection = { heading: null, pitch: DEFAULT_PITCH, fov: DEFAULT_FOV, kind: null, level: "ground", x: null, y: null, source: "street", photo: 0, nearbyId: null };

export const TARGET_OPTIONS: ReadonlyArray<{ id: TargetKind; label: string; hint: string }> = [
  { id: "building", label: "Whole building", hint: "Every floor and the roof" },
  { id: "unit", label: "One shop or unit", hint: "Just that shop or flat" },
  { id: "floor", label: "One floor", hint: "An upper or lower level" },
  { id: "land", label: "Empty land", hint: "Build something new" },
];

export const LEVEL_OPTIONS: ReadonlyArray<{ id: TargetLevel; label: string }> = [
  { id: "basement", label: "Basement" },
  { id: "ground", label: "Ground" },
  { id: "1", label: "1st" },
  { id: "2", label: "2nd" },
  { id: "3", label: "3rd" },
  { id: "4", label: "4th" },
  { id: "5", label: "5th" },
  { id: "6+", label: "6th+" },
  { id: "roof", label: "Roof" },
];

/** The box the server draws for each kind, as a fraction of the picture (width, height). Keep equal to the server. */
export const MARKER_BOX: Record<TargetKind, { w: number; h: number }> = {
  building: { w: 0.34, h: 0.4 },
  unit: { w: 0.2, h: 0.24 },
  floor: { w: 0.56, h: 0.13 },
  land: { w: 0.42, h: 0.16 },
};

/** Where the box sits on the picture, kept inside it, exactly as the server draws it. */
export function markerRect(kind: TargetKind | null, x: number, y: number) {
  const { w, h } = MARKER_BOX[kind ?? "unit"];
  return {
    left: Math.max(0, Math.min(x - w / 2, 1 - w)),
    top: Math.max(0, Math.min(y - h / 2, 1 - h)),
    width: w,
    height: h,
  };
}

export const needsLevel = (kind: TargetKind | null) => kind === "unit" || kind === "floor";
export const isMarked = (selection: SiteSelection) => selection.x !== null && selection.y !== null;
export const normalizeHeading = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360;

/** The flat fields of the architecture request (the server checks every one of them again). */
export function selectionToRequest(selection: SiteSelection): Record<string, string | number | boolean | undefined> {
  const marked = isMarked(selection) && selection.kind !== null;
  const cameraTouched = selection.heading !== null || selection.pitch !== DEFAULT_PITCH || selection.fov !== DEFAULT_FOV;
  const sendCamera = selection.source === "street" && (marked || cameraTouched);
  return {
    streetViewHeading: sendCamera && selection.heading !== null ? selection.heading : undefined,
    streetViewPitch: sendCamera ? selection.pitch : undefined,
    streetViewFov: sendCamera ? selection.fov : undefined,
    targetKind: selection.kind ?? undefined,
    targetLevel: selection.kind && needsLevel(selection.kind) ? selection.level : undefined,
    targetX: marked ? Math.round(selection.x! * 10_000) / 10_000 : undefined,
    targetY: marked ? Math.round(selection.y! * 10_000) / 10_000 : undefined,
    targetSource: marked ? selection.source : undefined,
    targetPhoto: marked && selection.source === "photo" ? selection.photo : undefined,
    // a picked nearby photo is used as a reference even before anything is tapped on it
    nearbyPhotoId: selection.source === "nearby" && selection.nearbyId ? selection.nearbyId : undefined,
  };
}
