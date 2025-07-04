// Use CommonJS syntax for better Vercel compatibility
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Helper function to make requests via Web Unlocker Proxy
async function fetchWithWebUnlocker(targetUrl) {
  // Web Unlocker proxy configuration
  const proxy = 'http://brd-customer-hl_b332c2c3-zone-web_unlocker1:jcp31umu6sd4@brd.superproxy.io:33335';
  
  try {
    console.log('Making request via Web Unlocker proxy to:', targetUrl);
    
    const agent = new HttpsProxyAgent(proxy);
    
    const response = await axios.get(targetUrl, {
      httpsAgent: agent,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    return {
      statusCode: response.status,
      body: response.data
    };
  } catch (error) {
    console.error('Web Unlocker proxy error:', error.message);
    throw error;
  }
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

// Main handler function - use module.exports for Vercel
module.exports = async function handler(req, res) {
  console.log('Web Unlocker Proxy Handler Started');
  
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
    // Web Unlocker proxy should handle some authentication automatically
    console.log('Fetching target page via Web Unlocker proxy...');
    
    let targetResponse;
    try {
      targetResponse = await fetchWithWebUnlocker(url);
    } catch (error) {
      console.error('Error fetching page:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch page via Web Unlocker', 
        message: error.message,
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
};
