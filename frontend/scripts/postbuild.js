/* eslint-disable @typescript-eslint/no-require-imports */
const { writeFileSync, mkdirSync } = require('fs');
const { dirname, join } = require('path');

const outDir = process.env.NEXT_EXPORT_OUT_DIR || 'out';
const target = join(__dirname, '..', outDir, '.nojekyll');

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, '');

console.log(`Created ${target} to disable GitHub Pages Jekyll processing.`);
