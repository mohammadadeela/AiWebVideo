import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Compass, ExternalLink, Loader2, LocateFixed } from "lucide-react";
import { getStreetView, streetViewImageSrc, type StreetViewInfo } from "@/lib/api-client";

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
export const compassWord = (heading: number) => COMPASS[Math.round((((heading % 360) + 360) % 360) / 45) % 8];

/** Google's own page for looking around a spot: works without any key, and is the way in when our pictures are off. */
export const streetViewLink = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

/**
 * The place a building will stand, as a person would check it: the real street in front of it (Google Street View) is the
 * main picture and the map sits in the corner (tap it to swap). The customer can turn the camera to the side the building
 * will face. The design is made from exactly this view and the two beside it, so what is shown here is what the AI sees.
 */
export function SiteStreetView({ latitude, longitude, mapSrc, heading, onHeading }: {
  latitude: number;
  longitude: number;
  mapSrc: string;
  /** The compass direction the customer chose, or null for "face the plot" (the default). */
  heading: number | null;
  onHeading: (heading: number | null) => void;
}) {
  const [info, setInfo] = useState<StreetViewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pictureFailed, setPictureFailed] = useState(false);
  const [pictureLoading, setPictureLoading] = useState(true);
  const [mapIsMain, setMapIsMain] = useState(false);

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
  const facing = heading ?? info?.headingToPlot ?? 0;
  const src = available && info?.panoId ? streetViewImageSrc(info.panoId, facing) : null;
  useEffect(() => { setPictureLoading(true); }, [src]);

  const turn = (by: number) => onHeading((((Math.round(facing) + by) % 360) + 360) % 360);
  const old = typeof info?.ageYears === "number" && info.ageYears >= 4;

  // No Street View here (or it is switched off): the map alone, and Google's own street view one tap away.
  if (!loading && !available) {
    return (
      <div>
        <iframe title="The exact spot on the map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full border-0" />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-2 text-[11px] leading-4 text-white/60">
          <span>{info?.enabled ? "There are no Street View photos close to this spot." : "See the street in front of the plot:"}</span>
          <a href={streetViewLink(latitude, longitude)} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-mint hover:underline">
            Open Google Street View <ExternalLink size={11} aria-hidden="true" />
          </a>
        </p>
      </div>
    );
  }

  const insetClass = "absolute bottom-2 left-2 z-10 h-[78px] w-[108px] overflow-hidden rounded-lg border-2 border-white/85 shadow-[0_6px_18px_rgba(0,0,0,.55)] sm:h-[88px] sm:w-[124px]";
  const mapLayer = mapIsMain ? "absolute inset-0" : `${insetClass} pointer-events-none`;
  const streetLayer = mapIsMain ? insetClass : "absolute inset-0";

  return (
    <div data-testid="site-streetview">
      <div className="relative h-56 w-full overflow-hidden bg-[#05030f] sm:h-64">
        {/* the map: always mounted (it does not reload when swapped) */}
        <div className={mapLayer}>
          <iframe title="The exact spot on the map" src={mapSrc} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full border-0" />
        </div>

        {/* Street View */}
        <div className={streetLayer}>
          {src && (
            <img
              key={src}
              src={src}
              alt={`Google Street View of the street, looking ${compassWord(facing)}`}
              onLoad={() => setPictureLoading(false)}
              onError={() => setPictureFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
          {(loading || pictureLoading) && (
            <div className="absolute inset-0 grid place-items-center bg-[#0b0818]/70" role="status" aria-label="Loading Street View">
              <Loader2 size={mapIsMain ? 14 : 22} className="animate-spin text-white/80" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* swap: tap the small picture to make it the big one */}
        <button
          type="button"
          onClick={() => setMapIsMain((value) => !value)}
          aria-label={mapIsMain ? "Show Street View large" : "Show the map large"}
          className={`${insetClass} z-20 bg-transparent`}
        >
          <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">{mapIsMain ? "Street View" : "Map"}</span>
        </button>

        {available && (
          <>
            <p className="absolute left-2 top-2 z-10 max-w-[70%] rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold leading-4 text-white">
              Google Street View{info?.dateLabel ? ` · ${info.dateLabel}` : ""}
            </p>
            <p className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
              <Compass size={12} aria-hidden="true" /> Facing {compassWord(facing)}
            </p>
            <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5">
              <button type="button" onClick={() => turn(-45)} aria-label="Turn the camera left" className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition active:scale-95">
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => turn(45)} aria-label="Turn the camera right" className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition active:scale-95">
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
            <p className="pointer-events-none absolute bottom-1 left-1/2 z-10 hidden -translate-x-1/2 text-[10px] text-white/80 sm:block">© Google</p>
          </>
        )}
      </div>

      {available && (
        <div className="space-y-1.5 px-3 pt-2 text-[11px] leading-4 text-white/60">
          {old ? (
            <p className="text-amber-200">
              This photo is from {info?.dateLabel}, so newer buildings may be missing. If the street has changed, add a recent photo of the plot with the + button: yours wins.
            </p>
          ) : null}
          <p>
            The design is made from this view and the two beside it, so the new building fits the real street. Turn to the side it will face.
            {heading !== null && (
              <button type="button" onClick={() => onHeading(null)} className="ml-1.5 inline-flex min-h-8 items-center gap-1 font-semibold text-mint hover:underline">
                <LocateFixed size={11} aria-hidden="true" /> Face the plot again
              </button>
            )}
          </p>
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
