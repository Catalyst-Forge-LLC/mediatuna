import path from 'path';

export function parseGlobList(values) {
    if (!values) return [];
    const items = Array.isArray(values) ? values : [values];
    return items
        .flatMap(value => String(value).split(/[,;\n]+/))
        .map(value => value.trim())
        .filter(Boolean);
}

export function toPosixPath(filePath) {
    return String(filePath).replace(/\\/g, '/');
}

export function compileGlob(pattern) {
    const normalized = toPosixPath(String(pattern).trim());
    if (!normalized) return null;
    let regex = '';
    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        if (ch === '*' && normalized[i + 1] === '*') {
            regex += '.*';
            i += normalized[i + 2] === '/' ? 2 : 1;
        } else if (ch === '*') {
            regex += '[^/]*';
        } else if (ch === '?') {
            regex += '[^/]';
        } else if ('+^$()[]{}|.'.includes(ch)) {
            regex += `\\${ch}`;
        } else {
            regex += ch;
        }
    }
    return new RegExp(`^${regex}$`, 'i');
}

export function pathMatchesGlob(filePath, pattern, rootDir) {
    const re = compileGlob(pattern);
    if (!re) return false;
    const abs = path.resolve(filePath);
    const root = rootDir ? path.resolve(rootDir) : path.dirname(abs);
    const rel = toPosixPath(path.relative(root, abs));
    const base = path.basename(abs);
    if (re.test(rel) || re.test(base) || re.test(toPosixPath(abs))) return true;
    if (!toPosixPath(pattern).includes('/')) {
        return rel.split('/').some(part => re.test(part));
    }
    return false;
}

export function filterByGlobs(files, { include = [], exclude = [], rootDir = null } = {}) {
    return files.filter(filePath => {
        if (exclude.some(pattern => pathMatchesGlob(filePath, pattern, rootDir))) return false;
        if (include.length === 0) return true;
        return include.some(pattern => pathMatchesGlob(filePath, pattern, rootDir));
    });
}
