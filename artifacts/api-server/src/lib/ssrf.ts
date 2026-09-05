import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

const BLOCKED_SCHEMES = new Set(['file', 'ftp', 'gopher', 'data', 'dict', 'smtp', 'ldap']);

// Ranges that ipaddr.js's addr.range() returns for non-public addresses
const PRIVATE_RANGES = new Set([
  'private',
  'loopback',
  'linkLocal',
  'multicast',
  'unspecified',
  'carrierGradeNat',
  'broadcast',
  'reserved',
  'uniqueLocal',   // IPv6 ULA (fc00::/7)
  'ipv4Mapped',    // block ::ffff:10.x.x.x etc
]);

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfError';
  }
}

function isPrivateIP(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();
    return PRIVATE_RANGES.has(range);
  } catch {
    // Fail closed. An address we cannot classify must never be treated as
    // public merely because a resolver returned it.
    return true;
  }
}

export async function validateUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError('Invalid URL format.');
  }

  const scheme = parsed.protocol.replace(':', '');
  if (BLOCKED_SCHEMES.has(scheme)) {
    throw new SsrfError(`Scheme "${parsed.protocol}" is not allowed.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SsrfError('Only http and https URLs are allowed.');
  }

  const hostname = parsed.hostname;

  // If the host is already a raw IP, check it directly
  if (ipaddr.isValid(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new SsrfError('Access to private IP addresses is not allowed.');
    }
    return parsed.toString();
  }

  // Resolve hostname and check all returned IPs
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new SsrfError(`Cannot resolve host "${hostname}".`);
  }

  if (!addresses || addresses.length === 0) {
    throw new SsrfError(`Cannot resolve host "${hostname}".`);
  }

  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new SsrfError(`Host "${hostname}" resolves to a private IP address.`);
    }
  }

  return parsed.toString();
}
