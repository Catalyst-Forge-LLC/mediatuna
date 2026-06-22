const MP3_BITRATE_FLOOR_KBPS = {
    high: 224,
    medium: 160,
    fast: 128,
};

export function lameQuality(quality) {
    if (quality === 'high') return '0';
    if (quality === 'fast') return '4';
    return '2';
}

export function mp3BitrateFloorKbps(quality) {
    return MP3_BITRATE_FLOOR_KBPS[quality] ?? MP3_BITRATE_FLOOR_KBPS.medium;
}

export function isSourceMp3(inputPath, meta) {
    return pathExtLower(inputPath) === '.mp3' && meta.audioCodec === 'mp3';
}

export function hasBasicTags(meta) {
    if (!meta?.tags) return false;
    const tags = meta.tags;
    return Boolean(
        findTag(tags, 'title') ||
        findTag(tags, 'artist') ||
        findTag(tags, 'album') ||
        (meta.tagCount ?? 0) >= 2
    );
}

export function isNormalizedMp3(inputPath, meta, quality) {
    if (!isSourceMp3(inputPath, meta)) return false;
    if (!hasBasicTags(meta)) return false;
    const bitrate = meta.audioBitrate ?? 0;
    if (bitrate <= 0) return false;
    return bitrate >= mp3BitrateFloorKbps(quality) * 1000;
}

function pathExtLower(filePath) {
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    return ext.includes('.') ? ext.toLowerCase() : '';
}

function findTag(tags, name) {
    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(tags)) {
        const k = key.toLowerCase();
        const normalized = k.includes(':') ? k.slice(k.lastIndexOf(':') + 1) : k;
        if (normalized === target && value != null && String(value).trim()) return String(value).trim();
    }
    return null;
}
