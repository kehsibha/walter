# Walter

**Trustworthy news, personalized.** Walter takes your interests, surveys multiple sources, cross-checks claims, and delivers short videos you can actually trust.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

## What It Does

1. **Ingests news** from curated RSS feeds (Reuters, AP, NPR, BBC, Al Jazeera, and more)
2. **Matches to your interests** using AI-powered preference matching
3. **Researches deeply** by pulling additional context from Exa search
4. **Summarizes in Axios style** — headline, lede, why it matters, key facts, what to watch
5. **Generates short-form video** with either:
   - **Anchor mode**: AI-generated talking news anchor (Kling lipsync + built-in TTS)
   - **Scenes mode**: Visual clips with ElevenLabs voiceover

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Database | [Supabase](https://supabase.com) (Postgres + Auth + Storage) |
| AI/LLM | [OpenAI](https://openai.com) GPT-4o |
| Search | [Exa](https://exa.ai) semantic search |
| Video | [fal.ai](https://fal.ai) (Kling 1.6 Pro) |
| TTS | [ElevenLabs](https://elevenlabs.io) (optional, for scenes mode) |
| Preferences | [Hyperspell](https://hyperspell.com) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- API keys for: OpenAI, Exa, fal.ai, Hyperspell
- (Optional) ElevenLabs API key for scenes mode

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/walter.git
cd walter
npm install
```

### 2. Configure Environment

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...

# Exa
EXA_API_KEY=...

# fal.ai
FAL_KEY=...

# Hyperspell
HYPERSPELL_API_KEY=...

# Video mode: "anchor" (default) or "scenes"
VIDEO_MODE=anchor

# ElevenLabs (only required if VIDEO_MODE=scenes)
ELEVENLABS_API_KEY=sk_...
```

### 3. Set Up Database

Run the Supabase migrations:

```bash
npx supabase db push
```

Or apply them manually via the Supabase dashboard from the `supabase/migrations/` folder.

### 4. Run the App

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see Walter.

### 5. Run the Worker

In a separate terminal, start the background worker that processes content generation jobs:

```bash
npm run worker
```

## Project Structure

```
walter/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Sign in, sign up, reset password
│   │   ├── (main)/             # Feed, home, settings
│   │   ├── (onboarding)/       # User preference onboarding
│   │   └── api/                # API routes
│   ├── components/             # React components
│   ├── config/                 # RSS feed configuration
│   ├── lib/
│   │   ├── integrations/       # Third-party API clients
│   │   ├── schemas/            # Zod validation schemas
│   │   └── supabase/           # Supabase client utilities
│   └── server/                 # Server-side logic
│       ├── ingest/             # RSS ingestion
│       ├── match/              # Topic ranking
│       ├── research/           # Deep research synthesis
│       ├── script/             # Video script generation
│       ├── summarize/          # Axios-style summaries
│       └── video/              # Video generation (Kling, assembly)
├── scripts/
│   └── worker.ts               # Background job processor
├── supabase/
│   └── migrations/             # Database schema
└── public/                     # Static assets
```

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  RSS Feeds  │────▶│   Ingest    │────▶│   Match     │
│  (8 sources)│     │   & Parse   │     │  to Prefs   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Video     │◀────│   Script    │◀────│  Research   │
│  Generation │     │  Generation │     │  & Summary  │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  TikTok-    │
│  style Feed │
└─────────────┘
```

1. **Ingest**: Pulls latest articles from configured RSS feeds
2. **Match**: Ranks articles against user preferences using AI
3. **Research**: Enriches top stories with Exa search results
4. **Summarize**: Generates Axios-style structured summaries
5. **Script**: Creates video narration scripts with scene descriptions
6. **Video**: Generates clips via Kling AI, assembles with FFmpeg
7. **Deliver**: Serves as swipeable video feed or newsletter view

## Video Modes

### Anchor Mode (Default)

Uses Kling's built-in lipsync TTS to generate a talking news anchor. No ElevenLabs required.

### Scenes Mode

Generates visual scene clips with separate ElevenLabs voiceover, then composites them together. Requires `ELEVENLABS_API_KEY`.

Set via `VIDEO_MODE` environment variable.

## License

MIT

## Contributing

Contributions welcome! Please open an issue first to discuss what you'd like to change.
