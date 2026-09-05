export function normalizeWebsiteUrl(input: string): string {
  let value = input.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\s+/g, '');
  if (!value) throw new Error('Enter your website name.');
  const slash = value.indexOf('/');
  const host = slash >= 0 ? value.slice(0, slash) : value;
  const rest = slash >= 0 ? value.slice(slash) : '';
  if (!host.includes('.') && host !== 'localhost') value = `${host}.com${rest}`;
  const url = new URL(`https://${value}`);
  if (!url.hostname || !/^[a-z0-9.-]+$/i.test(url.hostname)) throw new Error('Enter a website name such as mysite.com.');
  return url.toString().replace(/\/$/, '');
}
