export interface UploadResult {
  key: string;
  url: string;
}

export interface IStorageService {
  /**
   * Upload a file to storage
   * @param file - File buffer or stream
   * @param filename - Original filename
   * @param contentType - MIME type
   * @param folder - Optional folder/prefix
   * @returns Upload result with key and URL
   */
  upload(
    file: Buffer | Uint8Array,
    filename: string,
    contentType: string,
    folder?: string,
  ): Promise<UploadResult>;

  /**
   * Get a signed URL for temporary access to a file
   * @param key - Storage key/path
   * @param expiresIn - Expiration time in seconds (default 3600)
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * Get public URL for a file (if bucket is public)
   * @param key - Storage key/path
   */
  getPublicUrl(key: string): string;

  /**
   * Delete a file from storage
   * @param key - Storage key/path
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   * @param key - Storage key/path
   */
  exists(key: string): Promise<boolean>;
}
