import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const WELL_KNOWN_ES = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Everything', 'es.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Everything 1.5a', 'es.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Everything 1.5b', 'es.exe'),
];

const INSTANCES = [null, '1.5a', '1.5b'];

export function parseEverythingVersion(text) {
    const match = String(text ?? '').trim().match(/(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return null;
    return {
        raw: match[0],
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        build: match[4] != null ? Number(match[4]) : 0,
    };
}

export function isEverything15(version) {
    const parsed = typeof version === 'string' ? parseEverythingVersion(version) : version;
    return Boolean(parsed && (parsed.major > 1 || (parsed.major === 1 && parsed.minor >= 5)));
}

export function quoteEverythingTerm(value) {
    const text = String(value).replace(/"/g, '');
    return /[\s&|<>^]/.test(text) ? `"${text}"` : text;
}

export function extensionTerm(filePath) {
    const ext = path.extname(filePath).replace(/^\./, '').toLowerCase();
    return ext || null;
}

export function buildNameSizeQuery(basename, size) {
    return ['file:', `size:${size}`, `nopath:exact:${quoteEverythingTerm(basename)}`];
}

export function buildSizeQuery(size, ext) {
    const terms = ['file:', `size:${size}`];
    if (ext) terms.push(`ext:${String(ext).replace(/^\./, '').toLowerCase()}`);
    return terms;
}

export function buildSizeHashQuery(size, sha256, ext) {
    const terms = ['file:', `size:${size}`, `sha256:${String(sha256).toLowerCase()}`];
    if (ext) terms.push(`ext:${String(ext).replace(/^\./, '').toLowerCase()}`);
    return terms;
}

export function searchTerms(query) {
    return Array.isArray(query) ? query : String(query).split(/\s+/).filter(Boolean);
}

export function parseCsvRow(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

export function parseEsCsv(text) {
    const hits = [];
    for (const line of String(text).split(/\r?\n/)) {
        if (!line.trim()) continue;
        const cells = parseCsvRow(line);
        if (cells.length < 2) continue;
        const size = Number(String(cells[0]).replace(/,/g, ''));
        const filePath = cells[1].trim();
        if (!Number.isFinite(size) || !filePath) continue;
        hits.push({ size, path: filePath });
    }
    return hits;
}

export function resolveEsPath({ env = process.env, existsFn = fs.existsSync } = {}) {
    if (env.MEDIATUNA_ES && existsFn(env.MEDIATUNA_ES)) return env.MEDIATUNA_ES;
    for (const candidate of WELL_KNOWN_ES) {
        if (existsFn(candidate)) return candidate;
    }
    return 'es.exe';
}

export function runEs(esPath, args, { instance = null } = {}) {
    const full = instance ? ['-instance', instance, ...args] : args;
    return execFileSync(esPath, full, {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
    });
}

export function detectEverything({
    esPath = resolveEsPath(),
    runEsFn = runEs,
} = {}) {
    let lastError = null;
    for (const instance of INSTANCES) {
        try {
            const raw = String(runEsFn(esPath, ['-get-everything-version'], { instance })).trim();
            const version = parseEverythingVersion(raw);
            if (!version) continue;
            return { esPath, instance, version };
        } catch (err) {
            lastError = err;
        }
    }
    const hint = lastError?.message ? ` (${lastError.message})` : '';
    throw new Error(`Everything CLI did not respond${hint}. Is Everything running?`);
}

export function searchEverything(query, {
    esPath,
    instance = null,
    runEsFn = runEs,
    maxResults = 50,
} = {}) {
    const output = runEsFn(esPath, [
        '-csv',
        '-no-header',
        '-no-digit-grouping',
        '-n', String(maxResults),
        '-size',
        '-full-path-and-name',
        ...searchTerms(query),
    ], { instance });
    return parseEsCsv(output);
}
