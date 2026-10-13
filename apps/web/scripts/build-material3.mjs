import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const webDir = resolve(scriptDir, '..');
const outputDir = resolve(webDir, 'public');
await mkdir(outputDir, { recursive: true });

const bundle = await rollup({
  input: resolve(webDir, 'material3-entry.js'),
  plugins: [nodeResolve({ browser: true })],
});

await bundle.write({
  file: resolve(outputDir, 'material3.js'),
  format: 'iife',
  name: 'TezMindMaterial3',
  sourcemap: false,
});
await bundle.close();
console.log('Built Material 3 Web Components runtime.');
