# F3 Nation Auth Provider

## Overview

Central authentication service for F3 Nation applications using Next.js, NextAuth, and Drizzle ORM with PostgreSQL. This service provides email-based authentication with verification codes sent via Twilio.

## Technical Stack

- Next.js 15.4.4 with App Router
- NextAuth 4.24.11 with custom email provider
- Drizzle ORM 0.44.3
- PostgreSQL database
- Twilio for email verification
- TailwindCSS for styling

## Key Features

- **Email-based authentication** with verification codes
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
│   └── twilio/
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

# Twilio Configuration (for email verification)
TWILIO_ACCOUNT_SID="your-twilio-account-sid"
TWILIO_AUTH_TOKEN="your-twilio-auth-token"
TWILIO_VERIFY_SERVICE_SID="your-twilio-verify-service-sid"
TWILIO_SENDGRID_API_KEY="your-sendgrid-api-key"
TWILIO_SENDGRID_TEMPLATE_ID="your-sendgrid-template-id"

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
