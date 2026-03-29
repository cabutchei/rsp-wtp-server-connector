const path = require('path');
const fs = require('fs-extra');
const download = require('download');
const decompress = require('decompress');

const connectorRoot = path.resolve(__dirname, '..');
const targetServerDir = path.join(connectorRoot, 'server');
const defaultLatestUrl = 'https://raw.githubusercontent.com/cabutchei/rsp-wtp-server/refs/heads/master/LATEST';
const latestUrl = process.env.RSP_SERVER_LATEST_URL || defaultLatestUrl;
const latestVersionKey = 'com.github.cabutchei.rsp.distribution.latest.version';
const latestArchiveUrlKey = 'com.github.cabutchei.rsp.distribution.latest.url';

function parseLatest(text) {
    const values = new Map();
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separator = line.indexOf('=');
        if (separator === -1) {
            continue;
        }
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        values.set(key, value);
    }
    const version = values.get(latestVersionKey);
    const archiveUrl = values.get(latestArchiveUrlKey);
    if (!archiveUrl) {
        throw new Error(`Missing '${latestArchiveUrlKey}' in ${latestUrl}`);
    }
    return { version, archiveUrl };
}

function archiveFileName(archiveUrl) {
    return path.basename(new URL(archiveUrl).pathname);
}

async function main() {
    console.log(`Downloading ${latestUrl}`);
    const latestBuffer = await download(latestUrl);
    const latestText = latestBuffer.toString('utf8');

    const latest = parseLatest(latestText);
    console.log(`Resolved server bundle${latest.version ? ` ${latest.version}` : ''} from ${latest.archiveUrl}`);

    await fs.remove(targetServerDir);
    await fs.ensureDir(targetServerDir);

    const archiveUrl = latest.archiveUrl;
    const archiveName = archiveFileName(archiveUrl);
    console.log(`Downloading ${archiveUrl}`);
    await download(archiveUrl, connectorRoot);

    console.log(`Extracting ${archiveName} -> ${targetServerDir}`);
    await decompress(path.join(connectorRoot, archiveName), targetServerDir, { strip: 1 });
    await fs.remove(path.join(connectorRoot, archiveName));
}

main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
