// Simple version that just extracts Wistia ID from a URL
// This skips the proxy/login complexity for now

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

// Function to extract Wistia ID directly from URL
function extractWistiaIdFromUrl(url) {
  // Direct Wistia embed URLs
  const urlMatch = url.match(/(?:wistia\.com\/embed\/(?:iframe|medias)\/|fast\.wistia\.net\/embed\/(?:iframe|medias)\/)([a-zA-Z0-9]{10})/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // Wistia URLs with video ID in path
  const pathMatch = url.match(/(?:wistia\.com|wistia\.net)\/.*\/([a-zA-Z0-9]{10})(?:\?|$|#)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

// Main handler function
export default async function handler(req, res) {
  console.log('Simple Wistia ID Extractor Started');
  
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

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log('Processing URL:', url);

    // First, try to extract Wistia ID directly from the URL
    const directId = extractWistiaIdFromUrl(url);
    
    if (directId) {
      console.log('Found Wistia ID in URL:', directId);
      return res.status(200).json({ 
        success: true, 
        wistiaId: directId,
        message: `Wistia ID found: ${directId}`,
        source: 'url'
      });
    }

    // If it's a Wistia embed URL, we can't fetch it due to CORS
    // but we already tried to extract the ID from the URL itself
    if (url.includes('wistia.com') || url.includes('wistia.net')) {
      return res.status(200).json({ 
        success: false, 
        message: 'Could not extract Wistia ID from this URL. For Kajabi pages, you may need to use the Python script locally.',
        wistiaId: null
      });
    }

    // For non-Wistia URLs (like Kajabi), we need authentication
    // which requires the proxy setup we were trying to implement
    return res.status(200).json({ 
      success: false, 
      message: 'This URL requires authentication. Please use the Python script for password-protected pages, or try a direct Wistia embed URL.',
      wistiaId: null
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      success: false
    });
  }
}
