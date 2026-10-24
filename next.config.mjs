/**
 * frame-ancestors allowlist for the edit-mode iframe: exactly the origins
 * in NEXT_PUBLIC_ADMIN_ORIGIN (comma-separated exact origins — same parse
 * as src/lib/edit-bridge.ts). Unset or nothing usable → 'none'.
 */
function frameAncestorsValue() {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ORIGIN;
  if (!raw) return "frame-ancestors 'none'";
  const origins = [];
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (!value || value.includes('*')) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        origins.push(url.origin);
      }
    } catch {
      // unusable entry — skip it
    }
  }
  const unique = [...new Set(origins)];
  return unique.length > 0
    ? `frame-ancestors ${unique.join(' ')}`
    : "frame-ancestors 'none'";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: frameAncestorsValue() },
        ],
      },
    ];
  },
};

export default nextConfig;