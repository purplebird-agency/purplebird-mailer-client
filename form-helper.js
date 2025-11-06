/**
 * Purple Bird Mailer Client - Form Submission Helper
 * 
 * Provides a utility function for handling form submissions to the Purple Bird Mailer API
 * via the Netlify Function proxy.
 */

/**
 * Submit a form to the Purple Bird Mailer API
 * @param {HTMLFormElement} formElement - The form element to submit
 * @param {Object} options - Configuration options
 * @param {string} options.endpoint - The Netlify function endpoint (default: '/.netlify/functions/submit-contact')
 * @param {Function} options.onSuccess - Callback function called on successful submission
 * @param {Function} options.onError - Callback function called on error
 * @param {Function} options.onSubmit - Callback function called when form is submitted
 * @param {number} options.minSubmissionInterval - Minimum time between submissions in ms (default: 5000)
 * @returns {Promise<Object>} The response from the API
 */
export async function submitMailerForm(formElement, options = {}) {
  const {
    endpoint = '/.netlify/functions/submit-contact',
    onSuccess,
    onError,
    onSubmit,
    minSubmissionInterval = 5000
  } = options;

  // Check honeypot field
  const honeypot = formElement.querySelector('input[name="bot-field"]');
  if (honeypot && honeypot.value) {
    const error = new Error('Spam detected');
    if (onError) onError(error);
    throw error;
  }

  // Rate limiting check (using form data attribute)
  const lastSubmission = formElement.dataset.lastSubmission;
  const now = Date.now();
  if (lastSubmission && now - parseInt(lastSubmission) < minSubmissionInterval) {
    const error = new Error('Please wait before submitting again');
    if (onError) onError(error);
    throw error;
  }

  // Call onSubmit callback
  if (onSubmit) onSubmit();

  try {
    const formData = new FormData(formElement);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      const error = new Error(result?.error || 'Form submission failed');
      if (onError) onError(error);
      throw error;
    }

    // Update last submission time
    formElement.dataset.lastSubmission = now.toString();

    if (onSuccess) onSuccess(result);
    return result;
  } catch (error) {
    if (onError) onError(error);
    throw error;
  }
}

/**
 * Initialize form submission handler for a form element
 * @param {string|HTMLFormElement} formSelector - CSS selector or form element
 * @param {Object} options - Configuration options (see submitMailerForm)
 */
export function initMailerForm(formSelector, options = {}) {
  const form = typeof formSelector === 'string' 
    ? document.querySelector(formSelector)
    : formSelector;

  if (!form) {
    console.warn('Form not found:', formSelector);
    return;
  }

  const {
    onSubmitButton,
    successMessage,
    errorMessage,
    ...submitOptions
  } = options;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const button = onSubmitButton 
      ? (typeof onSubmitButton === 'string' ? document.querySelector(onSubmitButton) : onSubmitButton)
      : form.querySelector('button[type="submit"]');
    
    const successEl = successMessage
      ? (typeof successMessage === 'string' ? document.querySelector(successMessage) : successMessage)
      : null;
    
    const errorEl = errorMessage
      ? (typeof errorMessage === 'string' ? document.querySelector(errorMessage) : errorMessage)
      : null;

    // Disable button
    if (button) {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = button.dataset.loadingText || 'Sending...';
    }

    // Hide previous messages
    if (successEl) successEl.classList.add('hidden');
    if (errorEl) {
      errorEl.classList.add('hidden');
      errorEl.textContent = '';
    }

    try {
      await submitMailerForm(form, {
        ...submitOptions,
        onSubmit: () => {
          if (submitOptions.onSubmit) submitOptions.onSubmit();
        },
        onSuccess: (result) => {
          // Show success message
          if (successEl) {
            successEl.classList.remove('hidden');
          }
          // Hide form or button
          if (button) button.classList.add('hidden');
          
          // Reset form
          form.reset();

          if (submitOptions.onSuccess) submitOptions.onSuccess(result);
        },
        onError: (error) => {
          // Show error message
          if (errorEl) {
            errorEl.textContent = error.message || 'Failed to send message. Please try again.';
            errorEl.classList.remove('hidden');
          }

          if (submitOptions.onError) submitOptions.onError(error);
        }
      });
    } catch (error) {
      // Error already handled in onError callback
      console.error('Form submission error:', error);
    } finally {
      // Re-enable button
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Send Message';
      }
    }
  });
}

// Export default for convenience
export default {
  submitMailerForm,
  initMailerForm
};

