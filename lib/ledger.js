import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { parseFilenameDate } from './filename-dates.js';
import { parseCreationDate } from './stamp-dates.js';

export const LEDGER_JSON_NAME = 'archive.json';

let sidecarChain = Promise.resolve();

export function defaultLedgerJsonPath({ outputDir = null, cwd = process.cwd() } = {}) {
    return path.join(outputDir || cwd, '.mediatuna', LEDGER_JSON_NAME);
}

export function relativeLedgerPath(root, abs) {
    const resolvedRoot = path.resolve(root);
    const resolvedAbs = path.resolve(abs);
    const rel = path.relative(resolvedRoot, resolvedAbs);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        return resolvedAbs.split(path.sep).join('/');
    }
    return rel.split(path.sep).join('/');
}

export function isoFromParsed(parsed) {
    if (!parsed) return null;
    const date = `${parsed.year}-${parsed.month}-${parsed.day}`;
    if (!parsed.hasTime) return date;
    return `${date}T${parsed.hour}:${parsed.minute}:${parsed.second}`;
}

function fromFilesystemTime(value) {
    if (value == null || value === 'N/A') return null;
    const parsed = parseCreationDate(value);
    if (!parsed) return null;
    return { sourceDate: isoFromParsed(parsed), dateSource: 'filesystem' };
}

function fromFilename(input) {
    const hit = parseFilenameDate(path.basename(input));
    if (!hit?.parsed) return null;
    return {
        sourceDate: isoFromParsed(hit.parsed),
        dateSource: hit.source === 'mtime' ? 'filesystem' : 'filename',
    };
}

export function resolveLedgerDate(meta, input, { preferMtime = false } = {}) {
    const fromTag = parseCreationDate(meta?.creation_time);
    if (fromTag) {
        return { sourceDate: isoFromParsed(fromTag), dateSource: 'embedded' };
    }

    const filenameHit = fromFilename(input);
    const fsHit = fromFilesystemTime(meta?.modified_time);

    if (preferMtime) return fsHit || filenameHit || { sourceDate: null, dateSource: null };
    return filenameHit || fsHit || { sourceDate: null, dateSource: null };
}

export function ledgerAction(mode) {
    return mode === 'extract' ? 'extract' : 'transcode';
}

export function buildLedgerRecord({
    input,
    out,
    meta,
    mode,
    sourceRoot,
    mediatunaVersion,
    preferMtime = false,
    verified = false,
    durationDeltaMs = null,
    processedAt = new Date().toISOString(),
}) {
    const { sourceDate, dateSource } = resolveLedgerDate(meta, input, { preferMtime });
    const ext = path.extname(input).slice(1).toLowerCase() || 'unknown';
    return {
        source: relativeLedgerPath(sourceRoot, input),
        sourceFormat: ext,
        sourceDate,
        dateSource,
        action: ledgerAction(mode),
        output: relativeLedgerPath(sourceRoot, out),
        verified,
        durationDeltaMs,
        processedAt,
        mediatunaVersion,
    };
}

export function formatLedgerComment(record) {
    const date = record.sourceDate ? ` ${record.sourceDate}` : '';
    const dest = path.posix.basename(String(record.output || '').replaceAll('\\', '/'));
    return `MediaTuna ${record.mediatunaVersion} ${record.action} ${record.source} → ${dest}${date}`.slice(0, 250);
}

export function buildLedgerRemuxArgs(src, dest, record, { video }) {
    const comment = formatLedgerComment(record);
    const tag = JSON.stringify(record);
    const args = [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', src,
        '-map', '0',
        '-c', 'copy',
        '-map_metadata', '0',
    ];
    if (video) {
        args.push('-movflags', '+faststart+use_metadata_tags');
    } else {
        args.push('-id3v2_version', '3', '-write_id3v1', '0');
    }
    args.push('-metadata', `comment=${comment}`, '-metadata', `mediatuna=${tag}`, dest);
    return args;
}

export function applyLedgerMetadata(outPath, record, { ffmpeg = 'ffmpeg' } = {}) {
    const ext = path.extname(outPath);
    const tmp = `${outPath}.ledger${ext}`;
    const args = buildLedgerRemuxArgs(outPath, tmp, record, {
        video: ext.toLowerCase() === '.mp4',
    });
    try {
        execFileSync(ffmpeg, args, { stdio: 'pipe', timeout: 120_000 });
        if (!fs.existsSync(tmp)) {
            throw new Error('ledger remux produced no file');
        }
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
        fs.renameSync(tmp, outPath);
    } catch (err) {
        try {
            if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
        } catch { /* keep the original output */ }
        throw err;
    }
}

export function upsertLedgerSidecar(filePath, record) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    let doc = { version: 1, updatedAt: record.processedAt, entries: [] };
    if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed && typeof parsed === 'object') {
            doc = parsed;
        }
        if (!Array.isArray(doc.entries)) doc.entries = [];
        if (doc.version == null) doc.version = 1;
    }
    const index = doc.entries.findIndex((entry) => entry.output === record.output);
    if (index >= 0) doc.entries[index] = record;
    else doc.entries.push(record);
    doc.updatedAt = record.processedAt;
    fs.writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`);
    return doc;
}

export function enqueueSidecarWrite(filePath, record) {
    const next = sidecarChain.then(
        () => upsertLedgerSidecar(filePath, record),
        () => upsertLedgerSidecar(filePath, record),
    );
    sidecarChain = next.catch(() => {});
    return next;
}

export function resetSidecarQueue() {
    sidecarChain = Promise.resolve();
}
