export const ErrorCode = {
  FILE_TYPE: 'FILE_TYPE',
  FILE_SIZE: 'FILE_SIZE',
  DECODE_FAILED: 'DECODE_FAILED',
  IMAGE_TOO_LARGE: 'IMAGE_TOO_LARGE',
  EXPORT_TOO_LARGE: 'EXPORT_TOO_LARGE',
  EXPORT_FAILED: 'EXPORT_FAILED',
  NO_SOURCE: 'NO_SOURCE',
  TARGET_UNREACHABLE: 'TARGET_UNREACHABLE',
  UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
};

const MESSAGES = {
  [ErrorCode.FILE_TYPE]: '仅支持 JPG、PNG、WebP 格式的图片',
  [ErrorCode.FILE_SIZE]: '图片超过 40 MB，请先压缩后再试',
  [ErrorCode.DECODE_FAILED]: '图片解码失败，文件可能已损坏',
  [ErrorCode.IMAGE_TOO_LARGE]: '图片尺寸超出浏览器处理能力',
  [ErrorCode.EXPORT_TOO_LARGE]: '导出尺寸超出浏览器上限，请减小输出边长',
  [ErrorCode.EXPORT_FAILED]: '导出失败，请重试或更换格式',
  [ErrorCode.NO_SOURCE]: '请先导入一张图片',
  [ErrorCode.TARGET_UNREACHABLE]: '无法压缩到目标体积，请降低尺寸或放宽体积要求',
  [ErrorCode.UNSUPPORTED_FORMAT]: '当前浏览器不支持该导出格式',
};

export class AppError extends Error {
  constructor(code, detail) {
    super(MESSAGES[code] ?? '操作失败');
    this.name = 'AppError';
    this.code = code;
    this.detail = detail ?? null;
  }
}

export function messageOf(error) {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return '发生未知错误，请重试';
}

export function isAppError(error) {
  return error instanceof AppError;
}
