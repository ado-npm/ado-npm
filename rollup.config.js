import path from 'path';
import { promises as fs } from 'fs';
import shebang from 'rollup-plugin-preserve-shebang';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import external from 'rollup-plugin-node-externals';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

/** @type {import('rollup').RollupOptions} */
const config = {
  input: 'src/index.ts',
  output: {
    file: 'lib/index.js',
    format: 'cjs',
    sourcemap: true,
    inlineDynamicImports: true,
    interop: 'auto',
  },
  plugins: [
    shebang(),
    commonjs(),
    alias({ entries: [{ find: /^node(?:js)?:(.*)/, replacement: '$1' }] }),
    external({ deps: true, peerDeps: true, optDeps: true, devDeps: false }),
    resolve(),
    json(),
    typescript({
      tsconfig: path.resolve('tsconfig.json'),
      noEmitOnError: true,
      sourceMap: true,
      inlineSourceMap: false,
    }),
    terser(),
    {
      writeBundle: async ({ file }) => {
        if (file) {
          console.log(`Setting execute bits on "${file}"`);
          await fs.chmod(file, (await fs.stat(file)).mode | 0o111);
        }
      },
    },
  ],
};

export default config;
