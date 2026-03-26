// In-memory store for the image URI(s) being analyzed.
// Blob URLs from the web file picker can't survive URL navigation, so we
// keep the URIs here and consume them in the analyzing screen.
let _frontUri: string | null = null;
let _backUri: string | null = null;

/** Single-sided scan (backward-compat) */
export function setPendingImageUri(uri: string) {
  _frontUri = uri;
  _backUri = null;
}

/** Two-sided scan — pass front and optional back */
export function setPendingImageUris(front: string, back?: string | null) {
  _frontUri = front;
  _backUri = back ?? null;
}

/** Consume both URIs (clears store). Use this in the analyzing screen. */
export function consumePendingImageUris(): { front: string | null; back: string | null } {
  const front = _frontUri;
  const back = _backUri;
  _frontUri = null;
  _backUri = null;
  return { front, back };
}

/** Backward-compat single URI consume */
export function consumePendingImageUri(): string | null {
  const { front } = consumePendingImageUris();
  return front;
}
