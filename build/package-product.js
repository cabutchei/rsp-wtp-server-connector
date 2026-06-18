const path = require('path');
const fs = require('fs-extra');
const { spawnSync } = require('child_process');

const connectorRoot = path.resolve(__dirname, '..');
const defaultMacProductEclipseDir = path.resolve(
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
const defaultWinProductEclipseDir = path.resolve(
    connectorRoot,
    '..',
    'rsp-wtp-server',
    'distribution',
    'distribution',
    'target',
    'products',
    'com.github.cabutchei.rsp.server.product',
    'win32',
    'win32',
    'x86_64',
    'rsp-wtp-server'
);
const productEclipseDirs = {
    mac: path.resolve(process.env.RSP_PRODUCT_ECLIPSE_DIR_MAC || process.env.RSP_PRODUCT_ECLIPSE_DIR || defaultMacProductEclipseDir),
    win: path.resolve(process.env.RSP_PRODUCT_ECLIPSE_DIR_WIN || defaultWinProductEclipseDir)
};

const targetServerDir = path.join(connectorRoot, 'server');
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
    const sourceConfigurations = [
        {
            label: 'macOS product configuration directory',
            source: path.join(productEclipseDirs.mac, 'configuration'),
            target: path.join(targetServerDir, 'config_mac')
        },
        {
            label: 'Windows product configuration directory',
            source: path.join(productEclipseDirs.win, 'configuration'),
            target: path.join(targetServerDir, 'config_win')
        }
    ];
    const sourcePluginsDirs = [
        {
            label: 'macOS product plugins directory',
            source: path.join(productEclipseDirs.mac, 'plugins')
        },
        {
            label: 'Windows product plugins directory',
            source: path.join(productEclipseDirs.win, 'plugins')
        }
    ];

    console.log(`Using macOS product Eclipse directory: ${productEclipseDirs.mac}`);
    console.log(`Using Windows product Eclipse directory: ${productEclipseDirs.win}`);
    sourceConfigurations.forEach(entry => ensureSourceExists(entry.source, entry.label));
    sourcePluginsDirs.forEach(entry => ensureSourceExists(entry.source, entry.label));

    await fs.ensureDir(targetServerDir);
    await fs.ensureDir(distDir);
    await fs.remove(path.join(targetServerDir, 'configuration'));
    await fs.remove(path.join(targetServerDir, 'config_mac'));
    await fs.remove(path.join(targetServerDir, 'config_win'));
    await fs.remove(targetPluginsDir);
    await fs.ensureDir(targetPluginsDir);

    for (const entry of sourceConfigurations) {
        console.log(`Copying ${entry.label} -> ${entry.target}`);
        await fs.copy(entry.source, entry.target);
    }
    for (const entry of sourcePluginsDirs) {
        console.log(`Merging ${entry.label} -> ${targetPluginsDir}`);
        await fs.copy(entry.source, targetPluginsDir);
    }

    console.log('Running vsce package...');
    runVscePackage();
}

main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
