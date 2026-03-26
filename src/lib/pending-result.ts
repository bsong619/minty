// In-memory store for scan result images.
// File/photo URIs contain special characters (://, %) that get corrupted
// when passed through navigation params, so we keep them here instead.
let _imageUri: string | null = null;
let _tcgImageUrl: string | null = null;

export function setPendingResultImages(imageUri: string, tcgImageUrl?: string | null) {
  _imageUri = imageUri;
  _tcgImageUrl = tcgImageUrl ?? null;
}

export function consumePendingResultImages(): { imageUri: string | null; tcgImageUrl: string | null } {
  const result = { imageUri: _imageUri, tcgImageUrl: _tcgImageUrl };
  _imageUri = null;
  _tcgImageUrl = null;
  return result;
}
