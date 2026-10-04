import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Compass, ExternalLink, ImagePlus, Loader2, LocateFixed, ZoomIn, ZoomOut } from "lucide-react";
import { getStreetView, streetViewImageSrc, type StreetViewInfo } from "@/lib/api-client";
import { DEFAULT_FOV, DEFAULT_PITCH, isMarked, normalizeHeading, type SiteSelection } from "@/lib/siteTarget";
import { TapSurface, TargetKindPicker } from "./SiteTargetControls";

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
export const compassWord = (heading: number) => COMPASS[Math.round((((heading % 360) + 360) % 360) / 45) % 8];

/** Google's own page for looking around a spot: works without any key, and is the way in when our pictures are off. */
export const streetViewLink = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

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

/**
 * The place a building will stand, as a person would point at it. Google Street View (the real street in front of the plot) is
 * the main picture and the map sits in the corner. The customer looks around (turn, up or down for other floors, zoom), taps
 * the exact shop, floor, building or empty plot, and says what it is. The design is made from exactly this view, plus a copy
 * with the tapped spot marked. Without Street View they can tap on their own photo or screenshot instead.
 */
export function SiteStreetView({ latitude, longitude, mapSrc, value, onChange, photos }: {
  latitude: number;
  longitude: number;
  mapSrc: string;
  value: SiteSelection;
  onChange: (next: SiteSelection) => void;
  /** The customer's own photos, which they can tap on too. */
  photos: File[];
}) {
  const [info, setInfo] = useState<StreetViewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pictureFailed, setPictureFailed] = useState(false);
  const [pictureLoading, setPictureLoading] = useState(true);
  const [mapIsMain, setMapIsMain] = useState(false);

  const photoUrls = useMemo(() => photos.map((file) => URL.createObjectURL(file)), [photos]);
  useEffect(() => () => photoUrls.forEach((url) => URL.revokeObjectURL(url)), [photoUrls]);

  useEffect(() => {
    const controller = new AbortController();
    setInfo(null);
    setLoading(true);
    setPictureFailed(false);
    setMapIsMain(false);
    getStreetView(latitude, longitude, controller.signal)
      .then((found) => { if (!controller.signal.aborted) setInfo(found); })
      .catch(() => { if (!controller.signal.aborted) setInfo({ enabled: false, available: false }); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [latitude, longitude]);

  const available = Boolean(info?.available && info.panoId) && !pictureFailed;
  const photoMode = value.source === "photo" && photos.length > 0;
  const facing = value.heading ?? info?.headingToPlot ?? 0;
  const src = available && info?.panoId ? streetViewImageSrc(info.panoId, { heading: facing, pitch: value.pitch, fov: value.fov }) : null;
  useEffect(() => { setPictureLoading(true); }, [src]);

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
  const showPhotoPicker = photos.length > 0 && (!available || photoMode);

  const insetClass = "absolute bottom-2 left-2 z-20 h-[78px] w-[104px] overflow-hidden rounded-lg border-2 border-white/85 shadow-[0_6px_18px_rgba(0,0,0,.55)] sm:h-[88px] sm:w-[118px]";
  const mapLayer = mapIsMain ? "absolute inset-0" : `${insetClass} pointer-events-none`;
  const streetLayer = mapIsMain ? insetClass : "absolute inset-0";

  return (
    <div data-testid="site-streetview">
      {(loading || available) ? (
        <div>
          <p className="px-3 pb-2 pt-3 text-[12px] leading-4 text-white/80">
            {mapIsMain ? "Showing the map. Tap the small Street View picture to go back and mark your place." : "Look around, then tap the exact shop, floor or empty plot you mean."}
          </p>
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#05030f]">
            <div className={mapLayer}>
              <iframe title="The exact spot on the map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full border-0" />
            </div>

            <div className={streetLayer}>
              <TapSurface className="h-full w-full" selection={value} active={!mapIsMain && available && !photoMode} label="Tap the exact place on the street picture" onTap={tapStreet} onClear={clearMark}>
                {src && (
                  <img
                    key={src}
                    src={src}
                    alt={`Google Street View of the street, looking ${compassWord(facing)}`}
                    onLoad={() => setPictureLoading(false)}
                    onError={() => setPictureFailed(true)}
                    className="block h-full w-full object-cover"
                  />
                )}
              </TapSurface>
              {(loading || pictureLoading) && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-[#0b0818]/70" role="status" aria-label="Loading Street View">
                  <Loader2 size={mapIsMain ? 14 : 22} className="animate-spin text-white/80" aria-hidden="true" />
                </div>
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
          <div className="space-y-1.5 px-3 pt-2 text-[11.5px] leading-4 text-white/60">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{info?.enabled ? "There are no Street View photos close to this spot." : "See the street in front of the plot:"}</span>
              <a href={streetViewLink(latitude, longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-mint hover:underline">
                Open Google Street View <ExternalLink size={11} aria-hidden="true" />
              </a>
            </p>
            {info?.reason && (
              <p role="note" className="rounded-lg border border-[#f5b942]/50 bg-[#2a2110] px-2.5 py-2 text-amber-100">
                Only you see this: Street View is off in this site ({info.reason}). Set <span className="font-mono">GOOGLE_MAPS_API_KEY</span> (with the Street View Static API enabled) and <span className="font-mono">ARCHITECTURE_MAPS_IMAGERY=1</span>, then restart the server. Customers will then see Street View here and can tap what they mean on it.
              </p>
            )}
            {photos.length === 0 && (
              <p>Or take a screenshot of the street, or a photo of the plot, add it with the + button, and tap exactly what you mean on it.</p>
            )}
          </div>
        </div>
      )}

      {showPhotoPicker && (
        <div className="px-3 pt-3" data-testid="photo-target">
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
            <a href={streetViewLink(latitude, longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-mint hover:underline">
              Look around in Google Street View <ExternalLink size={11} aria-hidden="true" />
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
