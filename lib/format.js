export function formatSize(bytes) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
    return `${bytes} B`;
}

export function padEnd(str, len) {
    const s = String(str);
    return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

export function shellQuote(arg) {
    if (!/[\s"'$`]/.test(arg)) return arg;
    return `"${String(arg).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function formatDryRunProgress(index, total, status, filename) {
    return `[${index + 1}/${total}] ${status}  ${filename}`;
}

export function formatFfmpegError(stderr, fallback) {
    const lines = stderr
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l =>
            !l.startsWith('ffmpeg version') &&
            !l.startsWith('built with') &&
            !l.startsWith('configuration:') &&
            !/^lib\w+\s+\d/.test(l)
        );
    return lines.at(-1) || fallback;
}
