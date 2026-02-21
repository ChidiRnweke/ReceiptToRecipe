# Receipt2Recipe

> Transform grocery receipts into personalized recipes with AI

## Overview

Receipt2Recipe is an intelligent kitchen companion that bridges the gap between grocery shopping and home cooking. Scan your receipts, track your pantry, generate AI-powered recipes tailored to your taste, and shop smarter.

**The Workflow:**

```
Receipts → Cupboard → Recipes → Shopping
   ↓          ↓          ↓          ↓
  Scan     Track     Generate    Restock
```

## Features

### Receipt Management

- **Photo Upload**: Drag-and-drop or camera capture for receipt images
- **Mistral OCR**: Automatic item extraction with high accuracy
- **AI Normalization**: Product names cleaned and categorized using Gemini
- **Status Tracking**: Real-time polling during OCR processing

### Smart Pantry (Cupboard)

- **Stock Confidence Algorithm**: Visual indicators for item freshness
- **Kanban Lanes**: Fresh & Stocked → Use Soon → Running Low → Expired
- **Purchase History**: Tracks buying patterns for smart suggestions
- **Custom Shelf Life**: Override defaults per item or category

### AI Recipe Generation

- **Personalized Recipes**: Generated using your taste profile and available ingredients
- **Taste Profile Aware**: Respects allergies, diet types, and preferences
- **Background Image Generation**: Automatic food photography
- **Audio Narrator**: Hands-free cooking instructions
- **Recipe Adjustments**: AI-powered modifications ("Make it spicier", "Use what I have")

### Intelligent Shopping

- **Smart Suggestions**: Based on purchase frequency and pantry status
- **AI Restock**: One-click generate shopping list from patterns
- **Recipe-Based Lists**: Add ingredients from multiple recipes at once
- **Pantry Duplicate Check**: Warns when adding items already in stock
- **Checkout Flow**: Mark items purchased → updates pantry automatically

### User Preferences

- **Allergies**: Strict avoidance with severity levels
- **Diet Types**: Vegetarian, Vegan, Keto, Paleo, Pescatarian, etc.
- **Cuisine Preferences**: Italian, Mexican, Thai, Indian, and more
- **Caloric Goals**: Optional daily calorie targeting
- **Ingredient Preferences**: Love, like, dislike, or avoid specific items

### Progressive Web App

- **Offline Support**: Cached pages work without connection
- **Auto-Update**: Seamless updates with notification
- **Install Prompt**: Add to home screen

## Tech Stack

| Layer          | Technology                                 |
| -------------- | ------------------------------------------ |
| Frontend       | SvelteKit 5, Svelte 5 Runes, TailwindCSS 4 |
| Backend        | Node.js Adapter, Drizzle ORM               |
| Database       | PostgreSQL                                 |
| AI Services    | Mistral OCR, Gemini (via OpenRouter)       |
| Storage        | MinIO (S3-compatible)                      |
| Authentication | Authentik OAuth 2.0 with PKCE              |
| PWA            | @vite-pwa/sveltekit, Workbox               |
| Testing        | Vitest, Testcontainers                     |

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- MinIO (optional, falls back to filesystem storage)
- Authentik instance (or compatible OAuth provider)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/receipt2recipe.git
cd receipt2recipe

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your .env file (see Environment Variables below)

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/receipt2recipe

# OAuth (Authentik)
OAUTH_DOMAIN=auth.example.com
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret
OAUTH_CALLBACK_URL=http://localhost:5173/callback
OAUTH_APP_SLUG=receipt2recipe

# AI Services
OPENROUTER_API_KEY=your-openrouter-key
MISTRAL_API_KEY=your-mistral-key

# Storage (MinIO)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=receipts

# Optional
NODE_ENV=development
```

## Project Structure

```
src/
├── routes/                    # SvelteKit file-based routing
│   ├── +layout.svelte         # Global layout with navigation
│   ├── +page.svelte           # Dashboard / landing
│   ├── _admin/                # Admin panel (role-protected)
│   ├── api/                   # API endpoints
│   │   └── images/[...path]/  # MinIO image proxy
│   ├── callback/              # OAuth callback handler
│   ├── cupboard/              # Pantry management
│   ├── login/                 # OAuth login initiation
│   ├── logout/                # Session termination
│   ├── offline/               # PWA offline fallback
│   ├── preferences/           # User preferences form
│   ├── receipts/              # Receipt upload & management
│   │   ├── upload/            # Upload page
│   │   └── [id]/              # Receipt detail
│   ├── recipes/               # Recipe generation & viewing
│   │   ├── generate/          # AI recipe generation
│   │   └── [id]/              # Recipe detail
│   ├── settings/              # Settings pages
│   │   └── taste-profile/     # Taste profile configuration
│   ├── shopping/              # Shopping list management
│   ├── signup/                # Waitlist registration
│   └── waiting/               # Waitlist queue page
│
├── lib/
│   ├── components/            # Svelte components
│   │   ├── ui/                # Base UI components (button, input, etc.)
│   │   ├── Notepad.svelte     # Lined paper container
│   │   ├── PinnedNote.svelte  # Sticky note component
│   │   ├── WashiTape.svelte   # Decorative tape
│   │   └── ...
│   ├── controllers/           # Business logic orchestration
│   ├── db/                    # Database schema and migrations
│   ├── factories/             # Dependency injection factory
│   ├── repositories/          # Data access layer
│   ├── services/              # External integrations
│   ├── state/                 # Client-side state management
│   └── validation/            # Zod schemas and validators
│
├── static/                    # Static assets
└── app.html                   # HTML template
```

## Scripts

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | Start development server            |
| `npm run build`         | Build for production                |
| `npm run preview`       | Preview production build            |
| `npm run check`         | TypeScript and Svelte type checking |
| `npm run lint`          | Run ESLint and Prettier checks      |
| `npm run format`        | Auto-format code with Prettier      |
| `npm run test`          | Run unit tests                      |
| `npm run test:watch`    | Run tests in watch mode             |
| `npm run test:coverage` | Run tests with coverage report      |
| `npm run db:generate`   | Generate Drizzle migrations         |
| `npm run db:migrate`    | Run database migrations             |
| `npm run db:push`       | Push schema directly to database    |
| `npm run db:studio`     | Open Drizzle Studio GUI             |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SvelteKit Routes                         │
│  /receipts  /cupboard  /recipes  /shopping  /preferences        │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                       Controllers                                │
│  ReceiptController  PantryController  RecipeController          │
│  ShoppingListController  PreferencesController                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                        Services                                  │
│  SmartCulinaryIntelligence (AI)  NativeReceiptExtractor (OCR)   │
│  PantryService  ShoppingListService  AuthService                │
│  MinioStorageService  SmartProductNormalizer                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Repositories                                │
│  ReceiptRepository  RecipeRepository  PurchaseHistoryRepository │
│  ShoppingListRepository  UserRepository                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Database (PostgreSQL)                       │
│  receipts  receipt_items  recipes  recipe_ingredients           │
│  purchase_history  shopping_lists  users  taste_profiles        │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Patterns

- **Repository Pattern**: Database operations abstracted into repositories
- **Service Layer**: External integrations isolated in service classes
- **Controller Orchestration**: Business logic coordinated in controllers
- **Dependency Injection**: `AppFactory` provides singleton instances
- **Streaming SSR**: SvelteKit streaming for progressive page loads
- **Optimistic UI Updates**: Client-side state with rollback on failure

## Design System

The app features a unique **paper/journal aesthetic**:

| Component    | Description                            |
| ------------ | -------------------------------------- |
| `Notepad`    | Lined paper container for main content |
| `PinnedNote` | Colored sticky notes for side content  |
| `WashiTape`  | Decorative tape accents                |
| Photo frames | Polaroid-style recipe cards            |

**Color Palette**: `sage`, `sienna`, `ink`, `amber` on paper-like backgrounds

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style (Prettier config)
- Write tests for new functionality
- Update documentation for API changes
- Ensure `npm run check` and `npm run lint` pass

## License

MIT License - see LICENSE file for details
