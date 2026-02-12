import { OpenRouter } from "@openrouter/sdk";
import type { IImageGenerator, GeneratedImage } from "./interfaces";

export class SmartImageGenerator implements IImageGenerator {
  private client: OpenRouter;
  private model: string;

  constructor(apiKey: string, model: string = "google/gemini-3-flash-preview") {
    this.client = new OpenRouter({ apiKey });
    this.model = model;
  }

  async generateImage(
    prompt: string,
    _size:
      | "256x256"
      | "512x512"
      | "1024x1024"
      | "1792x1024"
      | "1024x1792" = "1024x1024",
  ): Promise<GeneratedImage> {
    const completion = await this.client.chat.send({
      chatGenerationParams: {
        model: this.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        modalities: ["image"],
        stream: false,
      },
    });

    if (
      !completion ||
      !("choices" in completion) ||
      completion.choices.length === 0
    ) {
      throw new Error("Failed to generate image: no response choices");
    }

    const message = completion.choices[0].message;

    if (!message.images || message.images.length === 0) {
      throw new Error("Failed to generate image: no image in response");
    }

    const imageUrl = message.images[0].imageUrl.url;

    return {
      url: imageUrl,
      revisedPrompt: undefined, // OpenRouter/Gemini might not return this in standard way
    };
  }

  async generateRecipeImage(
    recipeTitle: string,
    description?: string,
    ingredients?: string[],
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
      "No text or watermarks.",
    );

    const prompt = parts.join(". ");

    return this.generateImage(prompt);
  }
}
