import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
    buildNameSizeQuery,
    buildSizeHashQuery,
    buildSizeQuery,
    detectEverything,
    isEverything15,
    searchEverything,
} from './everything.js';
import { formatSize } from './format.js';

const SIZE_HIT_CAP = 25;

export function sameResolvedPath(a, b) {
    return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

export function classifyHits(inputPath, nameHits, sizeHits) {
    const ext = path.extname(inputPath).toLowerCase();
    const sameNameAndSize = nameHits.filter(hit => !sameResolvedPath(hit.path, inputPath));
    const known = [inputPath, ...sameNameAndSize.map(hit => hit.path)];
    const sizeOnly = sizeHits.filter(hit => {
        if (known.some(item => sameResolvedPath(item, hit.path))) return false;
        if (ext && path.extname(hit.path).toLowerCase() !== ext) return false;
        return true;
    });
    return { sameNameAndSize, sizeOnly };
}

export function sha256File(filePath, readStreamFn = fs.createReadStream) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = readStreamFn(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

export function formatDupeReportLines({
    folder,
    everythingVersion,
    hashEnabled,
    rows,
}) {
    const withName = rows.filter(row => row.sameNameAndSize.length > 0);
    const withSize = rows.filter(row => row.sameNameAndSize.length === 0 && row.sizeOnly.length > 0);
    const unique = rows.filter(row => row.sameNameAndSize.length === 0 && row.sizeOnly.length === 0);
    const errors = rows.filter(row => row.error);

    const lines = [
        'MediaTuna duplicate report (Everything)',
        `Folder: ${folder}`,
        `Everything: ${everythingVersion}${hashEnabled ? ' | hash confirm' : ''}`,
        `Files: ${rows.length}  name+size copies: ${withName.length}  size-only: ${withSize.length}  unique: ${unique.length}${errors.length ? `  errors: ${errors.length}` : ''}`,
        '',
    ];

    const section = (title, list, pick) => {
        if (list.length === 0) return;
        lines.push(`## ${title}`);
        for (const row of list) {
            lines.push(`${path.basename(row.input)}  (${formatSize(row.size)})`);
            for (const hit of pick(row).slice(0, SIZE_HIT_CAP)) {
                const note = hit.hashMatch === true
                    ? '  [hash match]'
                    : hit.hashMatch === false
                        ? '  [hash differs]'
                        : '';
                lines.push(`  ${hit.path}${note}`);
            }
            if (pick(row).length > SIZE_HIT_CAP) {
                lines.push(`  … ${pick(row).length - SIZE_HIT_CAP} more`);
            }
            lines.push('');
        }
    };

    section('Name + size', withName, row => row.sameNameAndSize);
    section('Size + same extension (name differs — possible renamed copy)', withSize, row => row.sizeOnly);

    if (unique.length > 0) {
        lines.push('## No other copies found');
        for (const row of unique) {
            lines.push(`${path.basename(row.input)}  (${formatSize(row.size)})`);
        }
        lines.push('');
    }

    if (errors.length > 0) {
        lines.push('## Errors');
        for (const row of errors) {
            lines.push(`${path.basename(row.input)}: ${row.error}`);
        }
        lines.push('');
    }

    return lines;
}

export async function buildDupeRows(files, {
    searchFn,
    hashFn = null,
    useEverythingHash = false,
} = {}) {
    const rows = [];
    for (const input of files) {
        let size;
        try {
            size = fs.statSync(input).size;
        } catch (err) {
            rows.push({
                input, size: 0, sameNameAndSize: [], sizeOnly: [],
                error: `stat failed: ${err.message}`,
            });
            continue;
        }

        try {
            const ext = path.extname(input).replace(/^\./, '').toLowerCase();
            const nameHits = searchFn(buildNameSizeQuery(path.basename(input), size));
            const sizeHits = searchFn(buildSizeQuery(size, ext));
            const classified = classifyHits(input, nameHits, sizeHits);

            if (hashFn && classified.sizeOnly.length > 0) {
                if (useEverythingHash) {
                    const digest = await hashFn(input);
                    const hashHits = searchFn(buildSizeHashQuery(size, digest, ext));
                    classified.sizeOnly = classified.sizeOnly.map(hit => ({
                        ...hit,
                        hashMatch: hashHits.some(other => sameResolvedPath(other.path, hit.path)),
                    }));
                } else {
                    const sourceHash = await hashFn(input);
                    const confirmed = [];
                    for (const hit of classified.sizeOnly.slice(0, SIZE_HIT_CAP)) {
                        try {
                            const digest = await hashFn(hit.path);
                            confirmed.push({ ...hit, hashMatch: digest === sourceHash });
                        } catch (err) {
                            confirmed.push({ ...hit, hashMatch: null, error: err.message });
                        }
                    }
                    classified.sizeOnly = confirmed;
                }
            }

            rows.push({
                input,
                size,
                sameNameAndSize: classified.sameNameAndSize,
                sizeOnly: classified.sizeOnly,
                error: null,
            });
        } catch (err) {
            rows.push({
                input, size, sameNameAndSize: [], sizeOnly: [],
                error: err.message,
            });
        }
    }
    return rows;
}

export async function runDupeReport({
    files,
    rootDir,
    hash = false,
    dryRun = false,
    detectFn = detectEverything,
    searchFn = null,
    hashFn = sha256File,
    writeFileFn = fs.writeFileSync,
} = {}) {
    const everything = detectFn();
    const query = searchFn ?? ((q) => searchEverything(q, {
        esPath: everything.esPath,
        instance: everything.instance,
    }));

    const rows = await buildDupeRows(files, {
        searchFn: query,
        hashFn: hash ? hashFn : null,
        useEverythingHash: hash && isEverything15(everything.version),
    });

    const lines = formatDupeReportLines({
        folder: rootDir,
        everythingVersion: everything.version.raw,
        hashEnabled: hash,
        rows,
    });

    const reportPath = path.join(rootDir, 'mediatuna-dupe-report.txt');
    if (!dryRun) writeFileFn(reportPath, lines.join('\n') + '\n');

    return {
        lines,
        rows,
        reportPath: dryRun ? null : reportPath,
        everything,
        stats: {
            files: rows.length,
            nameCopies: rows.filter(r => r.sameNameAndSize.length > 0).length,
            sizeOnly: rows.filter(r => r.sameNameAndSize.length === 0 && r.sizeOnly.length > 0).length,
            unique: rows.filter(r => !r.error && r.sameNameAndSize.length === 0 && r.sizeOnly.length === 0).length,
            errors: rows.filter(r => r.error).length,
        },
    };
}
