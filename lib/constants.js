export const VIDEO_EXTS = new Set(['.avi', '.mov', '.mod', '.vob', '.mts', '.m2ts', '.mpg', '.mpeg', '.wmv', '.3gp', '.3g2']);
export const AUDIO_EXTS = new Set([
    '.mp3', '.flac', '.wav', '.aiff', '.aif', '.ape', '.m4a', '.aac', '.alac',
    '.ogg', '.opus', '.wma', '.ac3', '.dts', '.amr', '.qcp',
]);
export const LOSSLESS_AUDIO_EXTS = new Set(['.flac', '.wav', '.aiff', '.aif', '.ape']);
export const VIDEO_GLOB_PATTERN = '**/*.{avi,mov,mod,vob,mts,m2ts,mpg,mpeg,wmv,3gp,3g2}';
export const AUDIO_GLOB_PATTERN = '**/*.{mp3,flac,wav,aiff,aif,ape,m4a,aac,alac,ogg,opus,wma,ac3,dts,amr,qcp}';
export const VALID_QUALITY = new Set(['high', 'medium', 'fast']);
export const VALID_DEINTERLACE = new Set(['auto', 'on', 'off']);
export const INTERLACED_FIELD_ORDERS = new Set(['tt', 'bb', 'tb', 'bt']);
/** NVIDIA H.264 NVENC rejects frames below this size (seen as "Frame Dimension less than the minimum"). */
export const NVENC_MIN_WIDTH = 145;
export const NVENC_MIN_HEIGHT = 49;
