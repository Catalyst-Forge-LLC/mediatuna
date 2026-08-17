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

function pack(year, month, day, hour, minute, second, rest = '', extra = {}) {
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
    return {
        parsed,
        rest: rest.replace(/^[-_]+/, ''),
        alreadyStandard: false,
        source: 'filename',
        hasZ: false,
        ...extra,
    };
}

export function filenameStampPrefix(parsed, { z = false, mtime = false } = {}) {
    const clock = `${parsed.hour}-${parsed.minute}-${parsed.second}${z ? 'Z' : ''}`;
    const tag = mtime ? 'MTIME_' : '';
    return `${tag}${parsed.year}-${parsed.month}-${parsed.day}_${clock}`;
}

export function parseFilenameDate(basename) {
    const stem = path.basename(basename, path.extname(basename));

    const dashed = stem.match(/^(MTIME_)?(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})(Z)?(?:_(.*))?$/);
    if (dashed) {
        const [, tag, year, month, day, hour, minute, second, z, rest] = dashed;
        const packed = pack(year, month, day, hour, minute, second, rest || '', {
            alreadyStandard: true,
            source: tag ? 'mtime' : (z ? 'creation_time' : 'filename'),
            hasZ: Boolean(z),
        });
        return packed;
    }

    const compact = stem.match(/^(MTIME_)?(\d{4})-(\d{2})-(\d{2})_(\d{6})(Z)?(?:_(.*))?$/);
    if (compact) {
        const [, tag, year, month, day, hms, z, rest] = compact;
        return pack(year, month, day, hms.slice(0, 2), hms.slice(2, 4), hms.slice(4, 6), rest || '', {
            alreadyStandard: false,
            source: tag ? 'mtime' : (z ? 'creation_time' : 'filename'),
            hasZ: Boolean(z),
        });
    }

    const yyyyDash = stem.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})(?:-(.+))?$/);
    if (yyyyDash) {
        return pack(yyyyDash[1], yyyyDash[2], yyyyDash[3], yyyyDash[4], yyyyDash[5], yyyyDash[6], yyyyDash[7] || '');
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

    const compactDay = stem.match(/^(\d{8})[ _-](\d{6})(?:[ _-](.+))?$/);
    if (compactDay) {
        const day = compactDay[1];
        const hms = compactDay[2];
        return pack(
            day.slice(0, 4), day.slice(4, 6), day.slice(6, 8),
            hms.slice(0, 2), hms.slice(2, 4), hms.slice(4, 6),
            compactDay[3] || '',
        );
    }

    return null;
}

export function normalizeDatedBasename(basename) {
    const parsed = parseFilenameDate(basename);
    if (!parsed || parsed.alreadyStandard) return basename;
    const ext = path.extname(basename);
    const rest = parsed.rest ? `_${parsed.rest}` : '';
    const prefix = filenameStampPrefix(parsed.parsed, {
        z: parsed.hasZ,
        mtime: parsed.source === 'mtime',
    });
    return `${prefix}${rest}${ext}`;
}

export function isStandardDatedName(basename) {
    return Boolean(parseFilenameDate(basename)?.alreadyStandard);
}
