[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/wodsmith/thewodapp)

# WODsmith

A comprehensive CrossFit gym management platform built with Next.js, Cloudflare Workers, and modern web technologies. WODsmith enables gyms to manage workouts, programming tracks, athlete performance tracking, and team collaboration.

## 🚀 Live Demo

[Visit WODsmith](https://nextjs-saas-template.agenticdev.agency/sign-up)

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Project Structure](#-project-structure)
- [Database Schema](#-database-schema)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Functionality

#### 🏋️ Workout Management
- Create, edit, and organize workouts with detailed components
- Support for various workout schemes (AMRAP, For Time, EMOM, etc.)
- Movement tracking with weightlifting, gymnastic, and monostructural categories
- Tag system for workout categorization
- Workout templates and cloning functionality
- Rich text descriptions with formatting support

#### 📅 Programming & Scheduling
- Multiple programming tracks for different athlete levels
- Drag-and-drop workout scheduling interface
- Weekly and monthly programming views
- Schedule templates for recurring programming patterns
- Auto-generation of training schedules
- Track subscriptions for athletes

#### 📊 Performance Tracking
- Athlete workout result logging
- Performance analytics and progress tracking
- Personal records (PR) tracking
- Benchmark workout comparisons
- Historical data visualization
- Export capabilities for athlete data

#### 👥 Team Management
- Multi-tenant architecture with team isolation
- Role-based access control (Owner, Admin, Member, Guest)
- Custom role creation with granular permissions
- Team invitations and member management
- Personal teams for individual athletes
- Team switching and collaboration features

#### 🏪 Gym Operations
- Class scheduling and management
- Coach assignments and scheduling
- Equipment tracking and management
- Gym setup and configuration
- Member check-ins and attendance

#### 🧮 Utilities
- Barbell calculator for weight loading
- Percentage-based workout calculators
- Spreadsheet-style workout planning
- Movement substitution suggestions
- Workout scaling options

### Platform Features

#### 🔐 Authentication & Security
- Email/Password authentication
- Google OAuth integration
- WebAuthn/Passkey support
- Two-factor authentication
- Session management with Cloudflare KV
- Rate limiting and CAPTCHA protection
- Secure password reset flow
- Email verification

#### 💳 Billing & Subscriptions
- Credit-based billing system
- Stripe payment integration
- Monthly credit refresh
- Usage tracking and analytics
- Transaction history
- Multiple pricing tiers

#### 🎨 User Interface
- Modern, responsive design with Tailwind CSS
- Dark/Light mode support
- Mobile-first approach
- Real-time updates and notifications
- Drag-and-drop interfaces
- Loading states and animations
- Toast notifications

#### 📧 Communication
- Transactional email system
- Beautiful email templates with React Email
- Team invitations
- Workout notifications
- Performance summaries

## 🛠 Tech Stack

### Frontend
- **Framework:** Next.js 15.3.2 with App Router
- **UI Library:** React 19
- **Styling:** Tailwind CSS, Shadcn UI
- **State Management:** Zustand, NUQS (URL state)
- **Forms:** React Hook Form + Zod validation
- **Calendar:** FullCalendar
- **Drag & Drop:** Atlaskit Pragmatic Drag and Drop

### Backend
- **Runtime:** Cloudflare Workers (Edge Computing)
- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle ORM
- **Session Store:** Cloudflare KV
- **Authentication:** Lucia Auth
- **API:** Server Actions with ZSA

### DevOps
- **Deployment:** OpenNext for Cloudflare
- **CI/CD:** GitHub Actions
- **Type Safety:** TypeScript
- **Code Quality:** Biome (linting & formatting)
- **Testing:** Vitest + Testing Library
- **Email Development:** React Email

## 🚀 Getting Started

### Prerequisites

- Node.js 22+ and pnpm
- Cloudflare account (for production deployment)
- Stripe account (for billing features)
- Email service account (Resend or Brevo)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/wodsmith.git
   cd wodsmith
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .dev.vars.example .dev.vars
   cp .env.example .env
   ```
   Fill in the required values in both files.

4. **Initialize the database**
   ```bash
   pnpm db:migrate:dev
   pnpm db:seed  # Optional: seed with sample data
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## 💻 Development

### Available Scripts

#### Development
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build locally

#### Database
- `pnpm db:generate [name]` - Generate new migration
- `pnpm db:migrate:dev` - Apply migrations locally
- `pnpm db:studio` - Open Drizzle Studio for database management
- `pnpm db:seed` - Seed database with sample data

#### Code Quality
- `pnpm lint` - Run Biome linter
- `pnpm format` - Format code with Biome
- `pnpm type-check` - Run TypeScript type checking
- `pnpm test` - Run tests with Vitest

#### Email Development
- `pnpm email:dev` - Start email template development server (port 3001)

### Development Guidelines

1. **Never write SQL migrations manually** - Always use `pnpm db:generate`
2. **Use Server Components by default** - Add `use client` only when necessary
3. **Follow the established patterns** - Check existing code for conventions
4. **Type safety is mandatory** - No `any` types allowed
5. **Test your changes** - Write tests for new features

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── (main)/            # Main application
│   │   ├── workouts/      # Workout management
│   │   ├── programming/   # Programming tracks
│   │   ├── log/          # Workout logging
│   │   ├── movements/    # Movement library
│   │   └── calculator/   # Workout calculators
│   ├── (admin)/          # Admin dashboard
│   ├── (settings)/       # User settings
│   └── api/              # API routes
├── components/           # Reusable React components
├── db/                   # Database configuration
│   ├── schemas/         # Database schema definitions
│   └── migrations/      # Auto-generated migrations
├── server/              # Server-side business logic
├── actions/             # Server actions (ZSA)
├── utils/               # Utility functions
├── state/               # Client state management (Zustand)
├── schemas/             # Zod validation schemas
└── react-email/         # Email templates
```

## 🗄 Database Schema

The application uses a modular database schema with the following main entities:

### Core Tables
- **Users** - User accounts and authentication
- **Teams** - Multi-tenant team management
- **Workouts** - Workout definitions and components
- **Movements** - Exercise movement library
- **Programming Tracks** - Training programs
- **Workout Results** - Athlete performance data
- **Schedule Templates** - Recurring programming patterns

### Supporting Tables
- **Team Memberships** - User-team relationships
- **Team Roles** - Custom roles and permissions
- **Billing** - Credit transactions and usage
- **Sessions** - User authentication sessions

## 🚢 Deployment

### Cloudflare Workers Deployment

1. **Create Cloudflare resources**
   - Create D1 database
   - Create KV namespace for sessions
   - Set up Turnstile for CAPTCHA

2. **Configure environment variables**
   - Set `RESEND_API_KEY` or `BREVO_API_KEY`
   - Set `TURNSTILE_SECRET_KEY`
   - Configure Stripe keys

3. **Update wrangler.jsonc**
   - Add your Cloudflare account ID
   - Update database and KV namespace IDs
   - Configure environment variables

4. **Set up GitHub Actions**
   ```bash
   # Add to GitHub secrets
   CLOUDFLARE_API_TOKEN=your_token

   # Add to GitHub variables
   CLOUDFLARE_ACCOUNT_ID=your_account_id
   CLOUDFLARE_ZONE_ID=your_zone_id  # Optional
   ```

5. **Deploy**
   ```bash
   pnpm deploy:prod
   ```

### Environment Variables

#### Required Variables
- `DATABASE_URL` - D1 database connection
- `KV_SESSIONS` - KV namespace for sessions
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Turnstile site key
- `RESEND_API_KEY` or `BREVO_API_KEY` - Email service API key

#### Optional Variables
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

Tests are located in the `test/` directory and use Vitest with Testing Library.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

We use semantic commit messages:
- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `docs:` - Documentation changes
- `test:` - Test additions or changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Cloudflare Workers Next.js SaaS Template](https://github.com/LubomirGeorgiev/cloudflare-workers-nextjs-saas-template)
- UI components from [Shadcn UI](https://ui.shadcn.com)
- Drag and drop powered by [Atlaskit Pragmatic Drag and Drop](https://atlassian.design/components/pragmatic-drag-and-drop)

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

Built with ❤️ for the CrossFit community
