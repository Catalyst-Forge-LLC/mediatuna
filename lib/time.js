export function secondsToHMS(seconds) {
    const s = Math.floor(Math.max(0, Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function formatHMSValue(v, _options, type) {
    if (type === 'value' || type === 'total') return secondsToHMS(v);
    return v;
}

export function formatTimeHMS(t, _options, _round) {
    if (t === 'NULL' || t === 'INF' || t == null || Number.isNaN(Number(t))) return '--:--:--';
    return secondsToHMS(t);
}

export function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const last = parseFloat(parts[parts.length - 1]) || 0;
    if (parts.length === 3) {
        return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + Math.floor(last);
    }
    if (parts.length === 2) {
        return (parseInt(parts[0], 10) || 0) * 60 + Math.floor(last);
    }
    return Math.floor(last);
}
