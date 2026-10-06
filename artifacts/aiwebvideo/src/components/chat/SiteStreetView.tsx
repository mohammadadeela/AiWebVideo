import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, Camera, ExternalLink, Hand, ImagePlus, Loader2, LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { getNearbyPhotos, getStreetView, streetViewImageSrc, type NearbyPhoto, type NearbyPhotosInfo, type StreetViewInfo } from "@/lib/api-client";
import { DEFAULT_FOV, DEFAULT_PITCH, isMarked, normalizeHeading, type SiteSelection } from "@/lib/siteTarget";
import { streetViewEmbedUrl } from "@/lib/mapPreview";
import { CaptureError, canCaptureTab, captureElementAsFile, captureFailureMessage } from "@/lib/captureView";
import { TapSurface, TargetKindPicker } from "./SiteTargetControls";

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
export const compassWord = (heading: number) => COMPASS[Math.round((((heading % 360) + 360) % 360) / 45) % 8];

/**
 * Google's own page for looking around a spot. When the exact panorama is known (it is the one shown here) the link opens THAT
 * panorama, facing the same way. A bare coordinate opens a black, endlessly loading viewer wherever Google has no photos of
 * the road, so it is only used when the panorama is known.
 */
export function streetViewLink(latitude: number, longitude: number, view?: { panoId?: string | null; heading?: number | null; pitch?: number; fov?: number }): string {
  const base = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  if (!view?.panoId) return base;
  const heading = Math.round((((view.heading ?? 0) % 360) + 360) % 360);
  const pitch = Math.max(-90, Math.min(90, Math.round(view.pitch ?? 0)));
  const fov = Math.max(10, Math.min(100, Math.round(view.fov ?? 90)));   // Google's viewer allows 10 to 100
  return `${base}&pano=${encodeURIComponent(view.panoId)}&heading=${heading}&pitch=${pitch}&fov=${fov}`;
}

/** The spot on Google Maps: always works, with or without Street View photos. */
export const googleMapsLink = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

const TURN_STEP = 30;
const TILT_STEP = 20;
const ZOOM_STEP = 25;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function CameraButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid h-11 w-10 place-items-center rounded-xl border border-white/[.12] bg-[#1b1530] text-white transition hover:border-white/30 active:scale-95 disabled:opacity-35">
      {children}
    </button>
  );
}

/** Dragging the picture by its full width turns the camera by the picture's field of view, like Google's own viewer. */
const DRAG_START_PX = 6;

/** The three things to do, with the ones already done ticked: nobody has to guess what comes next. */
function Steps({ looked, marked, said, labels = ["Look around", "Tap the exact place", "Say what it is"] }: { looked: boolean; marked: boolean; said: boolean; labels?: [string, string, string] }) {
  const items: Array<[string, boolean]> = [[labels[0], looked], [labels[1], marked], [labels[2], said]];
  return (
    <ol className="flex items-center gap-1.5 px-3 pb-2 pt-3 text-[11px] font-semibold" aria-label="Steps">
      {items.map(([label, done], index) => (
        <li key={label} className={`flex min-w-0 items-center gap-1.5 ${done ? "text-mint" : "text-white/70"}`}>
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] ${done ? "bg-mint text-[#10231f]" : "border border-white/25"}`} aria-hidden="true">{done ? "✓" : index + 1}</span>
          <span className="truncate">{label}</span>
          {index < items.length - 1 && <span className="mx-0.5 text-white/25" aria-hidden="true">›</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Free street photos near the plot, best first (close, facing it, recent, sharp). The customer picks one, taps the exact place on
 * it, and says what it is; the design is made from that very photo plus a copy with the mark. The photographer is credited,
 * as the CC BY-SA license requires.
 */
function NearbyPicker({ photos, value, onChange, latitude, longitude, hasOwnPhotos }: {
  photos: NearbyPhoto[];
  value: SiteSelection;
  onChange: (next: SiteSelection) => void;
  latitude: number;
  longitude: number;
  hasOwnPhotos: boolean;
}) {
  const chosen = value.source === "nearby" && value.nearbyId ? photos.find((photo) => photo.id === value.nearbyId) ?? null : null;
  const marked = isMarked(value) && value.source === "nearby";
  return (
    <div data-testid="nearby-photos">
      <Steps looked={Boolean(chosen)} marked={marked} said={marked && value.kind !== null} labels={["Pick a photo", "Tap the exact place", "Say what it is"]} />
      {!chosen ? (
        <div className="px-3 pb-1">
          <p className="text-[12px] leading-4 text-white/80">Street photos near this spot, best first. Pick the clearest one that shows what you mean.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" role="list" aria-label="Street photos near the plot">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                role="listitem"
                onClick={() => onChange({ ...value, source: "nearby", nearbyId: photo.id, x: null, y: null })}
                aria-label={`Use street photo ${index + 1}, ${Math.round(photo.distanceM)} metres away${photo.facesPlot ? ", facing the plot" : ""}`}
                className="relative overflow-hidden rounded-xl border border-white/[.12] bg-[#0b0818] text-left transition hover:border-mint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint active:scale-[.98]"
              >
                <img src={photo.thumbUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" />
                {index === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-mint px-1.5 py-0.5 text-[10px] font-bold text-[#10231f]">Best match</span>}
                <span className="block bg-black/60 px-2 py-1 text-[10.5px] leading-4 text-white/85">
                  {Math.round(photo.distanceM)} m · {photo.facesPlot ? "faces the plot" : photo.heading !== null ? `looks ${compassWord(photo.heading)}` : "direction unknown"}{photo.dateLabel ? ` · ${photo.dateLabel}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-3 pb-1">
          <TapSurface
            className="block w-full overflow-hidden rounded-lg bg-[#05030f]"
            selection={value}
            active
            label="Tap the exact place on the street photo"
            onTap={(x, y) => onChange({ ...value, source: "nearby", x, y })}
            onClear={() => onChange({ ...value, x: null, y: null })}
          >
            <img src={chosen.previewUrl} alt={`Street photo near the plot${chosen.heading !== null ? `, looking ${compassWord(chosen.heading)}` : ""}`} referrerPolicy="no-referrer" draggable={false} className="block h-auto w-full" />
          </TapSurface>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[11px] leading-4 text-white/60">
              Photo{chosen.credit ? ` by ${chosen.credit}` : ""} · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer" className="font-semibold text-mint hover:underline">CC BY-SA 4.0</a> · <a href={`https://www.mapillary.com/app/?lat=${latitude.toFixed(6)}&lng=${longitude.toFixed(6)}&z=18`} target="_blank" rel="noreferrer" className="font-semibold text-mint hover:underline">Mapillary</a>{chosen.dateLabel ? ` · ${chosen.dateLabel}` : ""}
            </p>
            <button type="button" onClick={() => onChange({ ...value, source: "street", nearbyId: null, x: null, y: null })} className="inline-flex min-h-11 items-center text-[12px] font-semibold text-mint hover:underline">Choose another photo</button>
          </div>
          {chosen.dateLabel && /\b(19|20)\d\d\b/.test(chosen.dateLabel) && new Date().getFullYear() - Number(/\b((?:19|20)\d\d)\b/.exec(chosen.dateLabel)![1]) >= 4 && (
            <p className="mt-1 text-[11.5px] leading-4 text-amber-200">This photo is from {chosen.dateLabel}, so newer buildings may be missing. Pick a newer one or add your own photo.</p>
          )}
        </div>
      )}
      <p className="px-3 pt-1.5 text-[11px] leading-4 text-white/50">These photos come from Mapillary volunteers and can be old. Your own recent photo (the + button) always wins.</p>
      {hasOwnPhotos && (
        <p className="px-3 pt-1 text-[11.5px]">
          <button type="button" onClick={() => onChange({ ...value, source: "photo", photo: 0, x: null, y: null })} className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-mint hover:underline">
            <ImagePlus size={13} aria-hidden="true" /> Mark it on my own photo instead
          </button>
        </p>
      )}
      <details className="px-3 pb-1 pt-2 text-[11.5px] text-white/70">
        <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold text-mint">Look around in Google Street View (360°, view only)</summary>
        <div className="mt-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-[#05030f]">
          <iframe title="Google Street View of the street, 360 degrees. Drag to look around." src={streetViewEmbedUrl(latitude, longitude)} loading="lazy" allowFullScreen referrerPolicy="no-referrer" className="h-full w-full border-0" />
        </div>
      </details>
    </div>
  );
}

/**
 * The place a building will stand, as a person would point at it. Google Street View (the real street in front of the plot) is
 * the main picture and the map sits in the corner. The customer looks around (turn, up or down for other floors, zoom), taps
 * the exact shop, floor, building or empty plot, and says what it is. The design is made from exactly this view, plus a copy
 * with the tapped spot marked. Without Street View they can tap on their own photo or screenshot instead.
 */
export function SiteStreetView({ latitude, longitude, mapSrc, value, onChange, photos, onAddPhoto, onCapture }: {
  latitude: number;
  longitude: number;
  mapSrc: string;
  value: SiteSelection;
  onChange: (next: SiteSelection) => void;
  /** The customer's own photos, which they can tap on too. */
  photos: File[];
  /** Opens the page's photo picker (used when Street View pictures are not offered by the server). */
  onAddPhoto?: () => void;
  /** Receives the picture taken by "Capture this view" (the page adds it to the customer's photos). */
  onCapture?: (file: File) => void;
}) {
  const [info, setInfo] = useState<StreetViewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pictureFailed, setPictureFailed] = useState(false);
  const [pictureLoading, setPictureLoading] = useState(true);
  const [mapIsMain, setMapIsMain] = useState(false);
  const [nearby, setNearby] = useState<NearbyPhotosInfo | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  // "Capture this view": one picture of Google's 360° frame, taken by the browser's tab capture.
  const captureFrameRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureNote, setCaptureNote] = useState<{ ok: boolean; text: string } | null>(null);
  const canCapture = useMemo(() => Boolean(onCapture) && canCaptureTab(), [onCapture]);
  const justCapturedRef = useRef(false);
  // The picture on screen stays until the next one has fully loaded, so turning never flashes empty.
  const [shownSrc, setShownSrc] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; heading: number; pitch: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);

  const photoUrls = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => () => photoUrls.forEach((url) => URL.revokeObjectURL(url)), [photoUrls]);

  useEffect(() => {
    const controller = new AbortController();
    setInfo(null);
    setLoading(true);
    setPictureFailed(false);
    setMapIsMain(false);
    setNearby(null);
    // Free street photos are looked for only when Google Street View cannot be shown for this spot.
    const loadNearby = () => {
      setNearbyLoading(true);
      getNearbyPhotos(latitude, longitude, controller.signal)
        .then((found) => { if (!controller.signal.aborted) setNearby(found); })
        .catch(() => { if (!controller.signal.aborted) setNearby({ enabled: false, photos: [] }); })
        .finally(() => { if (!controller.signal.aborted) setNearbyLoading(false); });
    };
    getStreetView(latitude, longitude, controller.signal)
      .then((found) => { if (controller.signal.aborted) return; setInfo(found); if (!found.available) loadNearby(); })
      .catch(() => { if (controller.signal.aborted) return; setInfo({ enabled: false, available: false }); loadNearby(); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [latitude, longitude]);

  async function captureThisView() {
    const frame = captureFrameRef.current;
    if (!frame || !onCapture || capturing) return;
    setCaptureNote(null);
    setCapturing(true);   // hides the "drag to look around" label so it is not part of the picture
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const file = await captureElementAsFile(frame, `street-view-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`);
      justCapturedRef.current = true;
      // Mark on the new picture straight away: it is the next photo in the list.
      onChange({ ...value, source: "photo", photo: Math.min(photos.length, 9), x: null, y: null });
      onCapture(file);
      setCaptureNote({ ok: true, text: "View captured. Now tap the exact place on the picture below." });
    } catch (error) {
      justCapturedRef.current = false;
      setCaptureNote({ ok: false, text: captureFailureMessage(error instanceof CaptureError ? error.reason : "failed") });
    } finally {
      setCapturing(false);
    }
  }

  // After a capture, bring the picture to tap on into view so the next step is obvious.
  useEffect(() => {
    if (!justCapturedRef.current || photos.length === 0) return;
    justCapturedRef.current = false;
    const timer = window.setTimeout(() => pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 120);
    return () => window.clearTimeout(timer);
  }, [photos.length]);

  const available = Boolean(info?.available && info.panoId) && !pictureFailed;
  const photoMode = value.source === "photo" && photos.length > 0;
  const facing = value.heading ?? info?.headingToPlot ?? 0;
  const src = available && info?.panoId ? streetViewImageSrc(info.panoId, { heading: facing, pitch: value.pitch, fov: value.fov }) : null;
  useEffect(() => {
    if (!src) { setShownSrc(null); return; }
    setPictureLoading(true);
    const preload = new Image();
    preload.onload = () => { setShownSrc(src); setPictureLoading(false); };
    preload.onerror = () => setPictureFailed(true);
    preload.src = src;
    return () => { preload.onload = null; preload.onerror = null; };
  }, [src]);

  // A photo that was removed cannot stay marked.
  useEffect(() => {
    if (value.source === "photo" && (photos.length === 0 || value.photo >= photos.length)) onChange({ ...value, source: "street", photo: 0, x: null, y: null });
  }, [photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Moving the camera makes an earlier mark point at the wrong place, so it is cleared. */
  const camera = (patch: Partial<SiteSelection>) => onChange({ ...value, ...patch, source: "street", x: null, y: null });
  const cameraTouched = value.heading !== null || value.pitch !== DEFAULT_PITCH || value.fov !== DEFAULT_FOV;
  const marked = isMarked(value);
  const tappedWithoutKind = marked && value.kind === null;
  const old = typeof info?.ageYears === "number" && info.ageYears >= 4;

  const tapStreet = (x: number, y: number) => onChange({ ...value, source: "street", x, y });
  const tapPhoto = (x: number, y: number) => onChange({ ...value, source: "photo", x, y });
  const clearMark = () => onChange({ ...value, x: null, y: null });
  const fovNow = value.fov ?? DEFAULT_FOV;

  /** Drag to look around: the picture follows the finger at once, and the real view is fetched when it is let go. */
  const dragEnabled = !mapIsMain && available && !photoMode;
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragEnabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    dragRef.current = { x: event.clientX, y: event.clientY, heading: facing, pitch: value.pitch, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
    start.moved = true;
    setDrag({ dx, dy });
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>, apply: boolean) => {
    const start = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!start?.moved) return;
    justDraggedRef.current = true;
    window.setTimeout(() => { justDraggedRef.current = false; }, 120);   // the click that ends a drag is not a tap
    if (!apply) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    const degreesPerPixelX = fovNow / Math.max(1, rect.width);
    const degreesPerPixelY = (fovNow * 0.75) / Math.max(1, rect.height);
    camera({ heading: normalizeHeading(start.heading - dx * degreesPerPixelX), pitch: clamp(Math.round(start.pitch + dy * degreesPerPixelY), -20, 70) });
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!dragEnabled) return;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => camera({ heading: normalizeHeading(facing - TURN_STEP) }),
      ArrowRight: () => camera({ heading: normalizeHeading(facing + TURN_STEP) }),
      ArrowUp: () => camera({ pitch: clamp(value.pitch + TILT_STEP, -20, 70) }),
      ArrowDown: () => camera({ pitch: clamp(value.pitch - TILT_STEP, -20, 70) }),
      "+": () => camera({ fov: clamp(fovNow - ZOOM_STEP, 30, 110) }),
      "-": () => camera({ fov: clamp(fovNow + ZOOM_STEP, 30, 110) }),
    };
    const act = keys[event.key];
    if (act) { event.preventDefault(); act(); }
  };
  const showPhotoPicker = photos.length > 0 && (!available || photoMode) && value.source !== "nearby";

  const insetClass = "absolute bottom-2 left-2 z-20 h-[78px] w-[104px] overflow-hidden rounded-lg border-2 border-white/85 shadow-[0_6px_18px_rgba(0,0,0,.55)] sm:h-[88px] sm:w-[118px]";
  const mapLayer = mapIsMain ? "absolute inset-0" : `${insetClass} pointer-events-none`;
  const streetLayer = mapIsMain ? insetClass : "absolute inset-0";

  return (
    <div data-testid="site-streetview">
      {(loading || available) ? (
        <div>
          {mapIsMain ? (
            <p className="px-3 pb-2 pt-3 text-[12px] leading-4 text-white/80">Showing the map. Tap the small Street View picture to go back and mark your place.</p>
          ) : (
            <Steps looked={cameraTouched || marked} marked={marked} said={marked && value.kind !== null} />
          )}
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#05030f]">
            <div className={mapLayer}>
              <iframe title="The exact spot on the map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full border-0" />
            </div>

            <div className={streetLayer}>
              <div
                className={`relative h-full w-full touch-none select-none overflow-hidden ${dragEnabled ? (drag ? "cursor-grabbing" : "cursor-grab") : ""}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endDrag(event, true)}
                onPointerCancel={(event) => endDrag(event, false)}
                onClickCapture={(event) => { if (justDraggedRef.current) { event.stopPropagation(); event.preventDefault(); } }}
                onKeyDown={onKeyDown}
              >
                <TapSurface className="h-full w-full" selection={value} active={dragEnabled} label="Tap the exact place on the street picture. Arrow keys look around." onTap={tapStreet} onClear={clearMark}>
                  {shownSrc && (
                    <img
                      src={shownSrc}
                      alt={`Google Street View of the street, looking ${compassWord(facing)}`}
                      draggable={false}
                      onError={() => setPictureFailed(true)}
                      className="block h-full w-full object-cover will-change-transform"
                      style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
                    />
                  )}
                </TapSurface>
              </div>
              {(loading || (pictureLoading && !shownSrc)) && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-[#0b0818]/70" role="status" aria-label="Loading Street View">
                  <Loader2 size={mapIsMain ? 14 : 22} className="animate-spin text-white/80" aria-hidden="true" />
                </div>
              )}
              {pictureLoading && shownSrc && !mapIsMain && (
                <span className="pointer-events-none absolute bottom-2 right-2 z-20 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10.5px] font-semibold text-white" role="status">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Turning
                </span>
              )}
              {dragEnabled && !cameraTouched && !marked && (
                <span className="pointer-events-none absolute bottom-2 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11.5px] font-semibold text-white sm:inline-flex">
                  <Hand size={13} aria-hidden="true" /> Drag to look around · tap to mark
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMapIsMain((current) => !current)}
              aria-label={mapIsMain ? "Show Street View large" : "Show the map large"}
              className={`${insetClass} z-30 bg-transparent`}
            >
              <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">{mapIsMain ? "Street View" : "Map"}</span>
            </button>

            {available && (
              <>
                <p className="pointer-events-none absolute left-2 top-2 z-20 max-w-[62%] rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold leading-4 text-white">
                  Google Street View{info?.dateLabel ? ` · ${info.dateLabel}` : ""}
                </p>
                <p className="pointer-events-none absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                  <Compass size={12} aria-hidden="true" /> {compassWord(facing)}{value.pitch >= 12 ? ` · up ${value.pitch}°` : value.pitch <= -8 ? ` · down ${Math.abs(value.pitch)}°` : ""}
                </p>
                <p className="pointer-events-none absolute bottom-1 right-14 z-20 hidden text-[10px] text-white/80 sm:block">© Google</p>
              </>
            )}
          </div>

          {available && (
            <div className="px-3 pt-2.5">
              <div role="group" aria-label="Street View camera" className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1">
                    <CameraButton label="Turn the camera left" onClick={() => camera({ heading: normalizeHeading(facing - TURN_STEP) })}><ChevronLeft size={20} aria-hidden="true" /></CameraButton>
                    <CameraButton label="Turn the camera right" onClick={() => camera({ heading: normalizeHeading(facing + TURN_STEP) })}><ChevronRight size={20} aria-hidden="true" /></CameraButton>
                  </div>
                  <span className="text-[10.5px] font-medium text-white/50">Turn</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1">
                    <CameraButton label="Look up at the upper floors" onClick={() => camera({ pitch: clamp(value.pitch + TILT_STEP, -20, 70) })} disabled={value.pitch >= 70}><ChevronUp size={20} aria-hidden="true" /></CameraButton>
                    <CameraButton label="Look down" onClick={() => camera({ pitch: clamp(value.pitch - TILT_STEP, -20, 70) })} disabled={value.pitch <= -20}><ChevronDown size={20} aria-hidden="true" /></CameraButton>
                  </div>
                  <span className="text-[10.5px] font-medium text-white/50">Look up / down</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1">
                    <CameraButton label="Zoom in" onClick={() => camera({ fov: clamp(value.fov - ZOOM_STEP, 30, 110) })} disabled={value.fov <= 30}><ZoomIn size={19} aria-hidden="true" /></CameraButton>
                    <CameraButton label="Zoom out" onClick={() => camera({ fov: clamp(value.fov + ZOOM_STEP, 30, 110) })} disabled={value.fov >= 110}><ZoomOut size={19} aria-hidden="true" /></CameraButton>
                  </div>
                  <span className="text-[10.5px] font-medium text-white/50">Zoom</span>
                </div>
              </div>
              {cameraTouched && (
                <button type="button" onClick={() => camera({ heading: null, pitch: DEFAULT_PITCH, fov: DEFAULT_FOV })} className="mt-1 inline-flex min-h-11 items-center gap-1 text-[11.5px] font-semibold text-mint hover:underline">
                  <LocateFixed size={12} aria-hidden="true" /> Face the plot again
                </button>
              )}
              {old && (
                <p className="mt-2 text-[11.5px] leading-4 text-amber-200">
                  This photo is from {info?.dateLabel}, so newer buildings may be missing. If the street has changed, add a recent photo with the + button: yours wins.
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <iframe title="The exact spot on the map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full border-0" />

          {nearbyLoading ? (
            <p role="status" className="flex items-center gap-2 px-3 py-3 text-[11.5px] text-white/65"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Looking for street photos near this spot…</p>
          ) : (nearby?.photos.length ?? 0) > 0 ? (
            <NearbyPicker photos={nearby!.photos} value={value} onChange={onChange} latitude={latitude} longitude={longitude} hasOwnPhotos={photos.length > 0} />
          ) : info?.enabled ? (
            // The server checked: Google has no street photos near this plot.
            <div className="space-y-1.5 px-3 pt-2 text-[11.5px] leading-4 text-white/60">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>There are no Street View photos close to this spot.</span>
                <a href={googleMapsLink(latitude, longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-mint hover:underline">
                  Open in Google Maps <ExternalLink size={11} aria-hidden="true" />
                </a>
              </p>
              <p>Street View only exists on roads Google has photographed. A screenshot or photo of the plot works just as well.</p>
              {photos.length === 0 && onAddPhoto && (
                <button type="button" onClick={onAddPhoto} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-blue-500 px-4 text-[13px] font-bold text-white transition active:scale-[.98]">
                  <ImagePlus size={16} aria-hidden="true" /> Add a photo of the plot
                </button>
              )}
            </div>
          ) : (
            // Street View pictures are not switched on in this site, so Google's own 360° viewer is shown right under the map.
            <div data-testid="street-view-embed">
              <Steps looked={photos.length > 0} marked={photos.length > 0} said={marked && value.source === "photo"} labels={["Look around in 360°", canCapture ? "Capture the view" : "Add a screenshot of the view", "Tap the exact place"]} />
              <div ref={captureFrameRef} className="relative aspect-[4/3] w-full overflow-hidden bg-[#05030f]">
                <iframe
                  title="Google Street View of the street, 360 degrees. Drag to look around."
                  src={streetViewEmbedUrl(latitude, longitude)}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 h-full w-full border-0"
                />
                {!capturing && <p className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">Google Street View · drag to look around</p>}
              </div>
              <div className="space-y-2 px-3 pt-2.5 text-[11.5px] leading-4 text-white/65">
                {canCapture ? (
                  <p>
                    Turn to the exact shop, floor or plot you mean, then press <span className="font-semibold text-white">Capture this view</span>.
                    Your browser asks once to share this tab: allow it. One picture is taken and sharing stops at once. Then tap exactly what you mean on it.
                  </p>
                ) : (
                  <p>
                    Turn to the exact shop, floor or plot you mean, then <span className="font-semibold text-white">take a screenshot of that view</span>
                    {" "}(Windows: Win + Shift + S · Mac: Shift + Command + 4 · phone: the screenshot buttons) and add it. Then tap exactly what you mean on it. The design is made from your screenshot.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {canCapture && (
                    <button
                      type="button"
                      onClick={() => void captureThisView()}
                      disabled={capturing}
                      data-testid="capture-view"
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-blue-500 px-4 text-[13px] font-bold text-white transition active:scale-[.98] disabled:opacity-70"
                    >
                      {capturing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Camera size={16} aria-hidden="true" />}
                      {capturing ? "Capturing…" : photos.length ? "Capture this view again" : "Capture this view"}
                    </button>
                  )}
                  {onAddPhoto && (
                    <button type="button" onClick={onAddPhoto} className={canCapture ? "inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3.5 text-[12.5px] font-semibold text-white/85 transition hover:border-white/40 active:scale-[.98]" : "inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-blue-500 px-4 text-[13px] font-bold text-white transition active:scale-[.98]"}>
                      <ImagePlus size={16} aria-hidden="true" /> {canCapture ? "Add my own screenshot" : photos.length ? "Add another screenshot" : "Add my screenshot"}
                    </button>
                  )}
                  <span className="text-[11.5px] text-white/55">or paste it (Ctrl/Cmd + V)</span>
                  <a href={googleMapsLink(latitude, longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 font-semibold text-mint hover:underline">
                    Bigger in Google Maps <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </div>
                {captureNote && (
                  <p role={captureNote.ok ? "status" : "alert"} data-testid="capture-note" className={`rounded-lg border px-2.5 py-2 ${captureNote.ok ? "border-mint/40 bg-mint/[.08] text-mint" : "border-[#f5b942]/50 bg-[#2a2110] text-amber-100"}`}>{captureNote.text}</p>
                )}
                {nearby?.reason && (
                  <p role="note" className="rounded-lg border border-[#f5b942]/50 bg-[#2a2110] px-2.5 py-2 text-amber-100">
                    Only you see this: free street photos are off ({nearby.reason}). Create a free token at mapillary.com/dashboard/developers, set <span className="font-mono">MAPILLARY_ACCESS_TOKEN</span>, then restart the server. Customers will then pick from nearby street photos here.
                  </p>
                )}
                {info?.reason && nearby?.enabled && (
                  <p role="note" className="rounded-lg border border-[#f5b942]/50 bg-[#2a2110] px-2.5 py-2 text-amber-100">
                    Only you see this: Mapillary is on, but it has no usable photos within about 90 m of this spot, so customers add a screenshot here. Google Street View is optional and stays off. Coverage depends on volunteers: check this place at mapillary.com/app.
                  </p>
                )}
                {info?.reason && !nearby?.enabled && !nearbyLoading && (
                  <p role="note" className="rounded-lg border border-[#f5b942]/50 bg-[#2a2110] px-2.5 py-2 text-amber-100">
                    Only you see this: no street pictures are switched on ({info.reason}). Free option: set <span className="font-mono">MAPILLARY_ACCESS_TOKEN</span>. Paid option: <span className="font-mono">GOOGLE_MAPS_API_KEY</span> with <span className="font-mono">ARCHITECTURE_MAPS_IMAGERY=1</span>. Then restart the server.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showPhotoPicker && (
        <div ref={pickerRef} className="px-3 pt-3" data-testid="photo-target">
          <p className="text-[12px] font-semibold text-white">Tap the exact place on your photo</p>
          {photos.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Which photo">
              {photoUrls.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  role="radio"
                  aria-checked={value.photo === index}
                  aria-label={`Photo ${index + 1}`}
                  onClick={() => onChange({ ...value, source: "photo", photo: index, x: null, y: null })}
                  className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${value.photo === index ? "border-mint" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="mt-2">
            <TapSurface className="inline-block max-w-full" selection={{ ...value, source: "photo" }} active label="Tap the exact place on your photo" onTap={tapPhoto} onClear={clearMark}>
              <img src={photoUrls[Math.min(value.photo, photoUrls.length - 1)]} alt="Your photo of the site" className="block max-h-72 w-auto max-w-full rounded-lg" />
            </TapSurface>
          </div>
        </div>
      )}

      {available && photos.length > 0 && (
        <p className="px-3 pt-2.5 text-[11.5px]">
          <button
            type="button"
            onClick={() => onChange({ ...value, source: photoMode ? "street" : "photo", photo: 0, x: null, y: null })}
            className="inline-flex min-h-9 items-center gap-1.5 font-semibold text-mint hover:underline"
          >
            <ImagePlus size={13} aria-hidden="true" /> {photoMode ? "Mark it on Street View instead" : "Mark it on my own photo instead"}
          </button>
        </p>
      )}

      <div className="px-3 pb-1 pt-3">
        <TargetKindPicker value={value} onChange={onChange} attention={tappedWithoutKind} />
      </div>

      {available && (
        <div className="space-y-1.5 px-3 pb-1 pt-1 text-[11px] leading-4 text-white/55">
          <p>The design is made from this view and the two beside it, plus a copy with your mark. The real street, neighbours and heights stay as they are.</p>
          <p>
            <a href={streetViewLink(latitude, longitude, { panoId: info?.panoId, heading: facing, pitch: value.pitch, fov: value.fov })} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-mint hover:underline">
              Look around in Google Street View <ExternalLink size={11} aria-hidden="true" />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
