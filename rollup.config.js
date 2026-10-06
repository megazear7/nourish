import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/client/app.ts',
  output: {
    file: 'dist/client/bundle.js',
    format: 'esm',
  },
  onwarn(warning) {
    if (warning.code !== 'THIS_IS_UNSUPPORTED_FEATURE' && warning.code !== 'THIS_IS_PURE') {
      console.error(`(!) ${warning.message}`);
    }
  },
  plugins: [
    replace({ preventAssignment: false, 'Reflect.decorate': 'undefined' }),
    typescript({
      declaration: false,
      declarationMap: false,
      outDir: 'dist/client',
    }),
    resolve(),
  ],
};