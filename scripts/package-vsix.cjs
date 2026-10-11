const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const YAML = require('yaml');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const workspaceConfigPath = path.join(repoRoot, 'pnpm-workspace.yaml');
const distDir = path.join(repoRoot, 'dist');
const artifactsDir = path.join(repoRoot, 'artifacts', 'vsix');
const vscePackageRoot = path.dirname(require.resolve('@vscode/vsce/package.json'));
const vsceDependencyRoot = path.resolve(vscePackageRoot, '..', '..');
const vsceCliPath = require.resolve('@vscode/vsce/vsce');

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function materializeCatalogSection(section, catalog) {
  if (!section) {
    return section;
  }

  const nextSection = { ...section };

  for (const [dependencyName, specifier] of Object.entries(section)) {
    if (typeof specifier !== 'string' || !specifier.startsWith('catalog:')) {
      continue;
    }

    const catalogEntryName =
      specifier === 'catalog:' ? dependencyName : specifier.slice('catalog:'.length);
    const resolvedVersion = catalog[catalogEntryName];

    if (!resolvedVersion) {
      throw new Error(
        `Missing catalog entry for "${catalogEntryName}" required by "${dependencyName}".`,
      );
    }

    nextSection[dependencyName] = String(resolvedVersion);
  }

  return nextSection;
}

function materializeCatalogSpecifiers(manifest, catalog) {
  return {
    ...manifest,
    dependencies: materializeCatalogSection(manifest.dependencies, catalog),
    devDependencies: materializeCatalogSection(manifest.devDependencies, catalog),
    optionalDependencies: materializeCatalogSection(manifest.optionalDependencies, catalog),
    peerDependencies: materializeCatalogSection(manifest.peerDependencies, catalog),
  };
}

async function copyIfExists(sourcePath, destinationPath) {
  if (!(await pathExists(sourcePath))) {
    return;
  }

  await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
}

async function createStageDirectory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'auto-pull-vsix-'));
}

async function stageRuntimeFiles(stageDir) {
  if (!(await pathExists(distDir))) {
    throw new Error('Missing "dist" directory. Run "pnpm run bundle:prod" before packaging.');
  }

  await fs.cp(distDir, path.join(stageDir, 'dist'), { recursive: true, force: true });
  await copyIfExists(path.join(repoRoot, 'README.md'), path.join(stageDir, 'README.md'));
  await copyIfExists(path.join(repoRoot, 'CHANGELOG.md'), path.join(stageDir, 'CHANGELOG.md'));
  await copyIfExists(path.join(repoRoot, 'LICENSE'), path.join(stageDir, 'LICENSE'));
  await copyIfExists(path.join(repoRoot, 'LICENSE.md'), path.join(stageDir, 'LICENSE.md'));
  await copyIfExists(path.join(repoRoot, 'LICENSE.txt'), path.join(stageDir, 'LICENSE.txt'));
  await copyIfExists(path.join(repoRoot, '.vscodeignore'), path.join(stageDir, '.vscodeignore'));
}

async function linkStageNodeModules(stageDir) {
  await fs.symlink(
    vsceDependencyRoot,
    path.join(stageDir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
}

async function stageManifest(stageDir) {
  const manifest = await readJson(packageJsonPath);
  const workspaceConfig = YAML.parse(await fs.readFile(workspaceConfigPath, 'utf8'));
  const stagedManifest = materializeCatalogSpecifiers(
    structuredClone(manifest),
    workspaceConfig.catalog ?? {},
  );

  await fs.writeFile(
    path.join(stageDir, 'package.json'),
    `${JSON.stringify(stagedManifest, null, 2)}\n`,
    'utf8',
  );

  return manifest;
}

function runVsce(stageDir, extensionName, extensionVersion) {
  const outputFile = path.join(artifactsDir, `${extensionName}-${extensionVersion}.vsix`);
  const result = spawnSync(
    process.execPath,
    [vsceCliPath, 'package', '--no-dependencies', '--out', outputFile],
    {
      cwd: stageDir,
      env: {
        ...process.env,
        NODE_PATH: vsceDependencyRoot,
      },
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`VSIX written to ${outputFile}`);
}

async function main() {
  await fs.mkdir(artifactsDir, { recursive: true });

  const stageDir = await createStageDirectory();
  try {
    await stageRuntimeFiles(stageDir);
    await linkStageNodeModules(stageDir);
    const manifest = await stageManifest(stageDir);
    runVsce(stageDir, manifest.name, manifest.version);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
