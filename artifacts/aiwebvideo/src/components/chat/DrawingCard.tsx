import { useCallback, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, Loader2, Ruler, TriangleAlert, X } from "lucide-react";
import { ApiError, previewDrawing, type DrawingPreview, type DrawingUnitChoice } from "@/lib/api-client";
import { DRAWING_MAX_BYTES, drawingSizeLabel } from "@/lib/drawingFile";

export interface DrawingState {
  file: File;
  preview: DrawingPreview | null;
  reading: boolean;
  error: string | null;
}

const UNIT_LABELS: ReadonlyArray<{ id: DrawingUnitChoice; label: string; long: string }> = [
  { id: "mm", label: "mm", long: "millimetres" },
  { id: "cm", label: "cm", long: "centimetres" },
  { id: "m", label: "m", long: "metres" },
  { id: "in", label: "in", long: "inches" },
  { id: "ft", label: "ft", long: "feet" },
];

/** Metres, to the precision that is meaningful at that size. */
export function metres(value: number): string {
  const abs = Math.abs(value);
  return `${abs >= 100 ? value.toFixed(1) : abs >= 10 ? value.toFixed(2) : value.toFixed(3)} m`;
}

/**
 * One CAD drawing attached to the creator. The server reads it (real sizes, units, rooms, dimensions) and the customer
 * checks the result here BEFORE anything is generated or charged. Generating is held until the drawing has been read
 * and, when the file did not state its units clearly, until the customer has chosen them.
 */
export function useDrawingAttachment() {
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const sequence = useRef(0);

  const read = useCallback(async (file: File, units?: DrawingUnitChoice) => {
    const id = ++sequence.current;
    setDrawing((current) => ({ file, preview: current?.file === file ? current.preview : null, reading: true, error: null }));
    try {
      const preview = await previewDrawing(file, units);
      if (id === sequence.current) setDrawing({ file, preview, reading: false, error: null });
    } catch (error) {
      if (id !== sequence.current) return;
      setDrawing({ file, preview: null, reading: false, error: error instanceof ApiError || error instanceof Error ? error.message : "Your drawing could not be read." });
    }
  }, []);

  const attach = useCallback((file: File) => {
    if (file.size > DRAWING_MAX_BYTES) {
      sequence.current += 1;
      setDrawing({ file, preview: null, reading: false, error: `That drawing is ${drawingSizeLabel(file.size)}; the limit is ${drawingSizeLabel(DRAWING_MAX_BYTES)}. Export only the plan you need and upload that.` });
      return;
    }
    void read(file);
  }, [read]);

  const remove = useCallback(() => { sequence.current += 1; setDrawing(null); }, []);
  const chooseUnits = useCallback((units: DrawingUnitChoice) => { if (drawing) void read(drawing.file, units); }, [drawing, read]);

  const blockReason = useMemo(() => {
    if (!drawing) return null;
    if (drawing.reading) return "Your drawing is still being read. One moment.";
    if (drawing.error || !drawing.preview) return "Your drawing could not be read. Remove it, or upload it again as a DXF.";
    if (drawing.preview.units.needsConfirmation) return "Choose the units of your drawing first, so every size is exact.";
    return null;
  }, [drawing]);

  return { drawing, attach, remove, chooseUnits, blockReason };
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#100c24] px-3 py-2">
      <p className="text-[11px] text-white/50">{label}</p>
      <p className="truncate text-[14px] font-bold text-white">{value}</p>
      {note && <p className="text-[11px] text-white/45">{note}</p>}
    </div>
  );
}

export function DrawingCard({ state, onRemove, onUnits }: { state: DrawingState; onRemove: () => void; onUnits: (units: DrawingUnitChoice) => void }) {
  const { file, preview, reading, error } = state;
  const needsUnits = Boolean(preview?.units.needsConfirmation);
  const pictureSrc = useMemo(
    () => (preview?.previewSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.previewSvg)}` : null),
    [preview?.previewSvg],
  );

  return (
    <section aria-label="CAD drawing" className="mx-3 mb-2 overflow-hidden rounded-2xl border border-white/[.12] bg-[#16112f] sm:mx-4">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#241d47] text-violet"><Ruler size={19} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-white">{file.name}</p>
          <p className="text-[11.5px] text-white/55">
            {reading ? "Reading your drawing…" : error ? "Could not be read" : `${drawingSizeLabel(file.size)} · read exactly from the file`}
          </p>
        </div>
        {reading && <Loader2 size={18} className="shrink-0 animate-spin text-violet" aria-label="Reading" />}
        <button type="button" onClick={onRemove} aria-label="Remove drawing" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/65 transition hover:bg-[#241d47] hover:text-white">
          <X size={17} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 border-t border-white/[.08] bg-[#2a1220] px-3 py-2.5 text-[12.5px] leading-snug text-[#ffb4c4]">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {preview && !error && (
        <div className="border-t border-white/[.08] px-3 pb-3 pt-2.5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
            {pictureSrc && (
              <div className="grid min-h-[130px] place-items-center overflow-hidden rounded-xl bg-white p-1.5">
                <img src={pictureSrc} alt="Your drawing, to scale" className="max-h-[190px] w-full object-contain" />
              </div>
            )}
            <div className="grid grid-cols-2 content-start gap-2">
              {preview.extents && <Fact label="Overall size" value={`${metres(preview.extents.widthM)} × ${metres(preview.extents.depthM)}`} note={preview.extents.heightM ? `${metres(preview.extents.heightM)} high` : undefined} />}
              {preview.outerBoundary && <Fact label="Outline area" value={`${preview.outerBoundary.areaM2.toFixed(2)} m²`} note={preview.outerBoundary.rectangular ? "rectangular" : "exact outline kept"} />}
              <Fact label="Rooms found" value={String(preview.roomCount)} note={preview.roomCount ? "closed outlines" : "none drawn as closed outlines"} />
              <Fact
                label="Dimensions"
                value={String(preview.dimensionCount)}
                note={preview.dimensionCheck.mismatched ? `${preview.dimensionCheck.mismatched} disagree with the drawing` : preview.dimensionCheck.compared ? "all match the drawing" : undefined}
              />
            </div>
          </div>

          <div className={`mt-3 rounded-xl border px-3 py-2.5 ${needsUnits ? "border-[#f5b942]/60 bg-[#2a2110]" : "border-white/[.08] bg-[#100c24]"}`}>
            <p className="flex items-start gap-2 text-[12.5px] leading-snug text-white/85">
              {needsUnits ? <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#f5b942]" aria-hidden="true" /> : <Check size={16} className="mt-0.5 shrink-0 text-mint" aria-hidden="true" />}
              <span>
                {needsUnits
                  ? <><strong className="font-bold">Which units does this drawing use?</strong> {preview.units.note ?? ""} Pick the right one and every size updates.</>
                  : <>Units: <strong className="font-bold">{preview.units.name}</strong> ({preview.units.source === "file" ? "stated in the file" : "chosen by you"}). Change them if that is wrong.</>}
              </span>
            </p>
            <div role="radiogroup" aria-label="Drawing units" className="mt-2 flex flex-wrap gap-1.5">
              {UNIT_LABELS.map(({ id, label, long }) => {
                const selected = !needsUnits && preview.units.choice === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={long}
                    onClick={() => onUnits(id)}
                    disabled={reading}
                    className={`h-10 min-w-[52px] rounded-lg border px-3 text-[13px] font-bold transition disabled:opacity-50 ${selected ? "border-transparent bg-gradient-to-r from-violet to-blue-500 text-white" : needsUnits && preview.units.choice === id ? "border-[#f5b942]/70 bg-[#1b1530] text-white" : "border-white/[.14] bg-[#1b1530] text-white/85 hover:border-white/30"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {preview.rooms.length > 0 && (
            <details className="mt-2.5 rounded-xl bg-[#100c24] px-3 py-2 text-[12.5px] text-white/80">
              <summary className="cursor-pointer select-none font-semibold text-white">Rooms and areas ({preview.roomCount})</summary>
              <ul className="mt-1.5 grid gap-1">
                {preview.rooms.map((room, index) => (
                  <li key={`${room.label}-${index}`} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{room.label}</span>
                    <span className="shrink-0 text-white/60">{room.areaM2.toFixed(2)} m²{room.rectangular ? ` · ${room.widthM.toFixed(2)} × ${room.depthM.toFixed(2)} m` : ""}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {preview.warnings.filter((warning) => warning !== preview.units.note).length > 0 && (
            <ul className="mt-2.5 grid gap-1.5 text-[12px] leading-snug text-[#f5d58a]">
              {preview.warnings.filter((warning) => warning !== preview.units.note).slice(0, 4).map((warning) => (
                <li key={warning} className="flex items-start gap-2"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{warning}</span></li>
              ))}
            </ul>
          )}

          <p className="mt-2.5 text-[11.5px] leading-snug text-white/45">
            These sizes come straight from your file. The AI receives these exact figures and a to-scale picture of the plan, and is told not to add, remove or resize anything.
          </p>
        </div>
      )}
    </section>
  );
}
