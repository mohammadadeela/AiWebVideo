export interface SiteImage { label: string; buffer: Buffer; mimeType: string }

/** Map imagery (satellite and Street View) is OFF unless the site owner turned it on AND set a key. See site-imagery.ts. */
export function siteImageryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ARCHITECTURE_MAPS_IMAGERY === '1' && Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
}
