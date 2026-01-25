import { GoogleGenAI } from "@google/genai";
import type {
  IProductNormalizationService,
  NormalizedProductInfo,
} from "./interfaces/IProductNormalizationService";

const NORMALIZE_SYSTEM_PROMPT = `You are a product normalization expert for a grocery application. 
Your task is to analyze raw product names from receipts and extract structured information.

For each product, you should determine:
1. normalizedName: A clean, standard name for the product (e.g., "Coca Cola 33cl" -> "Cola", "Lays Chips Paprika" -> "Potato Chips"). Remove brand names unless they are essential to the product identity.
2. productGroup: A broad grouping for the product (e.g., "Soft Drinks", "Snacks", "Vegetables").
3. category: A high-level category (e.g., "beverages", "pantry", "produce", "dairy", "meat").

Always respond with valid JSON matching the requested format.`;

export class GeminiProductNormalizationService implements IProductNormalizationService {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.5-flash") {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async normalizeProduct(rawName: string): Promise<NormalizedProductInfo> {
    const prompt = `Normalize this product name: "${rawName}"

Respond with JSON:
{
  "normalizedName": "string",
  "productGroup": "string",
  "category": "string"
}`;

    try {
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          systemInstruction: NORMALIZE_SYSTEM_PROMPT,
          responseMimeType: "application/json",
        },
      });

      const response = result.text;
      if (!response) {
        throw new Error("Empty response from Gemini");
      }

      return JSON.parse(response) as NormalizedProductInfo;
    } catch (error) {
      console.error("Error normalizing product:", error);
      // Fallback
      return {
        normalizedName: rawName,
        productGroup: "Other",
        category: "other",
      };
    }
  }
}
