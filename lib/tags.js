export const DATE_TAG_KEYS = new Set(['date', 'creation_time', 'year', 'tdrc', 'tdor', 'originaldate']);
export const IMPORTANT_TAG_NAMES = ['title', 'artist', 'album', 'date', 'genre'];

export function normalizeTagKey(key) {
    const lower = key.toLowerCase();
    const colon = lower.lastIndexOf(':');
    return colon >= 0 ? lower.slice(colon + 1) : lower;
}

export function extractTagInfo(tags = {}) {
    const entries = Object.entries(tags).filter(([, v]) => v != null && String(v).trim() !== '');
    return {
        tags,
        tagKeys: entries.map(([k]) => k),
        tagCount: entries.length,
    };
}

export function findTagValue(tags, name) {
    const target = name.toLowerCase();
    for (const [key, value] of Object.entries(tags)) {
        if (normalizeTagKey(key) === target) return String(value).trim();
    }
    return null;
}

export function hasDateTag(tags) {
    for (const key of Object.keys(tags)) {
        if (DATE_TAG_KEYS.has(normalizeTagKey(key))) {
            const value = String(tags[key]).trim();
            if (value && value !== 'N/A') return true;
        }
    }
    return false;
}
