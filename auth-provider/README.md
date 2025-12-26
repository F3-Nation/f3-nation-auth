# F3 Nation Auth Provider

## Overview

Central authentication service for F3 Nation applications using Next.js, NextAuth, and Drizzle ORM with PostgreSQL. This service provides email-based authentication with verification codes backed by PostgreSQL and delivered via SendGrid.

## Technical Stack

- Next.js 15.4.4 with App Router
- NextAuth 4.24.11 with custom email provider
- Drizzle ORM 0.44.3
- PostgreSQL database
- SendGrid for transactional email delivery
- TailwindCSS for styling

## Key Features

- **Email-based authentication** with verification codes
- **Custom MFA store** with hashed codes persisted in PostgreSQL
- **Database sessions** with Drizzle adapter
- **OAuth provider** for other F3 Nation applications
- **User onboarding** with F3 name and hospital name
- **Session management** across subdomains
- **Responsive UI** with dark/light theme support

## Project Structure

```
auth-provider/
├── .env.local                    # Environment variables
├── package.json                  # Dependencies
├── drizzle.config.ts            # Database configuration
├── db/
│   ├── schema.ts                # Database schema
│   └── index.ts                 # Database connection
├── app/
│   ├── page.tsx                 # Home page
│   ├── login/
│   │   ├── page.tsx             # Login options
│   │   └── email/
│   │       ├── page.tsx         # Email input
│   │       └── verify/
│   │           └── page.tsx     # Code verification
│   ├── onboarding/
│   │   └── page.tsx             # User onboarding
│   └── api/
│       ├── auth/[...nextauth]/  # NextAuth handler
│       ├── verify-email/        # Email verification
│       ├── onboarding/          # Complete onboarding
│       ├── session/             # Session info
│       └── oauth/               # OAuth endpoints
├── lib/
│   ├── auth.ts                  # NextAuth configuration
│   └── mfa/
│       └── index.ts             # Email verification service
└── components/
    ├── SignOutButton.tsx        # Sign out component
    └── ThemeImage.tsx           # Theme-aware images
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# NextAuth Configuration
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# Database
DATABASE_URL="your-postgresql-connection-string"

# Email Verification
TWILIO_SENDGRID_API_KEY="your-sendgrid-api-key"
TWILIO_SENDGRID_TEMPLATE_ID="your-sendgrid-template-id"
EMAIL_VERIFICATION_SENDER="support.auth@f3nation.com"

# OAuth Client Secrets (for F3 applications)
OAUTH_CLIENT_SECRET_LOCAL_CLIENT="your-local-client-secret"
OAUTH_CLIENT_SECRET_F3_APP_CLIENT="your-f3-app-client-secret"
OAUTH_CLIENT_SECRET_F3_APP2_CLIENT="your-f3-app2-client-secret"
OAUTH_CLIENT_SECRET_AUTH_PROVIDER_LOCAL="your-auth-provider-local-secret"
OAUTH_CLIENT_SECRET_AUTH_PROVIDER_PROD="your-auth-provider-prod-secret"
```

## Development Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your actual values
   ```

3. **Set up the database:**

   ```bash
   npm run db:push
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

## Database Commands

```bash
# Generate migration files
npm run db:generate

# Push schema changes to database
npm run db:push

# Reset database (development only)
npm run db:reset

# Seed database with OAuth clients
npm run db:seed
```

## Local Development Database

Run a local PostgreSQL instance with Docker for development without affecting staging/production. The local setup includes two databases:

- **f3auth_dev** - Auth provider database (`DATABASE_URL`)
- **f3prod_dev** - F3 production data database (`F3_DATABASE_URL`)

### Prerequisites

- Docker Desktop
- PostgreSQL client tools (`pg_dump`, `psql`)
  - macOS: `brew install libpq && brew link --force libpq`
  - Ubuntu: `sudo apt-get install postgresql-client`

### Workflow

```bash
# Take snapshots from staging/production (both databases)
npm run db:snapshot:all

# Or snapshot individually
npm run db:snapshot           # f3auth_dev (DATABASE_URL)
npm run db:snapshot:f3prod    # f3prod_dev (F3_DATABASE_URL)

# Start local PostgreSQL
npm run db:local:up

# Seed from snapshots
npm run db:local:seed:all     # Both databases
npm run db:local:seed         # f3auth_dev only
npm run db:local:seed:f3prod  # f3prod_dev only

# Update .env.local to use local databases:
# DATABASE_URL=postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev
# F3_DATABASE_URL=postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev

# Run dev server
npm run dev

# When done
npm run db:local:down
```

### Available Commands

| Command                         | Description                                    |
| ------------------------------- | ---------------------------------------------- |
| `npm run db:snapshot`           | Snapshot f3auth_dev (DATABASE_URL)             |
| `npm run db:snapshot:schema`    | Schema only for f3auth_dev                     |
| `npm run db:snapshot:data`      | Data only for f3auth_dev                       |
| `npm run db:snapshot:f3prod`    | Snapshot f3prod_dev (F3_DATABASE_URL)          |
| `npm run db:snapshot:all`       | Snapshot both databases                        |
| `npm run db:local:up`           | Start local PostgreSQL container               |
| `npm run db:local:down`         | Stop container (preserves data)                |
| `npm run db:local:seed`         | Seed f3auth_dev from latest snapshot           |
| `npm run db:local:seed:f3prod`  | Seed f3prod_dev from latest snapshot           |
| `npm run db:local:seed:all`     | Seed both databases                            |
| `npm run db:local:reset`        | Full reset: stop, remove data, start, seed all |
| `npm run db:local:reset:f3auth` | Reset and seed f3auth_dev only                 |
| `npm run db:local:reset:f3prod` | Reset and seed f3prod_dev only                 |

### Connection Details

| Database   | User   | Password         | Connection String                                                |
| ---------- | ------ | ---------------- | ---------------------------------------------------------------- |
| f3auth_dev | f3auth | f3auth_local_dev | `postgresql://f3auth:f3auth_local_dev@localhost:5433/f3auth_dev` |
| f3prod_dev | f3prod | f3prod_local_dev | `postgresql://f3prod:f3prod_local_dev@localhost:5433/f3prod_dev` |

### Notes

- Snapshots are stored in `db-snapshots/<database>/<timestamp>/`
- Both databases run in the same PostgreSQL container on port 5433
- Don't share snapshots externally as they contain auth and production data
- Use `npm run db:local:down --remove-data` to completely reset the Docker volume
- After removing data, run `npm run db:local:reset` to reinitialize both databases

## Authentication Flow

1. **User visits login page** and chooses email authentication
2. **User enters email address** and receives verification code via email
3. **User enters verification code** to complete authentication
4. **New users complete onboarding** with F3 name and hospital name
5. **User is redirected** to the requesting application

## OAuth Provider

This service acts as an OAuth 2.0 provider for other F3 Nation applications:

- **Authorization endpoint:** `/api/oauth/authorize`
- **Token endpoint:** `/api/oauth/token`
- **User info endpoint:** `/api/oauth/userinfo`
- **OpenID configuration:** `/api/.well-known/openid_configuration`

### Supported OAuth Clients

The system supports multiple OAuth clients configured in `oauth-clients.ts`:

- `local-client` - Local development client
- `f3-app-client` - Production F3 app
- `f3-app2-client` - Secondary F3 app
- `auth-provider-local` - Local auth provider
- `auth-provider-prod` - Production auth provider

## Deployment

The application is configured for deployment on Firebase App Hosting:

1. **Configure secrets** in Google Cloud Secret Manager
2. **Update `apphosting.yaml`** with your configuration
3. **Deploy** using Firebase CLI

Environment variables are automatically loaded from Google Cloud Secret Manager in production.

## API Endpoints

### Authentication

- `POST /api/auth/signin` - Sign in with email
- `POST /api/verify-email` - Verify email code
- `POST /api/onboarding` - Complete user onboarding
- `GET /api/session` - Get current session

### OAuth 2.0

- `GET /api/oauth/authorize` - OAuth authorization
- `POST /api/oauth/token` - Token exchange
- `GET /api/oauth/userinfo` - User information

## Security Features

- **Email verification** required for all sign-ins
- **Secure session management** with database storage
- **CSRF protection** built into NextAuth
- **Secure cookies** with proper domain and security settings
- **OAuth 2.0 compliance** with PKCE support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary to F3 Nation.
