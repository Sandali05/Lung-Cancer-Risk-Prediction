// @ts-check

const isStaticExport = process.env.NEXT_OUTPUT_MODE === 'export';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  ...(isStaticExport ? { output: 'export' } : {}),
};

module.exports = nextConfig;
