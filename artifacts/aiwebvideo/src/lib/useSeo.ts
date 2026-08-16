import { useEffect } from 'react';

const SITE_NAME = 'AiWebVideo';
const BASE_URL = (import.meta.env.NEXT_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(path: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', `${BASE_URL}${path}`);
}

/**
 * This app is a client-rendered SPA (Vite + React, no server-side rendering)
 * with a single static index.html, so without this hook every route shares
 * the exact same <title>/meta description/canonical — Google indexes every
 * page identically, which hurts both ranking (no page-specific keyword
 * signal) and click-through rate in search results (every result in a SERP
 * looks the same). Google's crawler does execute JS and read the final DOM,
 * so updating these tags client-side on mount is a real, working technique
 * for SPAs without SSR — just call this once per page component.
 *
 * Pass noindex for authenticated/private app pages (dashboard, profile,
 * admin) that have no public SEO value and should never appear in search
 * results in the first place.
 */
export function useSeo(options: { title: string; description: string; path: string; noindex?: boolean }) {
  useEffect(() => {
    const fullTitle = options.title === SITE_NAME ? SITE_NAME : `${options.title} · ${SITE_NAME}`;
    document.title = fullTitle;
    setMeta('name', 'description', options.description);
    setMeta('name', 'robots', options.noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(options.path);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', options.description);
    setMeta('property', 'og:url', `${BASE_URL}${options.path}`);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', options.description);
  }, [options.title, options.description, options.path, options.noindex]);
}
