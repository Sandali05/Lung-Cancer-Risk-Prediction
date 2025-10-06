// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const normalizeBase = (value) => {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : undefined;
};

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")?.[1];
const explicitBase =
  process.env.NEXT_PUBLIC_GITHUB_PAGES_BASE ||
  process.env.GITHUB_PAGES_BASE ||
  process.env.NEXT_PUBLIC_BASE_PATH ||
  process.env.BASE_PATH;

const base = normalizeBase(
  (isGithubActions && repoName) ? repoName : explicitBase
);

const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  assetPrefix: base ? `${base}/` : "./",
  basePath: base,
  trailingSlash: true,
};

module.exports = nextConfig;
