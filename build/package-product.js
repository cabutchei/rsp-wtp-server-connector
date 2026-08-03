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
const defaultBridgeJar = path.resolve(
    connectorRoot,
    'bundles',
    'com.github.cabutchei.jdtls.serverbridge-0.2.0.alpha.jar'
);

const targetServerDir = path.join(connectorRoot, 'server');
const targetPluginsDir = path.join(targetServerDir, 'plugins');
const distDir = path.join(connectorRoot, 'dist');

function ensureSourceExists(dir, label) {
    if (!fs.existsSync(dir)) {
        throw new Error(`${label} not found: ${dir}`);
    }
}

function readJavaExtensions() {
    const pkg = fs.readJsonSync(path.join(connectorRoot, 'package.json'));
    const contributes = pkg && pkg.contributes ? pkg.contributes : {};
    return Array.isArray(contributes.javaExtensions) ? contributes.javaExtensions : [];
}

function toServerRelativePath(extensionPath) {
    const prefix = './server/';
    if (!extensionPath.startsWith(prefix)) {
        throw new Error(`Unsupported javaExtensions path: ${extensionPath}`);
    }
    return extensionPath.slice(prefix.length);
}

function resolveJavaExtensionSource(serverRelativePath, sourcePluginsDirs, bridgeJar) {
    const baseName = path.basename(serverRelativePath);
    if (baseName === path.basename(bridgeJar)) {
        return { path: bridgeJar, kind: 'file' };
    }
    for (const entry of sourcePluginsDirs) {
        const candidate = path.join(entry.source, baseName);
        if (fs.existsSync(candidate)) {
            return { path: candidate, kind: 'file' };
        }
        if (baseName.endsWith('.jar')) {
            const directoryCandidate = path.join(entry.source, baseName.slice(0, -4));
            if (fs.existsSync(directoryCandidate) && fs.statSync(directoryCandidate).isDirectory()) {
                return { path: directoryCandidate, kind: 'directory' };
            }
        }
    }
    throw new Error(`Could not locate contributed Java extension '${baseName}' in the packaged product plugins.`);
}

function createBundleJarFromDirectory(sourceDir, targetFile) {
    const result = spawnSync('jar', ['--create', '--file', targetFile, '--no-manifest', '-C', sourceDir, '.'], {
        stdio: 'inherit',
        shell: false
    });
    if (result.error) {
        if (result.error.code === 'ENOENT') {
            throw new Error("Could not find 'jar' in PATH.");
        }
        throw result.error;
    }
    if (typeof result.status === 'number' && result.status !== 0) {
        throw new Error(`jar packaging failed with exit code ${result.status} for ${sourceDir}`);
    }
}

async function copyJavaExtensions(javaExtensions, sourcePluginsDirs, bridgeJar) {
    ensureSourceExists(bridgeJar, 'JDT LS bridge jar');
    for (const extensionPath of javaExtensions) {
        const serverRelativePath = toServerRelativePath(extensionPath);
        const source = resolveJavaExtensionSource(serverRelativePath, sourcePluginsDirs, bridgeJar);
        const target = path.join(targetServerDir, serverRelativePath);
        console.log(`Copying contributed Java extension ${source.path} -> ${target}`);
        await fs.ensureDir(path.dirname(target));
        if (source.kind === 'directory') {
            createBundleJarFromDirectory(source.path, target);
        } else {
            await fs.copy(source.path, target);
        }
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
    const javaExtensions = readJavaExtensions();
    const bridgeJar = path.resolve(process.env.RSP_JDTLS_BRIDGE_JAR || defaultBridgeJar);
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
    console.log(`Using JDT LS bridge jar: ${bridgeJar}`);
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
    await copyJavaExtensions(javaExtensions, sourcePluginsDirs, bridgeJar);

    console.log('Running vsce package...');
    runVscePackage();
}

main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
