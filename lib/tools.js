import { execFileSync } from 'child_process';

export function requireTools(tools = ['ffmpeg', 'ffprobe']) {
    const missing = [];
    for (const tool of tools) {
        try {
            execFileSync(tool, ['-version'], { stdio: 'pipe' });
        } catch {
            missing.push(tool);
        }
    }
    return missing;
}
