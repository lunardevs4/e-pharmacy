import { Request, Response, NextFunction } from 'express';

interface NoSqlSanitizeOptions {
  replaceWith?: string;
  allowDots?: boolean;
  onSanitize?: (info: { key: string; req: Request }) => void;
}

const UNSAFE_KEY_PREFIX = '$';
const DOT_CHAR = '.';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    (v.constructor === Object || v.constructor === undefined)
  );
}

function deriveSafeKey(key: string, replaceWith: string, allowDots: boolean): string {
  let safe = key;
  if (safe.startsWith(UNSAFE_KEY_PREFIX)) safe = replaceWith + safe.slice(1);
  if (!allowDots) safe = safe.split(DOT_CHAR).join(replaceWith);
  return safe;
}

function sanitizeNode(
  node: Record<string, unknown> | unknown[],
  opts: Required<Pick<NoSqlSanitizeOptions, 'replaceWith' | 'allowDots'>> & {
    onSanitize?: NoSqlSanitizeOptions['onSanitize'];
    req: Request;
  },
): void {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const item = node[i];
      if (isPlainObject(item) || Array.isArray(item)) {
        sanitizeNode(item as any, opts);
      }
    }
    return;
  }

  const keys = Object.keys(node);
  for (const key of keys) {
    const value = node[key];

    if (isPlainObject(value) || Array.isArray(value)) {
      sanitizeNode(value as any, opts);
    }

    const unsafePrefix = key.startsWith(UNSAFE_KEY_PREFIX);
    const unsafeDot = !opts.allowDots && key.includes(DOT_CHAR);

    if (unsafePrefix || unsafeDot) {
      delete node[key];
      const safeKey = deriveSafeKey(key, opts.replaceWith, opts.allowDots);
      (node as Record<string, unknown>)[safeKey] = value;
      if (opts.onSanitize) opts.onSanitize({ key, req: opts.req });
    }
  }
}

export function noSqlSanitize(options: NoSqlSanitizeOptions = {}) {
  const replaceWith = options.replaceWith ?? '_';
  const allowDots = options.allowDots ?? false;
  const onSanitize = options.onSanitize;

  return function noSqlSanitizeMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    const targets: Array<'body' | 'query' | 'params'> = ['body', 'query', 'params'];
    for (const key of targets) {
      const container = (req as unknown as Record<string, unknown>)[key];
      if (isPlainObject(container) || Array.isArray(container)) {
        try {
          sanitizeNode(container as any, { replaceWith, allowDots, onSanitize, req });
        } catch {
        }
      }
    }
    next();
  };
}
