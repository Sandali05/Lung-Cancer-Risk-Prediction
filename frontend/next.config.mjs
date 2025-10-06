/**
 * @type {import('next').NextConfig}
 */

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
let assetPrefix;
let basePath;

if (isGithubActions) {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1];

  if (repoName) {
    assetPrefix = `/${repoName}/`;
    basePath = `/${repoName}`;
  }
}

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  assetPrefix,
  basePath,
  trailingSlash: true,
};

module.exports = nextConfig;
