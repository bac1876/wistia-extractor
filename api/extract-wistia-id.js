const https = require('https');
const http = require('http');
const tls = require('tls');
const { URL } = require('url');

// Create browser-like cipher order to bypass TLS fingerprinting
const defaultCiphers = tls.DEFAULT_CIPHERS.split(':');
const browserCiphers = [
    // Reorder to match Chrome's cipher preference
    defaultCiphers[2], // TLS_AES_128_GCM_SHA256 (Chrome's #1 choice)
    defaultCiphers[0], // TLS_AES_256_GCM_SHA384 (Chrome's #2 choice)  
    defaultCiphers[1], // TLS_CHACHA20_POLY1305_SHA256 (Chrome's #3 choice)
    ...defaultCiphers.slice(3) // Rest in original order
].join(':');

// Helper function to make HTTP requests with browser-like TLS fingerprint
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        ...options.headers
      }
    };

    // Apply browser-like cipher order for HTTPS requests
    if (isHttps) {
      requestOptions.ciphers = browserCiphers;
      requestOptions.secureProtocol = 'TLSv1_2_method'; // Use TLS 1.2 like browsers
    }

    if (options.body) {
      requestOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
    }

    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          url: res.url || url
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

// Function to extract cookies from response headers
function extractCookies(headers) {
  const cookies = [];
  const setCookieHeaders = headers['set-cookie'] || [];
  
  setCookieHeaders.forEach(cookie => {
    const cookieParts = cookie.split(';')[0];
    cookies.push(cookieParts);
  });
  
  return cookies.join('; ');
}

// Function to extract authenticity token from HTML (matching Python version)
function extractAuthenticityToken(html) {
  // Try input field first (most common for login forms)
  const inputMatch = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/i);
  if (inputMatch) {
    return inputMatch[1];
  }
  
  // Fallback to meta tag
  const metaMatch = html.match(/name="csrf-token"[^>]*content="([^"]+)"/i);
  if (metaMatch) {
    return metaMatch[1];
  }
  
  return null;
}

// Function to extract Wistia ID from HTML (comprehensive patterns from Python version)
function extractWistiaId(html) {
  // Pattern 1: Iframe src attribute
  const iframeMatches = html.matchAll(/src="[^"]*(?:wistia\.com\/embed\/(?:iframe|medias)\/|fast\.wistia\.net\/embed\/(?:iframe|medias)\/)([a-zA-Z0-9]{10})[^"]*"/g);
  for (const match of iframeMatches) {
    return match[1];
  }

  // Pattern 2: Div class names (e.g., wistia_async_VIDEO_ID)
  const asyncMatches = html.matchAll(/class="[^"]*wistia_async_([a-zA-Z0-9]{10})[^"]*"/g);
  for (const match of asyncMatches) {
    return match[1];
  }

  // Pattern 3: JavaScript embed calls
  const jsEmbedMatches = html.matchAll(/Wistia\.embed\s*\(\s*["']([a-zA-Z0-9]{10})["']/gi);
  for (const match of jsEmbedMatches) {
    return match[1];
  }

  // Pattern 4: JSON properties
  const jsonMatches = html.matchAll(/["'](?:wistiaId|media_key|hashed_id|videoId)["']\s*:\s*["']([a-zA-Z0-9]{10})["']/g);
  for (const match of jsonMatches) {
    return match[1];
  }

  // Pattern 5: Data attributes
  const dataMatches = html.matchAll(/data-(?:wistia-id|video-id)="([a-zA-Z0-9]{10})"/g);
  for (const match of dataMatches) {
    return match[1];
  }

  // Pattern 6: Div IDs or classes like wistia_VIDEOID
  const wistiaWrapperMatches = html.matchAll(/(?:id|class)="[^"]*wistia_([a-zA-Z0-9]{10})[^"]*"/g);
  for (const match of wistiaWrapperMatches) {
    return match[1];
  }

  // Pattern 7: General Wistia ID pattern in any context
  const generalMatches = html.matchAll(/[^a-zA-Z0-9]([a-zA-Z0-9]{10})[^a-zA-Z0-9]/g);
  for (const match of generalMatches) {
    // Check if this ID appears in a Wistia context
    const id = match[1];
    const contextRegex = new RegExp(`wistia[^a-zA-Z0-9]{0,50}${id}|${id}[^a-zA-Z0-9]{0,50}wistia`, 'i');
    if (contextRegex.test(html)) {
      return id;
    }
  }

  return null;
}

// Main handler function
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, email, password } = req.body;

    if (!url || !email || !password) {
      return res.status(400).json({ error: 'Missing required parameters: url, email, password' });
    }

    console.log('Starting extraction process for URL:', url);
    console.log('Using browser-like TLS fingerprint to bypass detection');

    // Step 1: Get the login page to extract authenticity token and cookies
    console.log('Fetching login page...');
    const loginPageUrl = 'https://www.empowermentsuccess.com/login';
    
    let loginPageResponse;
    try {
      loginPageResponse = await makeRequest(loginPageUrl);
    } catch (error) {
      console.error('Error fetching login page:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch login page', 
        message: error.message,
        success: false
      });
    }
    
    if (loginPageResponse.statusCode !== 200) {
      console.error('Login page returned status:', loginPageResponse.statusCode);
      return res.status(500).json({ 
        error: `Failed to fetch login page: ${loginPageResponse.statusCode}`,
        success: false
      });
    }

    const cookies = extractCookies(loginPageResponse.headers);
    const authToken = extractAuthenticityToken(loginPageResponse.body);
    
    console.log('Successfully extracted cookies and authenticity token');

    // Step 2: Submit login credentials (matching Python version exactly)
    console.log('Submitting login credentials...');
    const loginData = new URLSearchParams({
      'utf8': '✓',
      'authenticity_token': authToken || '',
      'member[email]': email,
      'member[password]': password,
      'member[remember_me]': '0',
      'commit': 'Sign In'
    }).toString();

    let loginResponse;
    try {
      loginResponse = await makeRequest(loginPageUrl, {
        method: 'POST',
        headers: {
          'Cookie': cookies,
          'Referer': loginPageUrl,
          'Origin': 'https://www.empowermentsuccess.com',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: loginData
      });
    } catch (error) {
      console.error('Error during login:', error);
      return res.status(500).json({ 
        error: 'Login request failed', 
        message: error.message,
        success: false
      });
    }

    // Update cookies with login session
    const sessionCookies = extractCookies(loginResponse.headers);
    const allCookies = cookies + (sessionCookies ? '; ' + sessionCookies : '');

    console.log('Login response status:', loginResponse.statusCode);

    // Check for successful login (matching Python logic)
    const loginSuccessful = loginResponse.statusCode >= 300 && loginResponse.statusCode < 400 || 
                           (loginResponse.url && loginResponse.url !== loginPageUrl && !loginResponse.url.toLowerCase().includes('login')) ||
                           (!loginResponse.body.includes('Sign in to your account') && !loginResponse.body.includes('Invalid email or password'));

    if (!loginSuccessful) {
      console.error('Login appears to have failed');
      return res.status(401).json({ 
        error: 'Login failed', 
        message: 'Please check your credentials',
        success: false
      });
    }

    console.log('Login successful!');

    // Step 3: Access the target page with authenticated session
    console.log('Accessing target page with authenticated session...');
    let targetResponse;
    try {
      targetResponse = await makeRequest(url, {
        headers: {
          'Cookie': allCookies,
          'Referer': loginPageUrl
        }
      });
    } catch (error) {
      console.error('Error accessing target page:', error);
      return res.status(500).json({ 
        error: 'Failed to access target page', 
        message: error.message,
        success: false
      });
    }

    if (targetResponse.statusCode !== 200) {
      console.error('Target page returned status:', targetResponse.statusCode);
      return res.status(500).json({ 
        error: `Failed to access target page: ${targetResponse.statusCode}`,
        success: false
      });
    }

    console.log('Successfully accessed target page');

    // Step 4: Extract Wistia ID from the page content
    const wistiaId = extractWistiaId(targetResponse.body);

    if (wistiaId) {
      console.log('Found Wistia ID:', wistiaId);
      return res.status(200).json({ 
        success: true, 
        wistiaId: wistiaId,
        message: `Wistia ID found: ${wistiaId}`
      });
    } else {
      console.log('No Wistia ID found in page content');
      return res.status(200).json({ 
        success: false, 
        message: 'NO VIDEO',
        wistiaId: null
      });
    }

  } catch (error) {
    console.error('Error during extraction:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      success: false
    });
  }
}
