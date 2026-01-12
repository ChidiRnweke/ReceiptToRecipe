import { GoogleGenAI } from "@google/genai";
import type { IImageGenService, GeneratedImage } from "./interfaces";

export class GeminiImageService implements IImageGenService {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.5-flash-image") {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateImage(
    prompt: string,
    _size:
      | "256x256"
      | "512x512"
      | "1024x1024"
      | "1792x1024"
      | "1024x1792" = "1024x1024"
  ): Promise<GeneratedImage> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts?.length) {
      throw new Error("Failed to generate image: no response parts");
    }

    // Find the image part in the response
    const imagePart = parts.find((part) =>
      part.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData) {
      throw new Error("Failed to generate image: no image in response");
    }

    const { mimeType, data } = imagePart.inlineData;
    const dataUrl = `data:${mimeType};base64,${data}`;

    return {
      url: dataUrl,
      revisedPrompt: undefined,
    };
  }

  async generateRecipeImage(
    recipeTitle: string,
    description?: string,
    ingredients?: string[]
  ): Promise<GeneratedImage> {
    const parts: string[] = ["Professional food photography of", recipeTitle];

    if (description) {
      parts.push(`- ${description}`);
    }

    if (ingredients?.length) {
      const mainIngredients = ingredients.slice(0, 3).join(", ");
      parts.push(`featuring ${mainIngredients}`);
    }

    parts.push(
      "Styled on a rustic wooden table with natural lighting.",
      "Warm, inviting colors. Shallow depth of field.",
      "High-end restaurant presentation.",
      "No text or watermarks."
    );

    const prompt = parts.join(". ");

    return this.generateImage(prompt);
  }
}
