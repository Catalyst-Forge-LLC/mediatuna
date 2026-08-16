import fs from 'fs';
import path from 'path';
import { padEnd } from './format.js';

export const STAMP_PREFIX_RE = /^((?:MTIME_)?\d{4}-\d{2}-\d{2}(?:_\d{6}Z?)?)_/;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i;

export function parseCreationDate(value) {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw || raw === 'N/A') return null;

    const match = raw.match(ISO_RE);
    if (match) {
        const [, year, month, day, hour, minute, second] = match;
        return {
            year,
            month,
            day,
            hour: hour ?? '00',
            minute: minute ?? '00',
            second: second ?? '00',
            hasTime: hour != null,
        };
    }

    if (/^\d{4}$/.test(raw)) return null;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    const hasTime = /T\d{2}:/.test(raw) || /\d{2}:\d{2}:\d{2}/.test(raw);
    if (!hasTime && !/^\d{4}[-/]\d{2}[-/]\d{2}/.test(raw)) return null;
    return fromUtcDate(parsed, hasTime);
}

function fromUtcDate(date, hasTime) {
    return {
        year: String(date.getUTCFullYear()).padStart(4, '0'),
        month: String(date.getUTCMonth() + 1).padStart(2, '0'),
        day: String(date.getUTCDate()).padStart(2, '0'),
        hour: String(date.getUTCHours()).padStart(2, '0'),
        minute: String(date.getUTCMinutes()).padStart(2, '0'),
        second: String(date.getUTCSeconds()).padStart(2, '0'),
        hasTime,
    };
}

function fromLocalDate(date, hasTime) {
    return {
        year: String(date.getFullYear()).padStart(4, '0'),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        day: String(date.getDate()).padStart(2, '0'),
        hour: String(date.getHours()).padStart(2, '0'),
        minute: String(date.getMinutes()).padStart(2, '0'),
        second: String(date.getSeconds()).padStart(2, '0'),
        hasTime,
    };
}

export function formatStampPrefix(parsed, { source = 'creation_time' } = {}) {
    if (!parsed) return null;
    const date = `${parsed.year}-${parsed.month}-${parsed.day}`;
    const clock = parsed.hasTime
        ? `_${parsed.hour}${parsed.minute}${parsed.second}${source === 'mtime' ? '' : 'Z'}`
        : '';
    const tag = source === 'mtime' ? 'MTIME_' : '';
    return `${tag}${date}${clock}`;
}

export function existingStampPrefix(basename) {
    const match = basename.match(STAMP_PREFIX_RE);
    return match ? match[1] : null;
}

export function buildStampedName(basename, prefix) {
    const current = existingStampPrefix(basename);
    if (current === prefix) return basename;
    if (current) return null;
    return `${prefix}_${basename}`;
}

/** Keep an existing date prefix; add one only when the name has none and metadata has a date. */
export function stampedOutputStem(basename, meta, { preferMtime = false } = {}) {
    const stem = path.basename(basename, path.extname(basename));
    if (existingStampPrefix(basename)) return stem;
    const resolved = resolveStampDate(meta, { preferMtime });
    if (!resolved.parsed) return stem;
    const prefix = formatStampPrefix(resolved.parsed, { source: resolved.source });
    const stamped = buildStampedName(basename, prefix);
    if (!stamped) return stem;
    return path.basename(stamped, path.extname(stamped));
}

export function resolveStampDate(meta, { preferMtime = false } = {}) {
    const fromTag = parseCreationDate(meta?.creation_time);
    if (fromTag) {
        return { parsed: fromTag, source: 'creation_time', raw: meta.creation_time };
    }

    if (preferMtime && meta?.modified_time) {
        const dt = new Date(meta.modified_time);
        if (!Number.isNaN(dt.getTime())) {
            return { parsed: fromLocalDate(dt, true), source: 'mtime', raw: meta.modified_time };
        }
    }

    return { parsed: null, source: null, raw: meta?.creation_time ?? null };
}

function backupRelPath(input, rootDir) {
    if (rootDir) {
        const rel = path.relative(rootDir, input);
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
    }
    return path.basename(input);
}

export function planStampRenames(files, {
    probeFn,
    preferMtime = false,
    rootDir = null,
} = {}) {
    if (typeof probeFn !== 'function') {
        throw new Error('planStampRenames requires probeFn');
    }

    const plannedDest = new Map();
    const plans = [];

    for (const input of files) {
        const basename = path.basename(input);
        const dir = path.dirname(input);
        let meta;
        try {
            meta = probeFn(input);
        } catch (err) {
            plans.push({
                input,
                output: null,
                action: 'error',
                reason: `probe failed: ${err.message}`,
                created: null,
                source: null,
                stamp: null,
                backupRel: backupRelPath(input, rootDir),
            });
            continue;
        }

        const resolved = resolveStampDate(meta, { preferMtime });
        if (!resolved.parsed) {
            plans.push({
                input,
                output: null,
                action: 'skip',
                reason: preferMtime
                    ? 'no parseable creation_time or mtime'
                    : 'no parseable creation_time (use --prefer-mtime to fall back to file date)',
                created: resolved.raw ?? null,
                source: null,
                stamp: null,
                backupRel: backupRelPath(input, rootDir),
            });
            continue;
        }

        const stamp = formatStampPrefix(resolved.parsed, { source: resolved.source });
        const nextName = buildStampedName(basename, stamp);
        if (nextName === null) {
            plans.push({
                input,
                output: null,
                action: 'skip',
                reason: `already has a different date prefix (${existingStampPrefix(basename)})`,
                created: resolved.raw,
                source: resolved.source,
                stamp,
                backupRel: backupRelPath(input, rootDir),
            });
            continue;
        }

        const output = path.join(dir, nextName);
        if (nextName === basename) {
            plans.push({
                input,
                output,
                action: 'skip',
                reason: 'already stamped',
                created: resolved.raw,
                source: resolved.source,
                stamp,
                backupRel: backupRelPath(input, rootDir),
            });
            continue;
        }

        const destKey = path.resolve(output);
        if (plannedDest.has(destKey)) {
            plans.push({
                input,
                output,
                action: 'error',
                reason: `would collide with ${path.basename(plannedDest.get(destKey))}`,
                created: resolved.raw,
                source: resolved.source,
                stamp,
                backupRel: backupRelPath(input, rootDir),
            });
            continue;
        }

        if (fs.existsSync(output) && path.resolve(output) !== path.resolve(input)) {
            plans.push({
                input,
                output,
                action: 'error',
                reason: `destination already exists: ${nextName}`,
                created: resolved.raw,
                source: resolved.source,
                stamp,
                backupRel: backupRelPath(input, rootDir),
            });
            continue;
        }

        plannedDest.set(destKey, input);
        plans.push({
            input,
            output,
            action: 'rename',
            reason: resolved.source,
            created: resolved.raw,
            source: resolved.source,
            stamp,
            backupRel: backupRelPath(input, rootDir),
        });
    }

    return {
        plans,
        stats: {
            rename: plans.filter(p => p.action === 'rename').length,
            skip: plans.filter(p => p.action === 'skip').length,
            error: plans.filter(p => p.action === 'error').length,
        },
    };
}

export function formatStampPlanLines(plans, { dryRun = false, backupDir = null } = {}) {
    const rows = plans.map(p => ({
        from: path.basename(p.input),
        to: p.output ? path.basename(p.output) : '—',
        status: p.action === 'rename'
            ? (dryRun ? 'would rename' : 'rename')
            : p.action,
        note: p.action === 'rename' ? (p.source || '') : (p.reason || ''),
    }));

    const fromW = Math.min(48, Math.max(18, ...rows.map(r => r.from.length)));
    const toW = Math.min(56, Math.max(18, ...rows.map(r => r.to.length)));
    const header = `  ${padEnd('File', fromW)}  ${padEnd('Stamped name', toW)}  Status`;
    const rule = '  ' + '─'.repeat(fromW + toW + 12);
    const lines = ['', rule, header, rule];

    for (const row of rows) {
        const extra = row.note ? `  ${row.note}` : '';
        lines.push(`  ${padEnd(row.from, fromW)}  ${padEnd(row.to, toW)}  ${row.status}${extra}`);
    }

    lines.push(rule);
    const action = dryRun ? 'would rename' : 'to rename';
    const renameCount = plans.filter(p => p.action === 'rename').length;
    const skipCount = plans.filter(p => p.action === 'skip').length;
    const errorCount = plans.filter(p => p.action === 'error').length;
    lines.push(`  ${plans.length} file(s): ${renameCount} ${action}, ${skipCount} skip, ${errorCount} error`);
    if (backupDir) {
        lines.push(`  Backup: ${backupDir}`);
    }
    lines.push('');
    return lines;
}

function copyBackup(plan, backupDir) {
    const dest = path.join(backupDir, plan.backupRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) return { dest, copied: false };
    fs.copyFileSync(plan.input, dest);
    return { dest, copied: true };
}

export function writeStampManifest(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n');
}

export function applyStampPlan(plans, {
    dryRun = false,
    backupDir = null,
    manifestPath = null,
} = {}) {
    const renames = plans.filter(p => p.action === 'rename');
    const result = {
        renamed: 0,
        skipped: plans.filter(p => p.action === 'skip').length,
        failed: plans.filter(p => p.action === 'error').length,
        backedUp: 0,
        errors: [],
    };

    if (dryRun) {
        result.renamed = renames.length;
        return result;
    }

    const manifest = {
        createdAt: new Date().toISOString(),
        backupDir,
        renames: renames.map(p => ({
            from: path.basename(p.input),
            to: path.basename(p.output),
            fromPath: path.resolve(p.input),
            toPath: path.resolve(p.output),
            created: p.created,
            source: p.source,
        })),
    };

    if (backupDir) {
        fs.mkdirSync(backupDir, { recursive: true });
        for (const plan of renames) {
            try {
                const { copied } = copyBackup(plan, backupDir);
                if (copied) result.backedUp++;
            } catch (err) {
                result.failed++;
                result.errors.push(`${path.basename(plan.input)}: backup failed (${err.message})`);
                if (manifestPath) writeStampManifest(manifestPath, { ...manifest, aborted: 'backup failed', errors: result.errors });
                return result;
            }
        }
    }

    if (manifestPath) writeStampManifest(manifestPath, manifest);

    for (const plan of renames) {
        try {
            if (fs.existsSync(plan.output) && path.resolve(plan.output) !== path.resolve(plan.input)) {
                result.failed++;
                result.errors.push(`${path.basename(plan.input)}: destination already exists`);
                continue;
            }
            fs.renameSync(plan.input, plan.output);
            result.renamed++;
        } catch (err) {
            result.failed++;
            result.errors.push(`${path.basename(plan.input)}: rename failed (${err.message})`);
        }
    }

    return result;
}

export function defaultManifestPath({ backupDir, targetPath, cwd = process.cwd() }) {
    if (backupDir) return path.join(backupDir, 'mediatuna-stamp-manifest.json');
    if (targetPath && fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        return path.join(targetPath, 'mediatuna-stamp-manifest.json');
    }
    return path.join(cwd, 'mediatuna-stamp-manifest.json');
}

export function runStampDates({
    files,
    probeFn,
    preferMtime = false,
    dryRun = false,
    backupDir = null,
    rootDir = null,
    logger,
}) {
    const { plans, stats } = planStampRenames(files, { probeFn, preferMtime, rootDir });
    const lines = formatStampPlanLines(plans, { dryRun, backupDir });
    logger?.printLines?.(lines);

    const manifestPath = dryRun ? null : defaultManifestPath({ backupDir, targetPath: rootDir });
    const result = applyStampPlan(plans, { dryRun, backupDir, manifestPath });

    for (const err of result.errors) {
        logger?.logConsole?.(`Stamp error: ${err}`);
    }
    if (!dryRun && manifestPath && fs.existsSync(manifestPath)) {
        logger?.logConsole?.(`Stamp manifest: ${manifestPath}`);
    }

    return { plans, stats, result, manifestPath };
}
