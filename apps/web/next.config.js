/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pulseclinic/types', '@pulseclinic/config'],
};

module.exports = nextConfig;
