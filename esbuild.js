const esbuild = require('esbuild');

const args = new Set(process.argv.slice(2));
const isProduction = args.has('--production');
const isWatch = args.has('--watch');

const watchStatusPlugin = {
  name: 'watch-status',
  setup(build) {
    build.onStart(() => {
      console.log('[watch:bundle] build started');
    });

    build.onEnd((result) => {
      for (const error of result.errors) {
        if (error.location) {
          console.error(
            `${error.location.file}:${error.location.line}:${error.location.column}: ERROR: ${error.text}`,
          );
          continue;
        }

        console.error(`esbuild:1:1: ERROR: ${error.text}`);
      }

      console.log('[watch:bundle] build finished');
    });
  },
};

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node26',
  sourcemap: true,
  external: ['vscode'],
  logLevel: isWatch ? 'silent' : 'info',
  minify: isProduction,
  plugins: isWatch ? [watchStatusPlugin] : [],
};

async function main() {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    return;
  }

  await esbuild.build(buildOptions);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
