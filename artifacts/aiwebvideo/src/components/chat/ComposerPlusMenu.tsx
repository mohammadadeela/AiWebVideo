import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronRight, File as FileGeneric, FileImage, FileText, FileVideo, ImagePlus, Palette, Plus, X } from "lucide-react";
import { clearRecentFiles, fileKey, forgetRecentFile, listRecentFiles, type RecentFile } from "@/lib/recentFiles";

function fileIcon(type: string): ReactNode {
  if (type.startsWith("image/")) return <FileImage size={18} />;
  if (type.startsWith("video/")) return <FileVideo size={18} />;
  if (type === "application/pdf" || type.startsWith("text/") || type.includes("word") || type.includes("document")) return <FileText size={18} />;
  return <FileGeneric size={18} />;
}

function sizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function whenLabel(time: number) {
  const days = Math.floor((Date.now() - time) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Thumb({ item }: { item: RecentFile }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item.type.startsWith("image/")) return;
    const next = URL.createObjectURL(item.file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [item]);
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/[.06] text-white/55">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : fileIcon(item.type)}
    </span>
  );
}

/**
 * The composer's "+" button, like the ones in Claude and ChatGPT. One place for everything you can add:
 * new photos, a style, and files you have used before (kept on this device only).
 */
export function ComposerPlusMenu({ disabled, addLabel, attachedCount, attachedKeys, maxFiles, onPickFiles, onUseRecent, styleValue, onStyle, recentOwner }: {
  disabled?: boolean;
  addLabel: string;
  attachedCount: number;
  /** fileKey() of every file already attached, so those rows read "Added". */
  attachedKeys: ReadonlySet<string>;
  maxFiles: number;
  onPickFiles: () => void;
  onUseRecent: (file: File) => void;
  /** Website mode only: the current style name. Omit to hide the row. */
  styleValue?: string;
  onStyle?: () => void;
  /** The signed-in account whose recent files are offered. Signed out (null): the Recent files section is not shown at all. */
  recentOwner: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const full = attachedCount >= maxFiles;

  useEffect(() => {
    if (!open || !recentOwner) return;
    let cancelled = false;
    void listRecentFiles(recentOwner).then((rows) => { if (!cancelled) { setRecent(rows); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [open, recentOwner]);

  const rows = useMemo(() => recent.slice(0, 12), [recent]);

  async function forget(id: string) {
    setRecent((current) => current.filter((row) => row.id !== id));
    await forgetRecentFile(id);
  }

  async function clearAll() {
    setRecent([]);
    await clearRecentFiles(recentOwner);
  }

  const item = "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[13px] font-medium text-white transition hover:bg-white/[.06] disabled:opacity-40";

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Add photos, style or recent files"
          aria-expanded={open}
          className={`composer-plus grid shrink-0 place-items-center rounded-full border transition active:scale-95 disabled:opacity-40 ${open ? "border-white/30 bg-white/10 text-white" : "border-white/[.14] bg-white/[.04] text-white/80 hover:border-white/30 hover:bg-white/[.08] hover:text-white"}`}
        >
          <Plus size={18} className={`transition-transform duration-200 ${open ? "rotate-45" : ""}`} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Add to your prompt"
          className="generation-control-menu generation-control-menu-wide"
        >
          <div className="p-1">
            <button type="button" disabled={full} onClick={() => { setOpen(false); onPickFiles(); }} className={item}>
              <ImagePlus size={18} className="text-white/70" />
              <span className="flex-1">{addLabel}</span>
              {full && <span className="text-[11px] font-normal text-white/40">{maxFiles} max</span>}
            </button>

            {onStyle && (
              <button type="button" onClick={() => { setOpen(false); onStyle(); }} className={item}>
                <Palette size={18} className="text-white/70" />
                <span className="flex-1">Style</span>
                <span className="text-[12px] font-normal text-white/45">{styleValue ?? "Auto"}</span>
                <ChevronRight size={15} className="text-white/35" />
              </button>
            )}

            {recentOwner && (<>
            <div className="mx-2 my-1.5 h-px bg-white/[.08]" />

            <div className="flex items-center justify-between px-2.5 pb-1 pt-1">
              <p className="text-[11px] font-medium text-white/45">Recent files</p>
              {rows.length > 0 && <button type="button" onClick={() => void clearAll()} className="text-[11px] font-medium text-white/40 transition hover:text-white">Clear</button>}
            </div>

            {rows.length === 0 ? (
              <p className="px-2.5 pb-2.5 pt-1 text-[12px] leading-[1.45] text-white/40">
                {loaded ? "Photos you add will show up here so you can use them again. They stay on this device." : "Loading…"}
              </p>
            ) : (
              <ul className="chat-scroll max-h-[244px] overflow-y-auto pr-0.5">
                {rows.map((row) => {
                  const inUse = attachedKeys.has(row.key);
                  return (
                    <li key={row.id} className="group relative">
                      <button
                        type="button"
                        disabled={full || inUse}
                        onClick={() => { onUseRecent(row.file); setOpen(false); }}
                        title={row.name}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[.06] disabled:opacity-40"
                      >
                        <Thumb item={row} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-white">{row.name}</span>
                          <span className="block text-[11px] text-white/40">{inUse ? "Added" : `${sizeLabel(row.size)} · ${whenLabel(row.usedAt)}`}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void forget(row.id)}
                        aria-label={`Remove ${row.name} from recent files`}
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-[#161026] text-white/50 opacity-0 shadow transition hover:text-white focus:opacity-100 group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            </>)}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { fileKey };
