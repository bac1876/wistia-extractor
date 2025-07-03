const https = require('https');
const http = require('http');
const { URL } = require('url');

// Helper function to make HTTP requests
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...options.headers
      }
    };

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
          body: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
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

// Function to extract CSRF token from HTML
function extractCSRFToken(html) {
  const csrfMatches = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/i) ||
                     html.match(/name="csrf-token"[^>]*content="([^"]+)"/i) ||
                     html.match(/"csrf_token":"([^"]+)"/i);
  
  return csrfMatches ? csrfMatches[1] : null;
}

// Function to extract Wistia ID from HTML
function extractWistiaId(html) {
  // Multiple patterns to match Wistia video IDs
  const patterns = [
    /wistia_async_([a-zA-Z0-9]+)/g,
    /wistia\.com\/embed\/iframe\/([a-zA-Z0-9]+)/g,
    /wistia\.com\/medias\/([a-zA-Z0-9]+)/g,
    /wistia\.net\/deliver\/async\/([a-zA-Z0-9]+)/g,
    /"wistia_id":"([a-zA-Z0-9]+)"/g,
    /"hashedId":"([a-zA-Z0-9]+)"/g,
    /data-wistia-id="([a-zA-Z0-9]+)"/g,
    /wistiaEmbed\s*=\s*Wistia\.embed\("([a-zA-Z0-9]+)"/g,
    /Wistia\.embed\("([a-zA-Z0-9]+)"/g
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    if (matches.length > 0) {
      // Return the first match found
      return matches[0][1];
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

    // Step 1: Get the login page to extract CSRF token and cookies
    console.log('Fetching login page...');
    const loginPageUrl = 'https://www.empowermentsuccess.com/login';
    const loginPageResponse = await makeRequest(loginPageUrl);
    
    if (loginPageResponse.statusCode !== 200) {
      throw new Error(`Failed to fetch login page: ${loginPageResponse.statusCode}`);
    }

    const cookies = extractCookies(loginPageResponse.headers);
    const csrfToken = extractCSRFToken(loginPageResponse.body);
    
    console.log('Extracted cookies and CSRF token');

    // Step 2: Submit login credentials
    console.log('Submitting login credentials...');
    const loginData = new URLSearchParams({
      'user[email]': email,
      'user[password]': password,
      'authenticity_token': csrfToken || '',
      'commit': 'Log In'
    }).toString();

    const loginResponse = await makeRequest(loginPageUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Referer': loginPageUrl,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: loginData
    });

    // Update cookies with login session
    const sessionCookies = extractCookies(loginResponse.headers);
    const allCookies = cookies + (sessionCookies ? '; ' + sessionCookies : '');

    console.log('Login response status:', loginResponse.statusCode);

    // Step 3: Access the target page with authenticated session
    console.log('Accessing target page with authenticated session...');
    const targetResponse = await makeRequest(url, {
      headers: {
        'Cookie': allCookies,
        'Referer': loginPageUrl
      }
    });

    if (targetResponse.statusCode !== 200) {
      throw new Error(`Failed to access target page: ${targetResponse.statusCode}`);
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

