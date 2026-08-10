/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep server actions light; heartbeat pings are tiny JSON payloads.
    serverActions: {
      bodySizeLimit: '256kb',
    },
  },
};

module.exports = nextConfig;
