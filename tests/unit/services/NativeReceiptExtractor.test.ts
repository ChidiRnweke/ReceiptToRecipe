import { describe, it, expect, vi, beforeEach } from "vitest";
import { NativeReceiptExtractor } from "../../../src/lib/services/NativeReceiptExtractor";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args: string[]) => args.join("/")),
}));

import { readFile } from "fs/promises";

describe("NativeReceiptExtractor", () => {
  let service: NativeReceiptExtractor;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    service = new NativeReceiptExtractor("fake-api-key");
  });

  describe("extractReceipt", () => {
    it("should use URL directly for HTTP URLs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: {
            storeName: "Test Store",
            items: [{ name: "Milk" }],
          },
        }),
      });

      await service.extractReceipt("https://example.com/receipt.jpg");

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.document.image_url).toBe("https://example.com/receipt.jpg");
    });

    it("should convert local file path to base64", async () => {
      const mockBuffer = Buffer.from("fake-image-data");
      (readFile as any).mockResolvedValue(mockBuffer);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: {
            storeName: "Test Store",
            items: [{ name: "Milk" }],
          },
        }),
      });

      await service.extractReceipt("/uploads/receipt.png");

      expect(readFile).toHaveBeenCalledWith(
        expect.stringContaining("/uploads/receipt.png"),
      );

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.document.image_url).toMatch(/^data:image\/png;base64,/);
    });

    it("should handle JPEG files correctly", async () => {
      const mockBuffer = Buffer.from("fake-jpeg-data");
      (readFile as any).mockResolvedValue(mockBuffer);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: {
            items: [{ name: "Bread" }],
          },
        }),
      });

      await service.extractReceipt("/uploads/receipt.jpg");

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.document.image_url).toMatch(/^data:image\/jpeg;base64,/);
    });
  });

  describe("extractReceiptFromBuffer", () => {
    it("should create correct data URL from buffer", async () => {
      const buffer = Buffer.from("test-buffer-data");

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: {
            items: [{ name: "Eggs" }],
          },
        }),
      });

      await service.extractReceiptFromBuffer(buffer, "image/webp");

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.document.image_url).toBe(
        "data:image/webp;base64,dGVzdC1idWZmZXItZGF0YQ==",
      );
    });
  });

  describe("processOcrRequest", () => {
    it("should call Mistral OCR API with correct headers", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: {
            storeName: "Test Store",
            purchaseDate: "2024-01-15",
            currency: "EUR",
            items: [{ name: "Milk", quantity: "1", price: "2.99" }],
            total: "2.99",
          },
        }),
      });

      const result = await service.extractReceipt(
        "https://example.com/receipt.jpg",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.mistral.ai/v1/ocr",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer fake-api-key",
          },
        }),
      );

      expect(result.storeName).toBe("Test Store");
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Milk");
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });

      await expect(
        service.extractReceipt("https://example.com/receipt.jpg"),
      ).rejects.toThrow("Mistral OCR API failed with status 401: Unauthorized");
    });

    it("should handle camelCase annotation key", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          documentAnnotation: {
            storeName: "Fallback Store",
            items: [],
          },
        }),
      });

      const result = await service.extractReceipt(
        "https://example.com/receipt.jpg",
      );

      expect(result.storeName).toBe("Fallback Store");
    });

    it("should throw when no annotation present", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          // No annotation keys
        }),
      });

      await expect(
        service.extractReceipt("https://example.com/receipt.jpg"),
      ).rejects.toThrow("OCR failed: No annotation in response");
    });

    it("should parse string annotation as JSON", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: JSON.stringify({
            storeName: "String Store",
            items: [{ name: "Butter" }],
          }),
        }),
      });

      const result = await service.extractReceipt(
        "https://example.com/receipt.jpg",
      );

      expect(result.storeName).toBe("String Store");
      expect(result.items[0].name).toBe("Butter");
    });

    it("should pass JSON schema in request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          document_annotation: { items: [] },
        }),
      });

      await service.extractReceipt("https://example.com/receipt.jpg");

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.model).toBe("mistral-ocr-latest");
      expect(body.document_annotation_format).toBeDefined();
      expect(body.document_annotation_format.type).toBe("json_schema");
      expect(body.document_annotation_format.json_schema.name).toBe(
        "receipt_extraction",
      );
    });
  });
});
