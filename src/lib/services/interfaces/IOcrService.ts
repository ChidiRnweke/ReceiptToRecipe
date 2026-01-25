export interface RawReceiptItem {
  name: string;
  quantity?: string;
  price?: string;
  category?: string;
}

export interface RawReceiptData {
  storeName?: string;
  storeAddress?: string;
  purchaseDate?: string;
  currency?: string;
  items: RawReceiptItem[];
  subtotal?: string;
  tax?: string;
  total?: string;
  paymentMethod?: string;
  rawText?: string;
}

export interface IOcrService {
  /**
   * Extract structured data from a receipt image
   * @param imageUrl - URL to the receipt image (from storage)
   * @returns Structured receipt data
   */
  extractReceipt(imageUrl: string): Promise<RawReceiptData>;

  /**
   * Extract structured data from a receipt image buffer
   * @param imageBuffer - Image as buffer
   * @param mimeType - MIME type of the image
   * @returns Structured receipt data
   */
  extractReceiptFromBuffer(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<RawReceiptData>;
}
