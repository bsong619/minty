// In-memory store for the image URI being analyzed.
// Blob URLs from the web file picker can't survive URL navigation, so we
// keep the URI here and consume it in the analyzing screen.
let _uri: string | null = null;

export function setPendingImageUri(uri: string) {
  _uri = uri;
}

export function consumePendingImageUri(): string | null {
  const uri = _uri;
  _uri = null;
  return uri;
}
