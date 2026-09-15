import { z } from 'zod';

const positionPresetSchema = z.enum(['left','right','center','top-left','top-right','bottom-left','bottom-right']);

export const studioLayerSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['video','image','audio','text','shape']),
  name: z.string().default('Layer'),
  assetId: z.string().uuid().nullable().optional(),
  start: z.number().min(0).default(0),
  end: z.number().min(0).default(0),
  trimStart: z.number().min(0).default(0),
  trimEnd: z.number().min(0).nullable().default(null),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  width: z.number().min(0.02).max(2).default(0.32),
  height: z.number().min(0.02).max(2).default(0.32),
  rotation: z.number().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  volume: z.number().min(0).max(2).default(1),
  speed: z.number().min(0.1).max(8).default(1),
  text: z.string().nullable().optional(),
  style: z.record(z.string(), z.unknown()).default({}),
  effects: z.array(z.string()).default([]),
  transitionIn: z.string().nullable().optional(),
  transitionOut: z.string().nullable().optional(),
}).superRefine((layer, ctx) => {
  if (layer.end < layer.start) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Layer end must be after start.' });
});

export const studioProjectStateSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  canvas: z.object({
    width: z.number().int().min(64).max(8192).default(1080),
    height: z.number().int().min(64).max(8192).default(1920),
    aspectRatio: z.enum(['16:9','9:16','1:1']).default('9:16'),
    background: z.string().default('#05030b'),
  }).default({ width: 1080, height: 1920, aspectRatio: '9:16', background: '#05030b' }),
  duration: z.number().min(0).max(14_400).default(0),
  layers: z.array(studioLayerSchema).default([]),
  selectedLayerId: z.string().nullable().default(null),
  captions: z.array(z.object({ id: z.string(), start: z.number(), end: z.number(), text: z.string(), style: z.record(z.string(), z.unknown()).default({}) })).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type StudioProjectState = z.infer<typeof studioProjectStateSchema>;
export type StudioLayer = z.infer<typeof studioLayerSchema>;

const commandBase = z.object({ label: z.string().optional() });
const commandSchemas = [
  commandBase.extend({ type: z.literal('addOverlay'), assetId: z.string().uuid(), layerId: z.string().min(1), start: z.number().min(0), end: z.number().min(0), position: positionPresetSchema.optional(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), scale: z.number().min(0.05).max(2).optional() }),
  commandBase.extend({ type: z.literal('setPosition'), layerId: z.string().min(1), position: positionPresetSchema.optional(), x: z.number().min(0).max(1).optional(), y: z.number().min(0).max(1).optional(), dx: z.number().min(-1).max(1).optional(), dy: z.number().min(-1).max(1).optional() }),
  commandBase.extend({ type: z.literal('setScale'), layerId: z.string().min(1), scale: z.number().min(0.05).max(3).optional(), factor: z.number().min(0.1).max(4).optional() }),
  commandBase.extend({ type: z.literal('setDuration'), layerId: z.string().min(1), start: z.number().min(0).optional(), end: z.number().min(0).optional() }),
  commandBase.extend({ type: z.literal('setOpacity'), layerId: z.string().min(1), opacity: z.number().min(0).max(1) }),
  commandBase.extend({ type: z.literal('setRotation'), layerId: z.string().min(1), rotation: z.number().min(-360).max(360) }),
  commandBase.extend({ type: z.literal('setVolume'), layerId: z.string().min(1), volume: z.number().min(0).max(2) }),
  commandBase.extend({ type: z.literal('trimClip'), layerId: z.string().min(1), trimStart: z.number().min(0).optional(), trimEnd: z.number().min(0).optional() }),
  commandBase.extend({ type: z.literal('deleteClip'), layerId: z.string().min(1) }),
  commandBase.extend({ type: z.literal('splitClip'), layerId: z.string().min(1), at: z.number().min(0), newLayerId: z.string().min(1) }),
  commandBase.extend({ type: z.literal('addText'), layerId: z.string().min(1), text: z.string().min(1).max(1000), start: z.number().min(0), end: z.number().min(0), position: positionPresetSchema.optional(), style: z.record(z.string(), z.unknown()).optional() }),
  commandBase.extend({ type: z.literal('updateText'), layerId: z.string().min(1), text: z.string().max(1000) }),
  commandBase.extend({ type: z.literal('changeAspectRatio'), aspectRatio: z.enum(['16:9','9:16','1:1']) }),
  commandBase.extend({ type: z.literal('setProjectDuration'), duration: z.number().min(0.1).max(14_400) }),
  commandBase.extend({ type: z.literal('addTransition'), layerId: z.string().min(1), transition: z.enum(['cut','dissolve','fade','slide','push','zoom','dip-black','dip-white']), edge: z.enum(['in','out']) }),
  commandBase.extend({ type: z.literal('addEffect'), layerId: z.string().min(1), effect: z.enum(['blur','glow','vignette','grain','monochrome','clean','warm','cool','film','product','soft','high-contrast']) }),
  commandBase.extend({ type: z.literal('reorderLayer'), layerId: z.string().min(1), index: z.number().int().min(0) }),
] as const;

export const studioCommandSchema = z.discriminatedUnion('type', commandSchemas);
export const studioCommandListSchema = z.array(studioCommandSchema).min(1).max(40);
export type StudioEditCommand = z.infer<typeof studioCommandSchema>;

export const paidStudioOperationSchema = z.enum(['generateImage','editImage','removeBackground','eraseObject','replaceBackground','upscale','transcribe']);
export type PaidStudioOperation = z.infer<typeof paidStudioOperationSchema>;

export interface StudioPlanContext {
  project: StudioProjectState;
  attachmentIds: string[];
  attachmentNames?: string[];
  lastLayerId?: string | null;
}

export interface StudioEditPlan {
  execution: 'local' | 'paid';
  summary: string;
  commands: StudioEditCommand[];
  paidOperation?: PaidStudioOperation;
  costCredits: number;
  requiresConfirmation: boolean;
  context: { lastLayerId?: string | null };
}

export const STUDIO_AI_PRICES: Record<PaidStudioOperation, number> = {
  generateImage: 4,
  editImage: 3,
  removeBackground: 1,
  eraseObject: 3,
  replaceBackground: 4,
  upscale: 2,
  transcribe: 2,
};

function uid(prefix = 'layer') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seconds(text: string, fallback = 0) {
  const match = text.match(/(?:at|from|after|around)\s+(?:0?:)?(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i);
  return match ? Number(match[1]) : fallback;
}

function durationSeconds(text: string) {
  const match = text.match(/(?:for|keep(?:\s+it)?(?:\s+there)?\s+for)\s+(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i);
  return match ? Number(match[1]) : null;
}

function exactEnd(text: string) {
  const match = text.match(/(?:disappear|end|stop|until)\s+(?:at\s+)?(?:0?:)?(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i);
  return match ? Number(match[1]) : null;
}

function positionFromText(text: string): z.infer<typeof positionPresetSchema> | undefined {
  const lower = text.toLowerCase();
  if (/top[ -]?left/.test(lower)) return 'top-left';
  if (/top[ -]?right/.test(lower)) return 'top-right';
  if (/bottom[ -]?left/.test(lower)) return 'bottom-left';
  if (/bottom[ -]?right/.test(lower)) return 'bottom-right';
  if (/\bleft\b/.test(lower)) return 'left';
  if (/\bright\b/.test(lower)) return 'right';
  if (/\bcenter(?:ed)?\b|\bmiddle\b/.test(lower)) return 'center';
  return undefined;
}

function targetLayer(context: StudioPlanContext) {
  if (context.lastLayerId && context.project.layers.some((item) => item.id === context.lastLayerId)) return context.lastLayerId;
  if (context.project.selectedLayerId && context.project.layers.some((item) => item.id === context.project.selectedLayerId)) return context.project.selectedLayerId;
  return context.project.layers.at(-1)?.id ?? null;
}

export function classifyPaidStudioOperation(instruction: string): PaidStudioOperation | null {
  const value = instruction.toLowerCase();
  if (/transcrib|auto.?caption|generate subtitles?/.test(value)) return 'transcribe';
  if (/upscale|increase (?:the )?resolution|enhance resolution/.test(value)) return 'upscale';
  if (/remove (?:the )?background/.test(value)) return 'removeBackground';
  if (/replace (?:the )?background|change (?:the )?background|generate (?:a )?.*background/.test(value)) return 'replaceBackground';
  if (/erase|remove (?:this|that|the) (?:person|bottle|object|thing)|generative fill/.test(value)) return 'eraseObject';
  if (/generate (?:an? )?(?:new )?image|create (?:an? )?(?:new )?(?:photo|image)/.test(value)) return 'generateImage';
  if (/edit (?:this|the) image|restyle|relight/.test(value)) return 'editImage';
  return null;
}

export function planStudioInstruction(instruction: string, context: StudioPlanContext): StudioEditPlan {
  const text = instruction.trim();
  if (!text) throw new Error('Describe the edit you want.');
  const paidOperation = classifyPaidStudioOperation(text);
  if (paidOperation) {
    return {
      execution: 'paid', summary: `AI will ${text}`, commands: [], paidOperation,
      costCredits: STUDIO_AI_PRICES[paidOperation], requiresConfirmation: true,
      context: { lastLayerId: targetLayer(context) },
    };
  }

  const commands: StudioEditCommand[] = [];
  const lower = text.toLowerCase();
  const currentTarget = targetLayer(context);

  if (/\b(?:tiktok|reel|shorts?)\b/.test(lower) && /15[ -]?second|15\s*s\b/.test(lower)) {
    commands.push({ type: 'changeAspectRatio', aspectRatio: '9:16', label: 'Set vertical canvas' });
    commands.push({ type: 'setProjectDuration', duration: 15, label: 'Set 15-second duration' });
  }

  const aspect = /(?:portrait|vertical|9\s*:\s*16)/.test(lower) ? '9:16'
    : /(?:wide|landscape|16\s*:\s*9)/.test(lower) ? '16:9'
    : /(?:square|1\s*:\s*1)/.test(lower) ? '1:1' : null;
  if (aspect && !commands.some((item) => item.type === 'changeAspectRatio')) commands.push({ type: 'changeAspectRatio', aspectRatio: aspect, label: 'Change canvas' });

  const firstAttachment = context.attachmentIds[0];
  const wantsOverlay = Boolean(firstAttachment) && /(put|add|show|place|use|insert).*(image|photo|picture|logo|screenshot|product)|\b(?:this|attached) (?:image|photo|picture|logo)\b/i.test(text);
  if (wantsOverlay) {
    const start = seconds(text, /whole (?:video|clip)|entire (?:video|clip)/i.test(text) ? 0 : Math.min(context.project.duration || 0, 0));
    const requestedDuration = durationSeconds(text);
    const requestedEnd = exactEnd(text);
    const whole = /whole (?:video|clip)|entire (?:video|clip)|throughout/.test(lower);
    const end = whole ? Math.max(start, context.project.duration) : requestedEnd ?? Math.min(Math.max(context.project.duration, start + (requestedDuration ?? 4)), start + (requestedDuration ?? 4));
    const layerId = uid(/logo/.test(lower) ? 'logo' : 'overlay');
    commands.push({ type: 'addOverlay', assetId: firstAttachment, layerId, start, end, position: positionFromText(text) ?? 'center', scale: /smaller|small/.test(lower) ? 0.22 : 0.3, label: 'Add attached media' });
  }

  const target = wantsOverlay ? (commands.find((item): item is Extract<StudioEditCommand,{type:'addOverlay'}> => item.type === 'addOverlay')?.layerId ?? currentTarget) : currentTarget;
  if (target && !wantsOverlay && /(?:a little |slightly )?smaller/.test(lower)) commands.push({ type: 'setScale', layerId: target, factor: /a little|slightly/.test(lower) ? 0.9 : 0.82, label: 'Make layer smaller' });
  if (target && !wantsOverlay && /(?:a little |slightly )?bigger|larger/.test(lower)) commands.push({ type: 'setScale', layerId: target, factor: /a little|slightly/.test(lower) ? 1.1 : 1.2, label: 'Make layer larger' });
  if (target && !wantsOverlay && /move (?:it )?(?:a little |slightly )?higher|move (?:it )?up/.test(lower)) commands.push({ type: 'setPosition', layerId: target, dy: -0.06, label: 'Move layer higher' });
  if (target && !wantsOverlay && /move (?:it )?(?:a little |slightly )?lower|move (?:it )?down/.test(lower)) commands.push({ type: 'setPosition', layerId: target, dy: 0.06, label: 'Move layer lower' });
  if (target && !wantsOverlay && /move (?:it )?(?:a little |slightly )?left/.test(lower)) commands.push({ type: 'setPosition', layerId: target, dx: -0.06, label: 'Move layer left' });
  if (target && !wantsOverlay && /move (?:it )?(?:a little |slightly )?right/.test(lower)) commands.push({ type: 'setPosition', layerId: target, dx: 0.06, label: 'Move layer right' });
  if (target && !wantsOverlay && positionFromText(text) && /(move|put|place)/i.test(text)) commands.push({ type: 'setPosition', layerId: target, position: positionFromText(text), label: 'Move layer' });

  const end = exactEnd(text);
  if (target && end != null && !wantsOverlay) commands.push({ type: 'setDuration', layerId: target, end, label: 'Change layer end time' });

  const removeFirst = text.match(/remove (?:the )?first\s+(\d+(?:\.\d+)?)\s*(?:seconds?|s)/i);
  if (removeFirst && context.project.layers[0]) commands.push({ type: 'trimClip', layerId: context.project.layers[0].id, trimStart: Number(removeFirst[1]), label: 'Trim beginning' });
  const removeLast = text.match(/remove (?:the )?(?:final|last)\s+(\d+(?:\.\d+)?)\s*(?:seconds?|s)/i);
  if (removeLast && context.project.layers[0]) {
    const layer = context.project.layers[0];
    commands.push({ type: 'setDuration', layerId: layer.id, end: Math.max(layer.start, layer.end - Number(removeLast[1])), label: 'Trim ending' });
  }

  const quoted = text.match(/["“]([^"”]{1,200})["”]/)?.[1];
  if (quoted && /(add|finish|title|text|say|write|with)/i.test(text)) {
    const endAt = context.project.duration || 8;
    const startAt = /finish|end/i.test(text) ? Math.max(0, endAt - 2.5) : seconds(text, 0);
    commands.push({ type: 'addText', layerId: uid('text'), text: quoted, start: startAt, end: Math.max(startAt + 0.5, endAt), position: /above|top/i.test(text) ? 'top' as never : 'center', style: { fontSize: 64, weight: 700 }, label: `Add text “${quoted}”` });
  }

  if (!commands.length) throw new Error('I could not map that request to a safe deterministic edit yet. Select the layer or include the exact asset/time/position you want.');
  const parsed = studioCommandListSchema.parse(commands);
  const lastLayerId = [...parsed].reverse().find((item) => 'layerId' in item)?.layerId ?? currentTarget;
  return { execution: 'local', summary: parsed.map((item) => item.label ?? item.type).join(' · '), commands: parsed, costCredits: 0, requiresConfirmation: parsed.length > 3, context: { lastLayerId } };
}

function presetPosition(position: z.infer<typeof positionPresetSchema>) {
  const safe = 0.12;
  switch (position) {
    case 'left': return { x: 0.22, y: 0.5 };
    case 'right': return { x: 0.78, y: 0.5 };
    case 'top-left': return { x: 0.22, y: safe + 0.12 };
    case 'top-right': return { x: 0.78, y: safe + 0.12 };
    case 'bottom-left': return { x: 0.22, y: 1 - safe - 0.12 };
    case 'bottom-right': return { x: 0.78, y: 1 - safe - 0.12 };
    default: return { x: 0.5, y: 0.5 };
  }
}

export function applyStudioCommands(inputState: unknown, inputCommands: unknown) {
  const state = studioProjectStateSchema.parse(inputState);
  const commands = studioCommandListSchema.parse(inputCommands);
  const next: StudioProjectState = structuredClone(state);

  const find = (id: string) => {
    const layer = next.layers.find((item) => item.id === id);
    if (!layer) throw new Error(`Layer ${id} does not exist.`);
    return layer;
  };

  for (const command of commands) {
    switch (command.type) {
      case 'addOverlay': {
        const pos = command.position ? presetPosition(command.position) : { x: command.x ?? 0.5, y: command.y ?? 0.5 };
        if (command.end <= command.start) throw new Error('Overlay duration must be positive.');
        next.layers.push(studioLayerSchema.parse({ id: command.layerId, type: 'image', name: 'Overlay', assetId: command.assetId, start: command.start, end: command.end, x: command.x ?? pos.x, y: command.y ?? pos.y, width: command.scale ?? 0.3, height: command.scale ?? 0.3, opacity: 1 }));
        next.selectedLayerId = command.layerId;
        next.duration = Math.max(next.duration, command.end);
        break;
      }
      case 'setPosition': {
        const layer = find(command.layerId);
        const pos = command.position ? presetPosition(command.position) : null;
        layer.x = Math.min(0.95, Math.max(0.05, command.x ?? (pos?.x ?? layer.x) + (command.dx ?? 0)));
        layer.y = Math.min(0.95, Math.max(0.05, command.y ?? (pos?.y ?? layer.y) + (command.dy ?? 0)));
        break;
      }
      case 'setScale': { const layer = find(command.layerId); const value = command.scale ?? layer.width * (command.factor ?? 1); layer.width = Math.min(1.5, Math.max(0.04, value)); layer.height = Math.min(1.5, Math.max(0.04, value)); break; }
      case 'setDuration': { const layer = find(command.layerId); if (command.start != null) layer.start = command.start; if (command.end != null) layer.end = command.end; if (layer.end < layer.start) throw new Error('Layer end must be after start.'); next.duration = Math.max(next.duration, layer.end); break; }
      case 'setOpacity': find(command.layerId).opacity = command.opacity; break;
      case 'setRotation': find(command.layerId).rotation = command.rotation; break;
      case 'setVolume': find(command.layerId).volume = command.volume; break;
      case 'trimClip': { const layer = find(command.layerId); if (command.trimStart != null) layer.trimStart = command.trimStart; if (command.trimEnd != null) layer.trimEnd = command.trimEnd; break; }
      case 'deleteClip': next.layers = next.layers.filter((item) => item.id !== command.layerId); if (next.selectedLayerId === command.layerId) next.selectedLayerId = null; break;
      case 'splitClip': { const layer = find(command.layerId); if (command.at <= layer.start || command.at >= layer.end) throw new Error('Split point must be inside the clip.'); const clone = structuredClone(layer); clone.id = command.newLayerId; clone.start = command.at; layer.end = command.at; next.layers.push(clone); break; }
      case 'addText': { const pos = presetPosition(command.position ?? 'center'); next.layers.push(studioLayerSchema.parse({ id: command.layerId, type: 'text', name: 'Text', text: command.text, start: command.start, end: command.end, x: pos.x, y: pos.y, width: 0.7, height: 0.16, style: command.style ?? {}, opacity: 1 })); next.selectedLayerId = command.layerId; next.duration = Math.max(next.duration, command.end); break; }
      case 'updateText': find(command.layerId).text = command.text; break;
      case 'changeAspectRatio': { next.canvas.aspectRatio = command.aspectRatio; if (command.aspectRatio === '9:16') { next.canvas.width = 1080; next.canvas.height = 1920; } else if (command.aspectRatio === '1:1') { next.canvas.width = 1080; next.canvas.height = 1080; } else { next.canvas.width = 1920; next.canvas.height = 1080; } break; }
      case 'setProjectDuration': next.duration = command.duration; next.layers = next.layers.map((layer) => ({ ...layer, end: Math.min(layer.end, command.duration) })); break;
      case 'addTransition': { const layer = find(command.layerId); if (command.edge === 'in') layer.transitionIn = command.transition; else layer.transitionOut = command.transition; break; }
      case 'addEffect': { const layer = find(command.layerId); if (!layer.effects.includes(command.effect)) layer.effects.push(command.effect); break; }
      case 'reorderLayer': { const index = next.layers.findIndex((item) => item.id === command.layerId); if (index < 0) throw new Error(`Layer ${command.layerId} does not exist.`); const [layer] = next.layers.splice(index, 1); next.layers.splice(Math.min(command.index, next.layers.length), 0, layer); break; }
    }
  }
  return studioProjectStateSchema.parse(next);
}

export function emptyStudioProjectState(kind: 'video' | 'image', aspectRatio: '16:9' | '9:16' | '1:1' = kind === 'image' ? '1:1' : '9:16'): StudioProjectState {
  const canvas = aspectRatio === '9:16' ? { width: 1080, height: 1920, aspectRatio, background: '#05030b' }
    : aspectRatio === '1:1' ? { width: 1080, height: 1080, aspectRatio, background: '#05030b' }
    : { width: 1920, height: 1080, aspectRatio, background: '#05030b' };
  return studioProjectStateSchema.parse({ canvas, duration: kind === 'image' ? 5 : 0, layers: [], selectedLayerId: null, captions: [], metadata: { kind } });
}
