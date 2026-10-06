/**
 * "Capture this view": the customer turns Google's 360° viewer to the exact shop or plot, presses one button, and the
 * picture of that frame becomes the photo the design is made from and the one they tap on. It uses the browser's own
 * tab capture (the only way a page may read pixels of Google's frame), so the browser asks once to share THIS tab;
 * nothing is recorded, one frame is taken and sharing stops at once.
 */

export interface CaptureRect { left: number; top: number; width: number; height: number }
export interface CaptureCrop { sx: number; sy: number; sw: number; sh: number }

/** The smallest picture worth designing from. Anything smaller means the wrong region was taken. */
export const MIN_CAPTURE_PIXELS = 160;

/**
 * Where, inside a captured frame of the whole tab, the element is. The frame is in device pixels; the element's box is in
 * page pixels, so the scale is frame width over viewport width. Clamped to the frame; null when too little is inside it.
 */
export function cropFromFrame(rect: CaptureRect, viewport: { width: number; height: number }, frame: { width: number; height: number }): CaptureCrop | null {
  if (!(viewport.width > 0) || !(viewport.height > 0) || !(frame.width > 0) || !(frame.height > 0)) return null;
  const scaleX = frame.width / viewport.width;
  const scaleY = frame.height / viewport.height;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewport.width, rect.left + rect.width);
  const bottom = Math.min(viewport.height, rect.top + rect.height);
  const sx = Math.round(left * scaleX);
  const sy = Math.round(top * scaleY);
  const sw = Math.min(frame.width - sx, Math.round((right - left) * scaleX));
  const sh = Math.min(frame.height - sy, Math.round((bottom - top) * scaleY));
  if (sw < MIN_CAPTURE_PIXELS || sh < MIN_CAPTURE_PIXELS) return null;
  return { sx, sy, sw, sh };
}

export type CaptureFailure = "unsupported" | "denied" | "surface" | "hidden" | "tiny" | "failed";
export class CaptureError extends Error {
  constructor(readonly reason: CaptureFailure) { super(reason); }
}

/**
 * One-click capture needs "share this tab" with the page's own tab pre-selected, which Chrome, Edge and Opera on a computer
 * offer. Firefox and Safari only offer whole windows or screens, and phones' browsers offer nothing: they keep the
 * screenshot instructions.
 */
export function canCaptureTab(): boolean {
  if (typeof navigator === "undefined" || typeof document === "undefined") return false;
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== "function") return false;
  return /Chrome\//.test(navigator.userAgent) && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type CropTargetApi = { fromElement(element: Element): Promise<unknown> };
type CroppableTrack = MediaStreamTrack & { cropTo?: (target: unknown) => Promise<void> };

/** Takes ONE frame of the element and returns it as a JPEG file. Always stops sharing before it returns. */
export async function captureElementAsFile(element: HTMLElement, fileName: string): Promise<File> {
  if (!canCaptureTab()) throw new CaptureError("unsupported");
  let stream: MediaStream | null = null;
  try {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    await nextFrame(); await nextFrame();
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 8 },
        audio: false,
        // Chrome / Edge: offer this tab first and do not let the person wander to another surface mid-way.
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
        systemAudio: "exclude",
      } as DisplayMediaStreamOptions);
    } catch (error) {
      const name = (error as { name?: string })?.name;
      throw new CaptureError(name === "NotAllowedError" || name === "AbortError" ? "denied" : "failed");
    }
    const [track] = stream.getVideoTracks() as CroppableTrack[];
    if (!track) throw new CaptureError("failed");

    // Region capture (Chrome / Edge): the browser itself crops to the element, which is exact even with zoom or scrollbars.
    let cropped = false;
    const CropTarget = (window as unknown as { CropTarget?: CropTargetApi }).CropTarget;
    if (CropTarget && typeof track.cropTo === "function") {
      try { await track.cropTo(await CropTarget.fromElement(element)); cropped = true; } catch { cropped = false; }
    }

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Let the first real frame arrive (the first one after the permission box is often the box itself).
    await wait(350);
    await nextFrame();
    if (!video.videoWidth || !video.videoHeight) throw new CaptureError("failed");

    const frame = { width: video.videoWidth, height: video.videoHeight };
    let crop: CaptureCrop | null;
    if (cropped) {
      crop = { sx: 0, sy: 0, sw: frame.width, sh: frame.height };
    } else {
      const box = element.getBoundingClientRect();
      crop = cropFromFrame({ left: box.left, top: box.top, width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }, frame);
      // The person shared a window or the whole screen instead of this tab: the frame is not the page, so the element is not where we expect it.
      const aspectOk = Math.abs(frame.width / frame.height - window.innerWidth / window.innerHeight) < 0.06;
      if (!aspectOk) throw new CaptureError("surface");
      if (!crop) throw new CaptureError("hidden");
    }
    if (crop.sw < MIN_CAPTURE_PIXELS || crop.sh < MIN_CAPTURE_PIXELS) throw new CaptureError("tiny");

    // Keep it sharp but within the upload limits: at most 2400 px on the long side.
    const longSide = Math.max(crop.sw, crop.sh);
    const scale = longSide > 2400 ? 2400 / longSide : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.sw * scale);
    canvas.height = Math.round(crop.sh * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new CaptureError("failed");
    context.imageSmoothingQuality = "high";
    context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob || blob.size < 2_000) throw new CaptureError("failed");
    return new File([blob], fileName, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

export function captureFailureMessage(reason: CaptureFailure): string {
  switch (reason) {
    case "denied": return "Nothing was captured. Press the button again and allow the browser to share this tab. Only one picture is taken.";
    case "surface": return "Please choose \"This tab\" when the browser asks what to share, then press the button again.";
    case "hidden": return "The view is partly off the screen. Scroll so the whole 360° picture is visible, then try again.";
    case "tiny": return "That picture came out too small. Make the browser window larger and try again.";
    case "unsupported": return "This browser cannot capture the view. Use your device's screenshot buttons, then add the screenshot.";
    default: return "The capture did not work. Try once more, or take a screenshot yourself and add it.";
  }
}
