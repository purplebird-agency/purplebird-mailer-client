# @purplebird/mailer-client

Client-side integration package for Purple Bird Mailer API. This package provides utilities for handling form submissions to the Purple Bird Mailer API via Netlify Functions.

## Installation

```bash
npm install @purplebird/mailer-client
```

## Usage

### Form Helper (Client-side)

```javascript
import { submitMailerForm, initMailerForm } from '@purplebird/mailer-client';

// Option 1: Manual submission
const form = document.querySelector('#contact-form');
await submitMailerForm(form, {
  endpoint: '/.netlify/functions/submit-contact',
  onSuccess: (result) => console.log('Success!', result),
  onError: (error) => console.error('Error:', error)
});

// Option 2: Auto-initialize form handler
initMailerForm('#contact-form', {
  endpoint: '/.netlify/functions/submit-contact',
  successMessage: '#success-message',
  errorMessage: '#error-message',
  onSubmitButton: '#submit-button'
});
```

### Netlify Function (Server-side)

The `netlify-function.js` file should be deployed as a Netlify Function. It handles form submissions and forwards them to the Purple Bird Mailer API.

**Option 1: Explicit Configuration (Recommended)**

For better flexibility and testability, use the `createMailerHandler()` factory function:

```javascript
// netlify/functions/submit-contact.js
const { createMailerHandler } = require('@purplebird/mailer-client/netlify-function');

exports.handler = createMailerHandler({
  baseUrl: 'https://mailer.purplebird.agency/api',
  formId: 'your-form-id',
  apiKey: 'your-api-key',
  debug: false // optional, defaults to MAILER_DEBUG env var or NODE_ENV=development
});
```

**Option 2: Environment Variables (Backward Compatible)**

You can still use environment variables for configuration:

```javascript
// netlify/functions/submit-contact.js
const { handler } = require('@purplebird/mailer-client/netlify-function');
exports.handler = handler;
```

Or simply copy `netlify-function.js` to your `netlify/functions/` directory and it will work with environment variables out of the box.

**Required Environment Variables (if using Option 2):**
- `MAILER_BASE_URL` - Base URL of the Purple Bird Mailer API (e.g., `https://mailer.purplebird.agency/api`)
- `MAILER_FORM_ID` - Your form ID
- `MAILER_FORM_API_KEY` - Your API key for authentication

**Note:** The explicit configuration pattern (Option 1) is recommended for packages as it:
- Makes dependencies explicit and easier to test
- Allows multiple instances with different configurations
- Works better in different deployment environments
- Falls back to environment variables if config is not provided

## Features

- ✅ Form submission handling
- ✅ File upload support
- ✅ Honeypot spam protection
- ✅ Rate limiting
- ✅ Error handling
- ✅ Success/error callbacks
- ✅ Automatic form state management

## Peer Dependencies

This package requires the following peer dependencies (for the Netlify function):

- `busboy` (^1.6.0)
- `form-data` (^4.0.4)

## License

MIT

## Publishing

This package uses GitHub Actions for automated publishing to npm. To publish a new version:

### Setup (One-time)

1. Create an npm access token with publish permissions:
   - Go to https://www.npmjs.com/settings/[your-username]/tokens
   - Create a new "Automation" token
   - Copy the token

2. Add the token as a GitHub secret:
   - Go to your repository settings → Secrets and variables → Actions
   - Add a new secret named `NPM_TOKEN` with your npm token value

### Publishing a New Version

**Option 1: Using npm scripts (recommended)**
```bash
# Patch version (1.0.0 → 1.0.1)
npm run version:patch

# Minor version (1.0.0 → 1.1.0)
npm run version:minor

# Major version (1.0.0 → 2.0.0)
npm run version:major
```

These scripts will:
- Update `package.json` version
- Create a git commit and tag (e.g., `v1.0.1`)
- Push to GitHub
- Trigger the GitHub Action to publish to npm

**Note:** The workflow automatically checks if a version already exists on npm and will skip publishing if it does (to prevent errors). Always bump the version before publishing.

**Option 2: Manual tagging**
```bash
# Update version in package.json manually, then:
git add package.json
git commit -m "chore: bump version to 1.0.1"
git tag v1.0.1
git push origin main --tags
```

**Option 3: Manual publish (for testing)**
```bash
npm publish --access public
```

## Repository

https://github.com/purplebird-agency/purplebird-mailer-client

