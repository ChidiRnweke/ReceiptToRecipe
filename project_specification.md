
# Project Name: Receipt2Recipe (R2R)

## Features

1. **Receipt scanning:** Users can take a picture of a receipt, the app will create structured data from the receipt. We will use Mistral Document AI for this, specifically document annotation, it allows you to give a schema and get structured data back. **The system must handle this asynchronously (upload -> processing -> complete) to prevent UI blocking during OCR.**
2. **Recipe generation:** Using the structured data from the receipt, the app will generate recipes based on the ingredients purchased. We will use generic LLM providers for this, such as Gemini or GPT. The Recipes could be grounded by a cookbook using Retrieval Augmented Generation (RAG) **stored via vector embeddings**, or could come from the LLMs knowledge.
3. **Dietary Preferences:** Users need to be able to specify their dietary preferences and restrictions, which will be taken into account when generating recipes. They should be able to set certain allergies, dietary restrictions, cuisine preferences and importantly, caloric goals. Should also be possible to set preferences, like not adding certain ingredients (e.g., cilantro).
4. **Servings Adjustment:** Users need to be able to specify the number of people they are cooking for, which will adjust the ingredient quantities in the generated recipes accordingly.
5. **UI & Media:** The app should have a user-friendly interface where users can easily upload receipts, set their preferences, and view generated recipes. You should generate images for the recipes using an image generation model like Mistral Vision or DALL-E.
6. **Social:** The users should be able to save and share the recipes with others.
7. **Smart Shopping List:** The app should be able to generate a starting point for shopping lists based on the previous purchases from the receipts. Since we store when last the user purchased an item, we can suggest items that might be running low. **This requires a normalization step to ensure quantities (e..g., "1kg" vs "1000g") are mathematically comparable.** The user should be able to even add ingredients from the generated recipes to the shopping list.

## Technical Requirements

1. Use **Mistral Document AI** for receipt scanning and structured data extraction.
2. Use a **generic LLM provider** (e.g., Gemini, GPT) for recipe generation and data normalization.
3. Use an **image generation model** (e.g., Mistral Vision, DALL-E) for generating recipe images.
4. Use **SvelteKit** for building the user interface. I want you to build it around SSR, making use of form actions as well as load functions.
5. Use a **relational database (PostgreSQL)** to store user data, receipts, recipes, and shopping lists. 
6. Use an **ORM (Drizzle ORM)** for database interactions.
7. Use **authentication (OAuth)** for user accounts. You may start with a mock authentication system for development purposes.
8. Ensure the application is **responsive** and works well on both desktop and mobile devices.
9. Use an **Object Storage service** (e.g., AWS S3, Cloudflare R2, or MinIO) to store receipt images and generated recipe images. Do not store binary image data in the database.
10. Implement a **Normalization Layer**: Transform raw OCR strings (e.g., "1lb", "16oz") into standard units before saving to the database to enable accurate burn-rate calculation.
11. Use shadcn-svelte for UI components to ensure a consistent and modern design.

## Software Architecture

1. **Models:** Define data objects for each entity, these are (more or less) zero dependency classes that represent the data structure. **Models should include status fields (e.g., `Processing`, `Done`) for handling async AI tasks.**
2. **Services:** Implement business logic and interact with external APIs. These services have no knowledge of HTTP or other services. Each service's dependencies are injected via the constructor. Each service has a well-defined interface.
* *Examples:* `OcrService`, `LlmService`, `ImageGenService`, `StorageService` (for S3/R2), `VectorService` (for embeddings), `NormalizationService`.


3. **Controllers:** Orchestrate multiple services, they are ultimately the entrypoint that is used in actions or loaders. They are also HTTP agnostic.
* *Example:* A `ReceiptController` that uploads the image via `StorageService`, then triggers `OcrService`, then passes the result to `NormalizationService`.


4. **Factories:** Responsible for creating instances of services and controllers, wiring up dependencies.

## Design Language & UI Guidelines

Core Philosophy: "The Digital Kitchen" The interface should feel like a clean, sunlit countertop. It avoids the sterile, clinical look of standard SaaS (stark white/bright blue) in favor of a "warm rationalism." It is intellectual but hospitable.

1. Typography: The "Editorial" Pairing

Headings: Use a high-quality Serif font (e.g., Newsreader, Source Serif, or Fraunces). This evokes the feeling of a cookbook or a menu, adding warmth and authority.

UI/Body: Use a high-legibility grotesque Sans-Serif (e.g., Geist, Inter, or Satoshi). This handles the density of ingredient lists and data entry.

Rule: All navigation, buttons, and inputs use the Sans-serif. Only page titles and recipe names use the Serif.

2. Color Palette: "Paper and Ink"

Backgrounds: Avoid #FFFFFF. Use "Paper" tones (e.g., #FDFCF8 or #F9F9F7).

Text: Avoid #000000. Use "Ink" tones (e.g., Charcoal #1A1A1A or Deep Slate #2D2D2D).

Accents: Do not use "Tech Blue." Use organic, muted accents derived from ingredients:

Sage (Primary Action)

Burnt Sienna (Destructive/Alert)

Oat/Sand (Secondary backgrounds/Borders)

3. Surface & Depth

Borders > Shadows: Rely on subtle, 1px borders in slightly darker shades of the background color (e.g., a sand-colored border on a cream background) rather than heavy drop shadows.

Radius: Use moderate rounding (rounded-lg or rounded-xl). Avoid fully pill-shaped buttons unless it is a primary floating action.

Glass: Use backdrop blur sparingly, only for sticky headers or floating overlays, to maintain the "slick" modern feel without looking like an OS.

4. Layout & Spacing

Density: High whitespace. The UI should breathe. Lists of ingredients should have generous padding, not look like a spreadsheet.

Container: Center-focused layouts (max-width reading modes) for recipe viewing to mimic a book.

5. Micro-Interactions

Feedback: Buttons should have a subtle "press" scale-down effect (e.g., scale-95).

Loading: Avoid generic spinners where possible. Use "shimmer" skeletons that match the "Paper" background colors.


Write a plan for implementing the above features and architecture in a step-by-step manner.