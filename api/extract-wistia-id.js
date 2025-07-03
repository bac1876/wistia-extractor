const https = require('https');

// Helper function to make requests via Web Unlocker API
async function fetchWithWebUnlocker(targetUrl) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BRIGHT_DATA_API_KEY || '7ed816c201449cfea700fa9d279b7c138...'; // Use your full API key
    
    const options = {
      hostname: 'api.brightdata.com',
      port: 443,
      path: '/request',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const postData = JSON.stringify({
      url: targetUrl,
      format: 'raw'
    });

    console.log('Making Web Unlocker API request to:', targetUrl);

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({
            statusCode: 200,
            body: data
          });
        } else {
          reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Web Unlocker API error:', error);
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

// Function to extract authenticity token from HTML
function extractAuthenticityToken(html) {
  const inputMatch = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/i);
  if (inputMatch) {
    return inputMatch[1];
  }
  
  const metaMatch = html.match(/name="csrf-token"[^>]*content="([^"]+)"/i);
  if (metaMatch) {
    return metaMatch[1];
  }
  
  return null;
}

// Function to extract Wistia ID from HTML
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

    // For now, let's try to fetch the target page directly
    // Web Unlocker should handle cookies and sessions automatically
    console.log('Fetching target page via Web Unlocker API...');
    
    let targetResponse;
    try {
      targetResponse = await fetchWithWebUnlocker(url);
    } catch (error) {
      console.error('Error fetching page:', error);
      
      // If direct access fails, we might need to implement login flow
      // For now, let's return a helpful message
      return res.status(500).json({ 
        error: 'Failed to fetch page via Web Unlocker', 
        message: 'The page might require login. Manual login flow implementation needed.',
        details: error.message,
        success: false
      });
    }

    console.log('Successfully fetched page, searching for Wistia ID...');

    // Extract Wistia ID from the page content
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
      
      // Check if login is required
      if (targetResponse.body.includes('Sign in') || targetResponse.body.includes('login')) {
        return res.status(200).json({ 
          success: false, 
          message: 'Page requires login. Manual login flow needed for protected content.',
          wistiaId: null
        });
      }
      
      return res.status(200).json({ 
        success: false, 
        message: 'NO VIDEO - No Wistia ID found on the page',
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
