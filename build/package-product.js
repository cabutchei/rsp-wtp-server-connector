const path = require('path');
const fs = require('fs-extra');
const { spawnSync } = require('child_process');

const connectorRoot = path.resolve(__dirname, '..');
const defaultProductEclipseDir = path.resolve(
    connectorRoot,
    '..',
    'rsp-wtp-server',
    'distribution',
    'distribution',
    'target',
    'products',
    'com.github.cabutchei.rsp.server.product',
    'macosx',
    'cocoa',
    'x86_64',
    'rsp-wtp-server.app',
    'Contents',
    'Eclipse'
);

const productEclipseDir = path.resolve(
    process.env.RSP_PRODUCT_ECLIPSE_DIR || defaultProductEclipseDir
);
const sourceConfigurationDir = path.join(productEclipseDir, 'configuration');
const sourcePluginsDir = path.join(productEclipseDir, 'plugins');

const targetServerDir = path.join(connectorRoot, 'server');
const targetConfigurationDir = path.join(targetServerDir, 'configuration');
const targetPluginsDir = path.join(targetServerDir, 'plugins');
const distDir = path.join(connectorRoot, 'dist');

function ensureSourceExists(dir, label) {
    if (!fs.existsSync(dir)) {
        throw new Error(`${label} not found: ${dir}`);
    }
}

function runVscePackage() {
    const pkg = fs.readJsonSync(path.join(connectorRoot, 'package.json'));
    const outputVsix = path.join(distDir, `${pkg.name}-${pkg.version}.vsix`);
    const vsceCmd = process.platform === 'win32' ? 'vsce.cmd' : 'vsce';
    const result = spawnSync(vsceCmd, ['package', '--out', outputVsix], {
        cwd: connectorRoot,
        stdio: 'inherit',
        shell: false
    });

    if (result.error) {
        if (result.error.code === 'ENOENT') {
            throw new Error(
                "Could not find 'vsce' in PATH. Install it globally or run with a PATH that includes vsce."
            );
        }
        throw result.error;
    }
    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`vsce package failed with exit code ${result.status}`);
    }
    console.log(`Packaged extension: ${outputVsix}`);
}

async function main() {
    console.log(`Using product Eclipse directory: ${productEclipseDir}`);
    ensureSourceExists(sourceConfigurationDir, 'Product configuration directory');
    ensureSourceExists(sourcePluginsDir, 'Product plugins directory');

    await fs.ensureDir(targetServerDir);
    await fs.ensureDir(distDir);
    await fs.remove(targetConfigurationDir);
    await fs.remove(targetPluginsDir);

    console.log(`Copying configuration -> ${targetConfigurationDir}`);
    await fs.copy(sourceConfigurationDir, targetConfigurationDir);
    console.log(`Copying plugins -> ${targetPluginsDir}`);
    await fs.copy(sourcePluginsDir, targetPluginsDir);

    console.log('Running vsce package...');
    runVscePackage();
}

main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
