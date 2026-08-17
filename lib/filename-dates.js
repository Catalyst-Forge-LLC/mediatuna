import path from 'path';

function validClock({ year, month, day, hour, minute, second }) {
    const y = Number(year);
    const mo = Number(month);
    const d = Number(day);
    const h = Number(hour);
    const mi = Number(minute);
    const s = Number(second);
    if (y < 1970 || y > 2100) return false;
    if (mo < 1 || mo > 12) return false;
    if (d < 1 || d > 31) return false;
    if (h > 23 || mi > 59 || s > 59) return false;
    return true;
}

function pack(year, month, day, hour, minute, second, rest = '') {
    const parsed = {
        year: String(year).padStart(4, '0'),
        month: String(month).padStart(2, '0'),
        day: String(day).padStart(2, '0'),
        hour: String(hour).padStart(2, '0'),
        minute: String(minute).padStart(2, '0'),
        second: String(second).padStart(2, '0'),
        hasTime: true,
    };
    if (!validClock(parsed)) return null;
    return { parsed, rest: rest.replace(/^[-_]+/, ''), alreadyStandard: false, source: 'filename' };
}

export function parseFilenameDate(basename) {
    const stem = path.basename(basename, path.extname(basename));

    const standard = stem.match(/^(MTIME_)?(\d{4})-(\d{2})-(\d{2})_(\d{6})Z?(?:_(.*))?$/);
    if (standard) {
        const [, tag, year, month, day, hms, rest] = standard;
        const packed = pack(year, month, day, hms.slice(0, 2), hms.slice(2, 4), hms.slice(4, 6), rest || '');
        if (!packed) return null;
        packed.alreadyStandard = true;
        packed.source = tag ? 'mtime' : 'filename';
        return packed;
    }

    const yy = stem.match(/^(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:-(.+))?$/);
    if (yy) {
        return pack(2000 + Number(yy[1]), yy[2], yy[3], yy[4], yy[5], yy[6], yy[7] || '');
    }

    const vr = stem.match(/^VR_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/);
    if (vr) return pack(vr[1], vr[2], vr[3], vr[4], vr[5], vr[6], '');

    const note = stem.match(/^AudioNote-(\d{4})-(\d{2})-(\d{2})_(\d{6})$/);
    if (note) {
        return pack(note[1], note[2], note[3], note[4].slice(0, 2), note[4].slice(2, 4), note[4].slice(4, 6), '');
    }

    const us = stem.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})$/);
    if (us) return pack(us[1], us[2], us[3], us[4], us[5], us[6], '');

    return null;
}

export function filenameStampPrefix(parsed) {
    return `${parsed.year}-${parsed.month}-${parsed.day}_${parsed.hour}${parsed.minute}${parsed.second}`;
}

export function normalizeDatedBasename(basename) {
    const parsed = parseFilenameDate(basename);
    if (!parsed || parsed.alreadyStandard) return basename;
    const ext = path.extname(basename);
    const rest = parsed.rest ? `_${parsed.rest}` : '';
    return `${filenameStampPrefix(parsed.parsed)}${rest}${ext}`;
}

export function isStandardDatedName(basename) {
    return Boolean(parseFilenameDate(basename)?.alreadyStandard);
}
