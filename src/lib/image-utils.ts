const isDev = import.meta.env.DEV;

function log(prefix: string, message: string, data?: unknown) {
  if (isDev) {
    console.log(`[ImageUtils] [${prefix}] ${message}`, data ?? '');
  }
}

export interface NormalizedImage {
  id: string;
  url: string;
  type: 'file' | 'url';
  name?: string;
  size?: number;
  lastModified?: number;
}

function getFileKey(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

function getUrlKey(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.split('/').pop() || url;
  } catch {
    return url;
  }
}

export function generateStableId(
  item: File | string,
  index: number
): string {
  if (item instanceof File) {
    return `file_${getFileKey(item)}_${index}`;
  }
  return `url_${getUrlKey(item)}_${index}`;
}

export function normalizeImageItem(
  item: File | string,
  index: number
): NormalizedImage {
  if (item instanceof File) {
    return {
      id: generateStableId(item, index),
      url: URL.createObjectURL(item),
      type: 'file',
      name: item.name,
      size: item.size,
      lastModified: item.lastModified,
    };
  }
  return {
    id: generateStableId(item, index),
    url: item,
    type: 'url',
  };
}

export function dedupeImages<T extends File | string>(
  images: T[],
  debugLabel = 'images'
): T[] {
  const beforeCount = images.length;
  const seen = new Set<string>();
  const result: T[] = [];

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    let key: string;

    if (item instanceof File) {
      key = getFileKey(item);
    } else {
      key = getUrlKey(item);
    }

    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  const afterCount = result.length;
  if (beforeCount !== afterCount) {
    log('dedupe', `${debugLabel}: ${beforeCount} -> ${afterCount} (removed ${beforeCount - afterCount} duplicates)`);
  }

  return result;
}

export function dedupeNormalizedImages(
  images: NormalizedImage[],
  debugLabel = 'images'
): NormalizedImage[] {
  const beforeCount = images.length;
  const seen = new Set<string>();
  const result: NormalizedImage[] = [];

  for (const img of images) {
    if (!seen.has(img.id)) {
      seen.add(img.id);
      result.push(img);
    }
  }

  const afterCount = result.length;
  if (beforeCount !== afterCount) {
    log('dedupe', `${debugLabel}: ${beforeCount} -> ${afterCount} (removed ${beforeCount - afterCount} duplicates)`);
  }

  return result;
}

export function dedupeUrls(urls: string[], debugLabel = 'urls'): string[] {
  return dedupeImages(urls, debugLabel) as string[];
}

export function getStableKey(item: File | string, fallbackIndex: number): string {
  if (item instanceof File) {
    return `file-${getFileKey(item)}`;
  }
  return `url-${getUrlKey(item)}-${fallbackIndex}`;
}

export function createIdempotentStateSetter<T>(
  setter: React.Dispatch<React.SetStateAction<T>>,
  debugLabel: string
): React.Dispatch<React.SetStateAction<T>> {
  let lastValue: T | undefined;
  let lastValueJson = '';

  return (value: React.SetStateAction<T>) => {
    const newValue = typeof value === 'function'
      ? (value as (prev: T) => T)(lastValue as T)
      : value;

    const newValueJson = JSON.stringify(newValue);

    if (newValueJson === lastValueJson) {
      log('dedupe', `${debugLabel}: Skipping duplicate state update`);
      return;
    }

    lastValue = newValue;
    lastValueJson = newValueJson;
    setter(newValue);
  };
}

export function useIdempotentRef<T>(value: T): React.RefObject<T> {
  const ref = { current: value } as React.MutableRefObject<T>;
  ref.current = value;
  return ref;
}
