/** An engineer's CAD drawing travels apart from photos: Interior Design and Architecture accept one. */
export const DRAWING_MAX_BYTES = 20 * 1024 * 1024;

export function isDrawingFile(file: Pick<File, "name">): boolean {
  return /\.(dxf|dwg)$/i.test(file.name);
}

export function drawingSizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
