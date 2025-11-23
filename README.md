# Myitra Platform (Assistant Core)

Next.js + Tailwind + shadcn-based frontend for Myitra AI assistant with multilingual support.

## Overview

This is the core frontend application for the Myitra AI assistant platform. It provides voice, video, and text-based interaction capabilities with AI psychologists, featuring comprehensive multilingual support across Ukrainian, English, and Russian languages.

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui + Radix UI
- **Database**: Supabase
- **AI Integration**: OpenAI API with Vercel AI SDK
- **Speech Synthesis**: Enhanced TTS with native accent support
- **Authentication**: Supabase Auth

## Features

### Core Functionality
- **AI Chat Dialog** - Text-based conversations with AI psychologists
- **Voice Calling** - Real-time audio sessions with speech recognition
- **Video Calling** - Interactive video sessions with 3D animated avatars
- **Multilingual Support** - Ukrainian (default), English, and Russian
- **Authentication** - Secure user registration and login

### Advanced Features
- **Real-time Translation** - Automatic language detection and translation
- **Native Accent Synthesis** - Authentic pronunciation for each supported language
- **Responsive Design** - Mobile-first, fully responsive interface
- **Theme Support** - Light and dark mode

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+ (recommended)

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file with the required environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Additional Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm run start
```

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes (chat, tts, speech processing)
│   ├── (auth)/            # Authentication pages
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── ui/               # Reusable UI components
│   └── ...               # Feature components (chat, voice, video)
├── lib/                  # Utility libraries
│   ├── auth/             # Authentication logic
│   ├── i18n/             # Internationalization (uk/en/ru)
│   └── ...               # Other utilities
├── hooks/                # Custom React hooks
├── public/               # Static assets
└── styles/               # Global styles
```

## Supported Languages

- Ukrainian (uk) - Default
- English (en)
- Russian (ru)

## Key Components

- **AI Chat Dialog** - Interactive text-based conversations
- **Voice Call Dialog** - Audio communication with speech recognition
- **Video Call Dialog** - Video sessions with animated AI avatars
- **Language Selector** - Switch between supported languages
- **Authentication Forms** - Login and registration

## License

MIT

## Support

For issues and questions, please check the documentation or create an issue in the repository.
