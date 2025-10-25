# Neobank

A modern neobank application built with Next.js and a comprehensive fintech stack.

## Tech Stack

### Frontend & Backend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS, Shadcn UI, Aceternity UI
- **State Management**: TanStack Query (React Query)

### Authentication
- **Provider**: Supabase Auth
- Email/password, social logins, MFA support
- Server-side session management with secure cookies

### Database & ORM
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Storage**: Supabase Storage (KYC documents, receipts)

### External Services
- **Identity Verification**: Stripe Identity (KYC/AML)
- **Payment Processing**: Stripe (Treasury, Issuing)
- **Bank Connectivity**: Plaid (ACH transfers)

### Infrastructure
- **Hosting**: Vercel
- **Monitoring**: Sentry
- **Analytics**: Vercel Analytics
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- PostgreSQL (via Supabase)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Neobank
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Then fill in your API keys and credentials.

4. Set up Prisma:
```bash
pnpm prisma generate
pnpm prisma migrate dev
```

5. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
.
├── app/                  # Next.js App Router pages
├── components/           # React components
│   └── ui/              # Shadcn UI components
├── lib/                 # Utility functions and configurations
│   ├── prisma.ts        # Prisma client
│   ├── supabase.ts      # Supabase client
│   ├── stripe.ts        # Stripe client
│   └── plaid.ts         # Plaid client
├── prisma/              # Database schema and migrations
└── public/              # Static assets
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

## Environment Variables

See `.env.example` for all required environment variables.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

ISC