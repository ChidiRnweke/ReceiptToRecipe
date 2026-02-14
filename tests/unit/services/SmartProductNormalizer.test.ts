import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartProductNormalizer } from "../../../src/lib/services/SmartProductNormalizer";

// Define hoisted mocks
const mocks = vi.hoisted(() => {
  return {
    send: vi.fn(),
  };
});

// Mock the OpenRouter module
vi.mock("@openrouter/sdk", () => {
  return {
    OpenRouter: class {
      chat = { send: mocks.send };
    },
  };
});

describe("SmartProductNormalizer", () => {
  let service: SmartProductNormalizer;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SmartProductNormalizer("fake-key");
  });

  describe("normalizeProduct", () => {
    const mockResponse = (data: any) => {
      mocks.send.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(data),
            },
          },
        ],
      });
    };

    it("should return normalized product info on success", async () => {
      mockResponse({
        normalizedName: "Cola",
        productGroup: "Soft Drinks",
        category: "beverages",
      });

      const result = await service.normalizeProduct("Coca Cola 33cl");

      expect(result.normalizedName).toBe("Cola");
      expect(result.productGroup).toBe("Soft Drinks");
      expect(result.category).toBe("beverages");
    });

    it("should handle array content parts", async () => {
      mocks.send.mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: '{"normalizedName": "Apple", ' },
                { type: "text", text: '"productGroup": "Fresh Produce", ' },
                { type: "text", text: '"category": "produce"}' },
              ],
            },
          },
        ],
      });

      const result = await service.normalizeProduct("Red Delicious Apple");

      expect(result.normalizedName).toBe("Apple");
      expect(result.productGroup).toBe("Fresh Produce");
      expect(result.category).toBe("produce");
    });

    it("should filter out non-text content parts", async () => {
      mocks.send.mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                { type: "image", image_url: "http://example.com/img.jpg" },
                {
                  type: "text",
                  text: '{"normalizedName": "Milk", "productGroup": "Dairy", "category": "dairy"}',
                },
              ],
            },
          },
        ],
      });

      const result = await service.normalizeProduct("Organic Whole Milk 1L");

      expect(result.normalizedName).toBe("Milk");
      expect(result.category).toBe("dairy");
    });

    it("should throw on invalid response structure", async () => {
      mocks.send.mockResolvedValue({
        // Missing choices
      });

      // Should fallback to raw name
      const result = await service.normalizeProduct("Test Product");
      expect(result.normalizedName).toBe("Test Product");
      expect(result.productGroup).toBe("Other");
      expect(result.category).toBe("other");
    });

    it("should throw on empty response text", async () => {
      mocks.send.mockResolvedValue({
        choices: [
          {
            message: {
              content: "",
            },
          },
        ],
      });

      const result = await service.normalizeProduct("Test Product");
      expect(result.normalizedName).toBe("Test Product");
      expect(result.productGroup).toBe("Other");
      expect(result.category).toBe("other");
    });

    it("should fallback gracefully on API error", async () => {
      mocks.send.mockRejectedValue(new Error("Network error"));

      const result = await service.normalizeProduct("Organic Free-Range Eggs");

      expect(result.normalizedName).toBe("Organic Free-Range Eggs");
      expect(result.productGroup).toBe("Other");
      expect(result.category).toBe("other");
    });

    it("should fallback gracefully on JSON parse error", async () => {
      mocks.send.mockResolvedValue({
        choices: [
          {
            message: {
              content: "not valid json",
            },
          },
        ],
      });

      const result = await service.normalizeProduct("Test Product");
      expect(result.normalizedName).toBe("Test Product");
      expect(result.productGroup).toBe("Other");
      expect(result.category).toBe("other");
    });

    it("should include system prompt in request", async () => {
      mockResponse({
        normalizedName: "Test",
        productGroup: "Other",
        category: "other",
      });

      await service.normalizeProduct("Test");

      const call = mocks.send.mock.calls[0][0];
      const messages = call.chatGenerationParams.messages;

      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("product normalization expert");
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toContain("Test");
    });

    it("should request JSON format response", async () => {
      mockResponse({
        normalizedName: "Test",
        productGroup: "Other",
        category: "other",
      });

      await service.normalizeProduct("Test");

      const call = mocks.send.mock.calls[0][0];
      expect(call.chatGenerationParams.responseFormat).toEqual({
        type: "json_object",
      });
    });
  });
});
