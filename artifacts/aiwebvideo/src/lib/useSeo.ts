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

function setStructuredData(options: { title: string; description: string; path: string; noindex?: boolean; faq?: ReadonlyArray<readonly [string, string]> }) {
  let script = document.head.querySelector<HTMLScriptElement>('script#site-structured-data');
  if (options.noindex) {
    script?.remove();
    return;
  }

  if (!script) {
    script = document.createElement('script');
    script.id = 'site-structured-data';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const canonical = `${BASE_URL}${options.path}`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: `${BASE_URL}/`,
      name: SITE_NAME,
      alternateName: ['AI Web Video', 'AiWebVideo.com'],
      publisher: { '@id': `${BASE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: SITE_NAME,
      url: `${BASE_URL}/`,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-512.png`, width: 512, height: 512 },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE_URL}/#application`,
      name: SITE_NAME,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: `${BASE_URL}/`,
      description: 'AI website video generator that turns public website context and a campaign goal into AI-directed marketing video.',
      publisher: { '@id': `${BASE_URL}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: options.title,
      description: options.description,
      isPartOf: { '@id': `${BASE_URL}/#website` },
      about: { '@id': `${BASE_URL}/#application` },
    },
  ];

  if (options.path !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: options.title, item: canonical },
      ],
    });
  }

  if (options.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      url: canonical,
      mainEntity: options.faq.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }

  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

export function useSeo(options: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  faq?: ReadonlyArray<readonly [string, string]>;
}) {
  useEffect(() => {
    const fullTitle = options.title === SITE_NAME ? SITE_NAME : `${options.title} | ${SITE_NAME}`;
    document.title = fullTitle;
    setMeta('name', 'description', options.description);
    setMeta('name', 'robots', options.noindex ? 'noindex, nofollow' : 'index, follow');
    setMeta(
      'name',
      'googlebot',
      options.noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    );
    setCanonical(options.path);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', options.description);
    setMeta('property', 'og:url', `${BASE_URL}${options.path}`);
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', 'website');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', options.description);
    setStructuredData({ ...options, title: fullTitle });
  }, [options.title, options.description, options.path, options.noindex, options.faq]);
}
