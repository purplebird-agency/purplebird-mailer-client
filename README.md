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

**Required Environment Variables:**
- `MAILER_BASE_URL` - Base URL of the Purple Bird Mailer API (e.g., `https://mailer.purplebird.agency/api`)
- `MAILER_FORM_ID` - Your form ID
- `MAILER_FORM_API_KEY` - Your API key for authentication

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

## Repository

https://github.com/purplebird-agency/mailer-client

