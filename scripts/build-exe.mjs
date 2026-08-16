// Builds a standalone Windows odcanit-mcp.exe using Node's Single Executable
// Applications (SEA) feature, so end users don't need Node.js installed.
//
// Steps: bundle dist/ into one CJS file with esbuild, generate the SEA blob,
// fetch an official Windows Node.js binary to inject it into, then run
// postject to produce dist-bin/odcanit-mcp.exe.
import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import * as esbuild from 'esbuild';

const NODE_VERSION = 'v20.18.1';
const NODE_ZIP_URL = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const CACHE_DIR = '.cache';
const BUILD_DIR = 'build';
const OUT_DIR = 'dist-bin';
const NODE_ZIP_PATH = `${CACHE_DIR}/node-${NODE_VERSION}-win-x64.zip`;
const NODE_EXE_CACHE_PATH = `${CACHE_DIR}/node-${NODE_VERSION}-win-x64.exe`;
const OUT_EXE_PATH = `${OUT_DIR}/odcanit-mcp.exe`;

for (const dir of [CACHE_DIR, BUILD_DIR, OUT_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log('==> Bundling dist/index.js -> build/bundle.cjs');
await esbuild.build({
  entryPoints: ['dist/index.js'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: `${BUILD_DIR}/bundle.cjs`,
});

console.log('==> Generating SEA blob');
execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], { stdio: 'inherit' });

if (!existsSync(NODE_EXE_CACHE_PATH)) {
  console.log(`==> Downloading Node.js ${NODE_VERSION} (win-x64)`);
  const response = await fetch(NODE_ZIP_URL);
  if (!response.ok) {
    throw new Error(`Failed to download ${NODE_ZIP_URL}: ${response.status} ${response.statusText}`);
  }
  await finished(Readable.fromWeb(response.body).pipe(createWriteStream(NODE_ZIP_PATH)));

  console.log('==> Extracting node.exe');
  execFileSync('unzip', ['-o', '-j', NODE_ZIP_PATH, `node-${NODE_VERSION}-win-x64/node.exe`, '-d', CACHE_DIR], {
    stdio: 'inherit',
  });
  copyFileSync(`${CACHE_DIR}/node.exe`, NODE_EXE_CACHE_PATH);
} else {
  console.log(`==> Using cached Node.js ${NODE_VERSION} binary`);
}

console.log('==> Copying base binary to', OUT_EXE_PATH);
copyFileSync(NODE_EXE_CACHE_PATH, OUT_EXE_PATH);
chmodSync(OUT_EXE_PATH, 0o755);

console.log('==> Injecting SEA blob with postject');
execFileSync(
  process.execPath,
  [
    `${process.cwd()}/node_modules/postject/dist/cli.js`,
    OUT_EXE_PATH,
    'NODE_SEA_BLOB',
    `${BUILD_DIR}/sea-prep.blob`,
    '--sentinel-fuse',
    SEA_FUSE,
    '--overwrite',
  ],
  { stdio: 'inherit' }
);

console.log(`\nDone: ${OUT_EXE_PATH}`);
