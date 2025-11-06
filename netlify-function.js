const Busboy = require('busboy');
const FormData = require('form-data');

// Debug mode - set MAILER_DEBUG=true or NODE_ENV=development to enable verbose logging
const DEBUG = process.env.MAILER_DEBUG === 'true' || process.env.NODE_ENV === 'development';

const log = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const logError = (...args) => {
  // Always log errors, even in production
  console.error(...args);
};

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get environment variables
    const MAILER_BASE_URL = process.env.MAILER_BASE_URL;
    const MAILER_FORM_ID = process.env.MAILER_FORM_ID;
    const MAILER_FORM_API_KEY = process.env.MAILER_FORM_API_KEY;

    if (!MAILER_BASE_URL || !MAILER_FORM_ID || !MAILER_FORM_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing required environment variables: MAILER_BASE_URL, MAILER_FORM_ID, MAILER_FORM_API_KEY'
        })
      };
    }

    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');

    if (isMultipart) {
      // Handle multipart/form-data (with file uploads)
      return await handleMultipartRequest(event, {
        MAILER_BASE_URL,
        MAILER_FORM_ID,
        MAILER_FORM_API_KEY
      });
    } else {
      // Handle JSON request (backward compatibility)
      return await handleJsonRequest(event, {
        MAILER_BASE_URL,
        MAILER_FORM_ID,
        MAILER_FORM_API_KEY
      });
    }
  } catch (error) {
    logError('Submit contact error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

async function handleMultipartRequest(event, config) {
  const { MAILER_BASE_URL, MAILER_FORM_ID, MAILER_FORM_API_KEY } = config;
  
  // Debug logging
  log('=== handleMultipartRequest Debug ===');
  log('Content-Type:', event.headers['content-type'] || event.headers['Content-Type']);
  log('isBase64Encoded:', event.isBase64Encoded);
  log('Body length:', event.body?.length || 0);
  log('Body preview (first 200 chars):', event.body?.substring(0, 200));
  
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: event.headers });
    const fields = {};
    const files = [];
    let fieldsProcessed = false;
    let pendingFiles = 0;
    let completedFiles = 0;

    busboy.on('field', (name, value) => {
      // Skip internal/honeypot fields
      if (name === 'form-name' || name === 'bot-field') {
        return;
      }
      fields[name] = value;
    });

    busboy.on('file', (name, file, info) => {
      const { filename, encoding, mimeType } = info;
      log(`[Busboy] File detected: name="${name}", filename="${filename}", mimeType="${mimeType}"`);
      
      // Skip if no filename (empty file input)
      if (!filename || filename.trim() === '') {
        log('[Busboy] Skipping empty file input');
        file.resume(); // Drain the stream
        return;
      }
      
      const chunks = [];
      pendingFiles++;
      
      file.on('data', (chunk) => {
        chunks.push(chunk);
        log(`[Busboy] File "${filename}" chunk received: ${chunk.length} bytes`);
      });

      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        log(`[Busboy] File "${filename}" complete: ${buffer.length} bytes total`);
        
        // Only add files with actual content
        if (buffer.length > 0) {
          files.push({ 
            name, 
            filename, 
            type: mimeType, 
            buffer: buffer,
            size: buffer.length 
          });
        } else {
          log(`[Busboy] Skipping empty file: ${filename}`);
        }
        
        completedFiles++;
        checkAndForward();
      });
      
      file.on('error', (error) => {
        logError(`[Busboy] Error processing file "${filename}":`, error);
      });
    });

    function checkAndForward() {
      if (fieldsProcessed && (pendingFiles === 0 || completedFiles === pendingFiles)) {
        forwardRequest();
      }
    }

    async function forwardRequest() {
      try {
        // Verify formId is set
        if (!MAILER_FORM_ID) {
          throw new Error('MAILER_FORM_ID environment variable is not set');
        }

        // Ensure formId is a string
        const formIdValue = String(MAILER_FORM_ID).trim();
        if (!formIdValue) {
          throw new Error('MAILER_FORM_ID is empty or invalid');
        }
        
        log('Form ID being sent:', formIdValue);
        log('Fields being sent:', Object.keys(fields));
        log('Total fields:', Object.keys(fields).length);
        log('Total files:', files.length);

        // Manually construct multipart form data as a string
        // This ensures compatibility with the mailer's parser
        const boundary = `----formdata-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const parts = [];
        const CRLF = '\r\n';
        
        // Add formId first (required by mailer)
        parts.push(`--${boundary}${CRLF}`);
        parts.push(`Content-Disposition: form-data; name="formId"${CRLF}`);
        parts.push(`${CRLF}`);
        parts.push(formIdValue);
        parts.push(CRLF);
        
        // Add all other fields
        for (const [name, value] of Object.entries(fields)) {
          if (name !== 'formId' && name !== 'form-name' && name !== 'bot-field') {
            parts.push(`--${boundary}${CRLF}`);
            parts.push(`Content-Disposition: form-data; name="${name}"${CRLF}`);
            parts.push(`${CRLF}`);
            parts.push(String(value));
            parts.push(CRLF);
          }
        }
        
        // Add all files
        for (const file of files) {
          parts.push(`--${boundary}${CRLF}`);
          parts.push(`Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${CRLF}`);
          parts.push(`Content-Type: ${file.type}${CRLF}`);
          parts.push(`${CRLF}`);
          // For files, we need to append the binary data
          parts.push(file.buffer);
          parts.push(CRLF);
        }
        
        // Close boundary
        parts.push(`--${boundary}--${CRLF}`);
        
        // Combine into buffer
        // For string parts, convert to buffer; for buffers, use as-is
        const buffers = parts.map(part => 
          Buffer.isBuffer(part) ? part : Buffer.from(part, 'utf8')
        );
        const multipartBody = Buffer.concat(buffers);
        
        log('Constructed multipart body size:', multipartBody.length);
        log('Boundary:', boundary);
        
        // Forward to mailer upload endpoint
        // MAILER_BASE_URL should include /api path (e.g. https://mailer.purplebird.agency/api)
        const uploadUrl = `${MAILER_BASE_URL}/form-submissions-upload`;
        log('Sending to mailer upload endpoint:', uploadUrl);
        
        const mailerResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MAILER_FORM_API_KEY}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`
          },
          body: multipartBody,
        });
        
        log('Mailer response status:', mailerResponse.status);

        const responseContentType = mailerResponse.headers.get('content-type') || '';
        let mailerJson;
        
        if (responseContentType.includes('application/json')) {
          mailerJson = await mailerResponse.json();
        } else {
          const text = await mailerResponse.text();
          logError('Mailer returned non-JSON response:', {
            status: mailerResponse.status,
            contentType: responseContentType,
            responsePreview: text.substring(0, 200)
          });
          
          return resolve({
            statusCode: mailerResponse.status || 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              success: false,
              error: `Mailer API returned invalid response (${mailerResponse.status}). Check mailer logs.`,
              details: responseContentType.includes('html') ? 'Received HTML instead of JSON' : `Content-Type: ${responseContentType}`
            })
          });
        }

        if (!mailerResponse.ok) {
          logError('Mailer API error response:', {
            status: mailerResponse.status,
            body: mailerJson
          });
          return resolve({
            statusCode: mailerResponse.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(mailerJson)
          });
        }

        resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: true,
            data: mailerJson
          })
        });
      } catch (error) {
        reject(error);
      }
    }

    busboy.on('finish', () => {
      log(`[Busboy] Parsing finished. Fields: ${Object.keys(fields).length}, Files: ${files.length}, Pending: ${pendingFiles}`);
      fieldsProcessed = true;
      // If no files, forward immediately
      if (pendingFiles === 0) {
        forwardRequest();
      } else {
        checkAndForward();
      }
    });

    busboy.on('error', (error) => {
      logError('[Busboy] Parsing error:', error);
      reject(error);
    });

    // Parse the body
    // Netlify Functions always provide the body as a string, but may set isBase64Encoded
    // For binary data (like file uploads), we need to decode it properly
    let bodyBuffer;
    if (event.isBase64Encoded) {
      bodyBuffer = Buffer.from(event.body, 'base64');
    } else {
      // For non-base64, convert string to Buffer using 'binary' encoding
      // to preserve byte values for multipart boundaries and file data
      bodyBuffer = Buffer.from(event.body || '', 'binary');
    }
    
    busboy.write(bodyBuffer);
    busboy.end();
  });
}

async function handleJsonRequest(event, config) {
  const { MAILER_BASE_URL, MAILER_FORM_ID, MAILER_FORM_API_KEY } = config;
  
  const body = JSON.parse(event.body || '{}');
  
  // Remove internal fields if present
  delete body['form-name'];
  delete body['bot-field'];

  // Forward to mailer API (regular endpoint)
  log('Sending to mailer:', `${MAILER_BASE_URL}/form-submissions`);
  const mailerResponse = await fetch(`${MAILER_BASE_URL}/form-submissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MAILER_FORM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      formId: MAILER_FORM_ID,
      formData: body,
    }),
  });

  // Check content type before parsing
  const responseContentType = mailerResponse.headers.get('content-type') || '';
  let mailerJson;
  
  if (responseContentType.includes('application/json')) {
    mailerJson = await mailerResponse.json();
  } else {
    // If not JSON, read as text to see what we got
    const text = await mailerResponse.text();
    logError('Mailer returned non-JSON response:', {
      status: mailerResponse.status,
      contentType: responseContentType,
      url: `${MAILER_BASE_URL}/form-submissions`,
      responsePreview: text.substring(0, 200)
    });
    
    return {
      statusCode: mailerResponse.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: `Mailer API returned invalid response (${mailerResponse.status}). Check mailer logs.`,
        details: responseContentType.includes('html') ? 'Received HTML instead of JSON - check mailer URL' : `Content-Type: ${responseContentType}`
      })
    };
  }

  if (!mailerResponse.ok) {
    return {
      statusCode: mailerResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(mailerJson)
    };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      success: true,
      data: mailerJson
    })
  };
}

