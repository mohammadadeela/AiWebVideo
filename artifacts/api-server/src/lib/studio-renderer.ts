import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { ASSETS_DIR } from './capture.js';
import { query } from './pool.js';
import { materializeStudioAsset } from './studio-media.js';
import { studioProjectStateSchema, type StudioLayer } from './studio-engine.js';
import { uploadFileToR2 } from './r2-storage.js';

const execFileAsync = promisify(execFile);
let renderChain = Promise.resolve();

interface ProjectRow { id: string; user_id: string; kind: 'video' | 'image'; project_state: unknown; }
interface AssetRow { id: string; kind: string; mime_type: string; storage_url: string; }
interface ExportRow { id: string; project_id: string; user_id: string; status: string; resolution: '720p' | '1080p' | '4k'; format: 'mp4' | 'png' | 'jpg'; }

function outputFrame(aspectRatio: '16:9' | '9:16' | '1:1', resolution: '720p' | '1080p' | '4k') {
  const landscape = resolution === '720p' ? [1280,720] : resolution === '1080p' ? [1920,1080] : [3840,2160];
  if (aspectRatio === '16:9') return { width: landscape[0], height: landscape[1] };
  if (aspectRatio === '9:16') return { width: landscape[1], height: landscape[0] };
  const square = resolution === '720p' ? 720 : resolution === '1080p' ? 1080 : 2160;
  return { width: square, height: square };
}

function assTime(seconds: number) {
  const value = Math.max(0, seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const wholeSeconds = Math.floor(value % 60);
  const centiseconds = Math.floor((value - Math.floor(value)) * 100);
  return `${hours}:${String(minutes).padStart(2,'0')}:${String(wholeSeconds).padStart(2,'0')}.${String(centiseconds).padStart(2,'0')}`;
}

function assEscape(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\r?\n/g, '\\N');
}

function assColor(hex: unknown) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return '&H00FFFFFF';
  const value = hex.slice(1);
  return `&H00${value.slice(4,6)}${value.slice(2,4)}${value.slice(0,2)}`;
}

async function writeTextTrack(projectId: string, exportId: string, width: number, height: number, layers: StudioLayer[]) {
  const textLayers = layers.filter((layer) => layer.type === 'text' && layer.text && layer.end > layer.start);
  if (!textLayers.length) return null;
  const dir = path.join(ASSETS_DIR, projectId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `studio-export-${exportId}.ass`);
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${width}\nPlayResY: ${height}\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Default,DejaVu Sans,54,&H00FFFFFF,&H00FFFFFF,&H80000000,&H40000000,-1,0,0,0,100,100,0,0,1,2,1,5,20,20,20,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`;
  const events = textLayers.map((layer) => {
    const style = layer.style ?? {};
    const fontSize = Math.max(14, Math.min(240, Number(style.fontSize ?? 64) * (width / 1080)));
    const weight = Number(style.weight ?? 700) >= 600 ? 1 : 0;
    const x = Math.round(layer.x * width);
    const y = Math.round(layer.y * height);
    const color = assColor(style.color);
    const opacity = Math.round((1 - layer.opacity) * 255).toString(16).padStart(2,'0').toUpperCase();
    const colorWithOpacity = color.replace('&H00', `&H${opacity}`);
    const tags = `{\\an5\\pos(${x},${y})\\fs${fontSize.toFixed(0)}\\b${weight}\\c${colorWithOpacity}}`;
    return `Dialogue: 0,${assTime(layer.start)},${assTime(layer.end)},Default,,0,0,0,,${tags}${assEscape(layer.text ?? '')}`;
  }).join('\n');
  await fs.writeFile(filePath, `${header}${events}\n`, 'utf8');
  return filePath;
}

function normalizedOverlayPosition(layer: StudioLayer, width: number, height: number) {
  const x = Math.round(layer.x * width);
  const y = Math.round(layer.y * height);
  return { x: `max(0,min(W-w,${x}-w/2))`, y: `max(0,min(H-h,${y}-h/2))` };
}

function escapeFilterPath(value: string) {
  return value.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function setExport(exportId: string, values: { status?: string; progress?: number; storageUrl?: string | null; error?: string | null; renderTimeMs?: number | null; completed?: boolean }) {
  await query(
    `UPDATE studio_exports SET
       status=COALESCE($2,status),
       progress=COALESCE($3,progress),
       storage_url=COALESCE($4,storage_url),
       error=$5,
       render_time_ms=COALESCE($6,render_time_ms),
       completed_at=CASE WHEN $7 THEN NOW() ELSE completed_at END,
       updated_at=NOW()
     WHERE id=$1`,
    [exportId, values.status ?? null, values.progress ?? null, values.storageUrl ?? null, values.error ?? null, values.renderTimeMs ?? null, Boolean(values.completed)],
  );
}

async function renderOne(exportId: string) {
  const startedAt = Date.now();
  const exportResult = await query<ExportRow>('SELECT id,project_id,user_id,status,resolution,format FROM studio_exports WHERE id=$1 LIMIT 1', [exportId]);
  const exportRow = exportResult.rows[0];
  if (!exportRow || exportRow.status === 'cancelled') return;
  const projectResult = await query<ProjectRow>('SELECT id,user_id,kind,project_state FROM studio_projects WHERE id=$1 AND deleted_at IS NULL LIMIT 1', [exportRow.project_id]);
  const project = projectResult.rows[0];
  if (!project || project.user_id !== exportRow.user_id) throw new Error('Studio project is unavailable.');
  const state = studioProjectStateSchema.parse(project.project_state);
  if (!state.layers.length) throw new Error('Add media to the Studio timeline before exporting.');
  const assetsResult = await query<AssetRow>('SELECT id,kind,mime_type,storage_url FROM studio_assets WHERE project_id=$1', [project.id]);
  const assets = new Map(assetsResult.rows.map((item) => [item.id, item]));
  const visualLayers = state.layers.filter((layer) => (layer.type === 'video' || layer.type === 'image') && layer.assetId && assets.has(layer.assetId));
  const primary = visualLayers[0];
  if (!primary?.assetId) throw new Error('Studio export needs at least one image or video layer.');
  const primaryAsset = assets.get(primary.assetId)!;
  const { width, height } = outputFrame(state.canvas.aspectRatio, exportRow.resolution);
  const duration = Math.max(0.1, state.duration || primary.end || 5);
  await setExport(exportId, { status: 'preparing', progress: 8, error: null });

  const inputArgs: string[] = [];
  const inputLayerIndexes = new Map<string, number>();
  const orderedVisual = [primary, ...visualLayers.slice(1)];
  let inputIndex = 0;
  for (const layer of orderedVisual) {
    const asset = assets.get(layer.assetId!);
    if (!asset) continue;
    const local = await materializeStudioAsset(asset.storage_url);
    if (asset.mime_type.startsWith('image/')) inputArgs.push('-loop','1','-framerate','30','-t',String(Math.max(0.1, layer.end - layer.start || duration)));
    inputArgs.push('-i', local.filePath);
    inputLayerIndexes.set(layer.id, inputIndex++);
  }
  const audioLayers = state.layers.filter((layer) => layer.type === 'audio' && layer.assetId && assets.has(layer.assetId));
  for (const layer of audioLayers) {
    const asset = assets.get(layer.assetId!);
    if (!asset) continue;
    const local = await materializeStudioAsset(asset.storage_url);
    inputArgs.push('-i', local.filePath);
    inputLayerIndexes.set(layer.id, inputIndex++);
  }

  const filters: string[] = [];
  const baseIndex = inputLayerIndexes.get(primary.id) ?? 0;
  const primaryTrim = primary.trimStart > 0 ? `trim=start=${primary.trimStart}:duration=${duration},` : `trim=duration=${duration},`;
  filters.push(`[${baseIndex}:v]${primaryTrim}setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${state.canvas.background},setsar=1[base0]`);
  let current = 'base0';
  let overlayNumber = 0;
  for (const layer of orderedVisual.slice(1)) {
    const idx = inputLayerIndexes.get(layer.id);
    if (idx == null) continue;
    const targetWidth = Math.max(24, Math.round(width * layer.width));
    const { x, y } = normalizedOverlayPosition(layer, width, height);
    const radians = (layer.rotation * Math.PI / 180).toFixed(6);
    const overlayLabel = `ov${overlayNumber}`;
    const outputLabel = `mix${overlayNumber}`;
    filters.push(`[${idx}:v]trim=duration=${Math.max(0.05, layer.end - layer.start)},setpts=PTS-STARTPTS+${layer.start}/TB,scale=${targetWidth}:-2,format=rgba,rotate=${radians}:ow=rotw(iw):oh=roth(ih):c=none,colorchannelmixer=aa=${layer.opacity.toFixed(3)}[${overlayLabel}]`);
    filters.push(`[${current}][${overlayLabel}]overlay=x='${x}':y='${y}':enable='between(t,${layer.start},${layer.end})'[${outputLabel}]`);
    current = outputLabel;
    overlayNumber++;
  }

  const assPath = await writeTextTrack(project.id, exportId, width, height, state.layers);
  if (assPath) {
    const outputLabel = 'withtext';
    filters.push(`[${current}]subtitles='${escapeFilterPath(assPath)}'[${outputLabel}]`);
    current = outputLabel;
  }

  let audioLabel: string | null = null;
  if (audioLayers.length) {
    const pieces: string[] = [];
    for (const [index, layer] of audioLayers.entries()) {
      const idx = inputLayerIndexes.get(layer.id);
      if (idx == null) continue;
      const label = `aud${index}`;
      const delay = Math.max(0, Math.round(layer.start * 1000));
      filters.push(`[${idx}:a]atrim=duration=${Math.max(0.05, layer.end - layer.start)},asetpts=PTS-STARTPTS,volume=${layer.volume.toFixed(3)},adelay=${delay}|${delay}[${label}]`);
      pieces.push(`[${label}]`);
    }
    if (pieces.length === 1) audioLabel = pieces[0].slice(1,-1);
    else if (pieces.length > 1) {
      audioLabel = 'mixedaudio';
      filters.push(`${pieces.join('')}amix=inputs=${pieces.length}:duration=longest:normalize=0[${audioLabel}]`);
    }
  }

  const outputDir = path.join(ASSETS_DIR, project.id);
  await fs.mkdir(outputDir, { recursive: true });
  const isImageOutput = project.kind === 'image' && exportRow.format !== 'mp4';
  const extension = isImageOutput ? (exportRow.format === 'jpg' ? 'jpg' : 'png') : 'mp4';
  const filename = `studio-export-${exportId}.${extension}`;
  const outputPath = path.join(outputDir, filename);
  await setExport(exportId, { status: 'rendering', progress: 30, error: null });

  const args = ['-y','-hide_banner','-loglevel','error', ...inputArgs, '-filter_complex', filters.join(';'), '-map', `[${current}]`];
  if (isImageOutput) {
    args.push('-frames:v','1');
    if (extension === 'jpg') args.push('-q:v','2');
  } else {
    if (audioLabel) args.push('-map', `[${audioLabel}]`, '-c:a','aac','-b:a','192k');
    else if (primaryAsset.mime_type.startsWith('video/')) args.push('-map', `${baseIndex}:a?`, '-c:a','aac','-b:a','192k');
    args.push('-c:v','libx264','-preset','medium','-crf', exportRow.resolution === '4k' ? '17' : '18','-pix_fmt','yuv420p','-r','30','-t',String(duration),'-movflags','+faststart');
  }
  args.push(outputPath);
  await execFileAsync('ffmpeg', args, { timeout: Math.max(120_000, Math.min(45 * 60_000, duration * 12_000)), maxBuffer: 8 * 1024 * 1024 });
  const stat = await fs.stat(outputPath);
  if (!stat.size) throw new Error('Studio export produced an empty file.');
  await setExport(exportId, { status: 'uploading', progress: 88, error: null });
  await uploadFileToR2(project.id, filename, outputPath);
  await setExport(exportId, { status: 'completed', progress: 100, storageUrl: `/api/assets/${project.id}/${filename}`, error: null, renderTimeMs: Date.now() - startedAt, completed: true });
  if (assPath) await fs.rm(assPath, { force: true }).catch(() => {});
}

async function safeRender(exportId: string) {
  try {
    await renderOne(exportId);
  } catch (error) {
    await setExport(exportId, { status: 'failed', progress: 100, error: error instanceof Error ? error.message.slice(0,1000) : 'Studio export failed.', renderTimeMs: null });
  }
}

export function queueStudioExport(exportId: string) {
  renderChain = renderChain.then(() => safeRender(exportId), () => safeRender(exportId));
}
