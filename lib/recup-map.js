import fs from 'fs';
import path from 'path';
import { AUDIO_EXTS, VIDEO_EXTS } from './constants.js';
import {
    buildSizeQuery,
    detectEverything,
    searchEverything,
} from './everything.js';
import { formatSize } from './format.js';

const JUNK_PATH = [
    /\\appdata\\/i,
    /\\photostructure\\/i,
    /\\node_modules\\/i,
    /\\windows\\/i,
    /\\program files/i,
    /\\\$recycle/i,
    /\\recup_dir\.\d+/i,
    /\\qmlcache\\/i,
    /\\\.svn\\/i,
    /\\previews\\/i,
    /\\huggingface_hub\\/i,
];

const GOOD_PATH = [
    /\\diskimages\\/i,
    /\\google drive\\/i,
    /\\voicenotes\\/i,
    /\\documents\\/i,
    /\\memories\\/i,
    /\\phonevoicenotes\\/i,
];

const ANCHORS = [
    'voicenotes', 'memories', 'documents', 'my documents', 'desktop',
    'pictures', 'music', 'google drive', 'phonevoicenotes', 'data',
];

export const DEFAULT_RECUP_EXTS = new Set([
    ...[...AUDIO_EXTS].map(e => e.slice(1)),
    ...[...VIDEO_EXTS].map(e => e.slice(1)),
]);

export function parseExtList(value) {
    if (!value) return new Set(DEFAULT_RECUP_EXTS);
    return new Set(String(value).split(/[,;\s]+/).map(e => e.replace(/^\./, '').toLowerCase()).filter(Boolean));
}

export function scoreHit(filePath) {
    let score = 0;
    for (const re of JUNK_PATH) {
        if (re.test(filePath)) score -= 50;
    }
    for (const re of GOOD_PATH) {
        if (re.test(filePath)) score += 20;
    }
    if (!/^f\d+/i.test(path.basename(filePath))) score += 10;
    return score;
}

export function proposedRelPath(filePath) {
    const parts = path.normalize(filePath).split(/[/\\]/).filter(Boolean);
    const idx = parts.findIndex(seg => ANCHORS.includes(seg.toLowerCase()));
    if (idx >= 0) return parts.slice(idx).join('/');
    return parts.slice(Math.max(1, parts.length - 3)).join('/');
}

export function pickPlacement(hits) {
    const ranked = hits
        .map(hit => ({ ...hit, score: scoreHit(hit.path), proposed: proposedRelPath(hit.path) }))
        .filter(hit => hit.score > 0)
        .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) return null;
    const best = ranked[0];
    const tied = ranked.filter(hit => hit.proposed !== best.proposed && hit.score >= best.score - 5);
    return {
        proposed: best.proposed,
        score: best.score,
        source: best.path,
        ambiguous: tied.length > 0,
        alts: tied.map(hit => hit.proposed),
        hits: ranked,
    };
}

export function discoverRecupFiles(root, extSet) {
    const files = [];
    if (!fs.existsSync(root)) return files;
    for (const name of fs.readdirSync(root)) {
        const full = path.join(root, name);
        let stat;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat.isFile()) {
            const ext = path.extname(name).slice(1).toLowerCase();
            if (!extSet.size || extSet.has(ext)) files.push(full);
            continue;
        }
        if (!stat.isDirectory()) continue;
        for (const file of fs.readdirSync(full)) {
            const child = path.join(full, file);
            try {
                if (!fs.statSync(child).isFile()) continue;
            } catch { continue; }
            const ext = path.extname(file).slice(1).toLowerCase();
            if (!extSet.size || extSet.has(ext)) files.push(child);
        }
    }
    return files.sort();
}

export function formatRecupMapLines({ folder, everythingVersion, rows, extList }) {
    const placed = rows.filter(row => row.placement && !row.placement.ambiguous);
    const ambiguous = rows.filter(row => row.placement?.ambiguous);
    const unmatched = rows.filter(row => !row.placement);
    const errors = rows.filter(row => row.error);

    const folders = new Map();
    for (const row of placed) {
        const dir = path.posix.dirname(row.placement.proposed).replace(/^\.$/, '(root)');
        if (!folders.has(dir)) folders.set(dir, []);
        folders.get(dir).push(row);
    }

    const lines = [
        'MediaTuna recuperated-folder map (Everything)',
        `Folder: ${folder}`,
        `Everything: ${everythingVersion}`,
        `Extensions: ${[...extList].sort().join(', ')}`,
        `Files: ${rows.length}  placed: ${placed.length}  ambiguous: ${ambiguous.length}  unmatched: ${unmatched.length}${errors.length ? `  errors: ${errors.length}` : ''}`,
        '',
        '## Proposed folders',
    ];

    for (const dir of [...folders.keys()].sort()) {
        lines.push(`${dir}/  (${folders.get(dir).length})`);
    }
    if (folders.size === 0) lines.push('(none)');
    lines.push('');

    lines.push('## Placed (copy found elsewhere)');
    if (placed.length === 0) lines.push('(none)');
    for (const row of placed) {
        lines.push(`${row.placement.proposed}  (${formatSize(row.size)})`);
        lines.push(`  from  ${row.input}`);
        lines.push(`  copy  ${row.placement.source}`);
        lines.push('');
    }

    if (ambiguous.length > 0) {
        lines.push('## Ambiguous (several plausible homes)');
        for (const row of ambiguous) {
            lines.push(`${path.basename(row.input)}  (${formatSize(row.size)})`);
            lines.push(`  from  ${row.input}`);
            lines.push(`  best  ${row.placement.proposed}`);
            for (const alt of row.placement.alts) lines.push(`  alt   ${alt}`);
            lines.push('');
        }
    }

    lines.push('## Unmatched (no useful copy outside this dump)');
    if (unmatched.length === 0) lines.push('(none)');
    for (const row of unmatched) {
        lines.push(`${row.input}  (${formatSize(row.size)})`);
    }
    lines.push('');

    if (errors.length > 0) {
        lines.push('## Errors');
        for (const row of errors) lines.push(`${row.input}: ${row.error}`);
        lines.push('');
    }

    return lines;
}

export async function buildRecupRows(files, {
    rootDir,
    searchFn,
    onProgress = null,
} = {}) {
    const rows = [];
    for (let i = 0; i < files.length; i++) {
        const input = files[i];
        onProgress?.(i + 1, files.length, input);
        let size;
        try {
            size = fs.statSync(input).size;
        } catch (err) {
            rows.push({ input, size: 0, hits: [], placement: null, error: `stat failed: ${err.message}` });
            continue;
        }
        try {
            const ext = path.extname(input).slice(1).toLowerCase();
            const hits = searchFn(buildSizeQuery(size, ext), rootDir)
                .filter(hit => path.extname(hit.path).toLowerCase() === `.${ext}`);
            rows.push({
                input,
                size,
                hits,
                placement: pickPlacement(hits),
                error: null,
            });
        } catch (err) {
            rows.push({ input, size, hits: [], placement: null, error: err.message });
        }
    }
    return rows;
}

export async function runRecupMap({
    rootDir,
    extSet = DEFAULT_RECUP_EXTS,
    dryRun = false,
    apply = false,
    detectFn = detectEverything,
    searchFn = null,
    writeFileFn = fs.writeFileSync,
    copyFileFn = fs.copyFileSync,
    onProgress = null,
} = {}) {
    const everything = detectFn();
    const query = searchFn ?? ((terms, excludeRoot) => searchEverything(
        [...terms, `!path:${excludeRoot}`],
        { esPath: everything.esPath, instance: everything.instance, maxResults: 40 },
    ));

    const files = discoverRecupFiles(rootDir, extSet);
    const rows = await buildRecupRows(files, { rootDir, searchFn: query, onProgress });
    const lines = formatRecupMapLines({
        folder: rootDir,
        everythingVersion: everything.version.raw,
        rows,
        extList: extSet,
    });

    const reportPath = path.join(rootDir, 'mediatuna-recup-map.txt');
    if (!dryRun) writeFileFn(reportPath, lines.join('\n') + '\n');

    const treeDir = path.join(rootDir, 'proposed-tree');
    const tree = apply
        ? applyRecupTree(rows, treeDir, { dryRun, copyFileFn })
        : { copied: 0, skipped: 0, errors: [], treeDir: null };

    return {
        lines,
        rows,
        reportPath: dryRun ? null : reportPath,
        treeDir: apply && !dryRun ? treeDir : null,
        everything,
        stats: {
            files: rows.length,
            placed: rows.filter(r => r.placement && !r.placement.ambiguous).length,
            ambiguous: rows.filter(r => r.placement?.ambiguous).length,
            unmatched: rows.filter(r => !r.placement && !r.error).length,
            errors: rows.filter(r => r.error).length,
            copied: tree.copied,
        },
    };
}

export function uniqueDestPath(dest, existsFn = fs.existsSync) {
    if (!existsFn(dest)) return dest;
    const ext = path.extname(dest);
    const stem = dest.slice(0, dest.length - ext.length);
    for (let n = 2; n < 1000; n++) {
        const candidate = `${stem}-${n}${ext}`;
        if (!existsFn(candidate)) return candidate;
    }
    return `${stem}-${Date.now()}${ext}`;
}

export function applyRecupTree(rows, treeDir, {
    dryRun = false,
    copyFileFn = fs.copyFileSync,
    mkdirFn = fs.mkdirSync,
    existsFn = fs.existsSync,
} = {}) {
    const result = { copied: 0, skipped: 0, errors: [], treeDir };
    if (dryRun) {
        result.copied = rows.filter(r => r.placement && !r.placement.ambiguous).length;
        return result;
    }
    mkdirFn(treeDir, { recursive: true });
    for (const row of rows) {
        if (!row.placement || row.placement.ambiguous) {
            result.skipped++;
            continue;
        }
        try {
            const dest = uniqueDestPath(path.join(treeDir, row.placement.proposed), existsFn);
            mkdirFn(path.dirname(dest), { recursive: true });
            copyFileFn(row.input, dest);
            const stat = fs.statSync(row.input);
            fs.utimesSync(dest, stat.atime, stat.mtime);
            result.copied++;
        } catch (err) {
            result.errors.push(`${row.input}: ${err.message}`);
        }
    }
    return result;
}
