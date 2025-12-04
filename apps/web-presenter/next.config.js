/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arena-event/shared', '@arena-event/ui'],
};

module.exports = nextConfig;
