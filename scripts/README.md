# Scripts Configuration

This directory contains shell scripts for managing all F3 Nation Auth applications.

## Shared Configuration

All scripts now use a shared configuration file (`apps.conf`) that defines:

- The list of applications to operate on
- Common validation functions

### Current Applications

- `auth-provider` - OAuth provider service
- `auth-client` - Client application
- `auth-sdk` - Software development kit

## Available Scripts

- `install.sh` - Install dependencies for all applications
- `lint.sh` - Run linting for all applications
- `typecheck.sh` - Run type checking for all applications
- `format.sh` - Format code for all applications
- `build.sh` - Build all applications

## Adding New Applications

To add a new application to all scripts:

1. Edit `scripts/apps.conf`
2. Add the new app name to the `APPS` array
3. All scripts will automatically include the new application

Example:

```bash
APPS=("auth-provider" "auth-client" "auth-sdk" "new-app")
```

## Usage

Run any script from the project root:

```bash
./scripts/install.sh
./scripts/lint.sh
./scripts/typecheck.sh
./scripts/format.sh
./scripts/build.sh
```

Each script will:

1. Source the shared configuration
2. Validate all applications exist
3. Execute the command for each application
4. Report success/failure for each step
