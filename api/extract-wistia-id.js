// Vercel API Route: api/extract-wistia-id.js
// This serverless function handles the login and extraction process

const axios = require('axios');
const cheerio = require('cheerio');

// Helper function to extract Wistia ID from HTML content
function extractWistiaId(html) {
  // Pattern 1: Iframe src attribute
  const iframeSrcMatch = html.match(/(?:wistia\.com\/embed\/(?:iframe|medias)\/|fast\.wistia\.net\/embed\/(?:iframe|medias)\/)([a-zA-Z0-9]{10})/);
  if (iframeSrcMatch) return iframeSrcMatch[1];
  
  // Pattern 2: Div class names (e.g., wistia_async_VIDEO_ID)
  const divClassMatch = html.match(/wistia_async_([a-zA-Z0-9]{10})/);
  if (divClassMatch) return divClassMatch[1];
  
  // Pattern 3: JavaScript embed calls
  const embedMatch = html.match(/Wistia\.embed\s*\(\s*["']([a-zA-Z0-9]{10})["']/i);
  if (embedMatch) return embedMatch[1];
  
  const idMatch = html.match(/["']wistiaId["']\s*:\s*["']([a-zA-Z0-9]{10})["']/);
  if (idMatch) return idMatch[1];
  
  const mediaKeyMatch = html.match(/["']media_key["']\s*:\s*["']([a-zA-Z0-9]{10})["']/);
  if (mediaKeyMatch) return mediaKeyMatch[1];
  
  // Pattern 4: Data attributes
  const dataIdMatch = html.match(/data-wistia-id=["']([a-zA-Z0-9]{10})["']/);
  if (dataIdMatch) return dataIdMatch[1];
  
  // Pattern 5: From div IDs like wistia_VIDEOID_wrapper
  const divIdMatch = html.match(/wistia_([a-zA-Z0-9]{10})_wrapper/);
  if (divIdMatch) return divIdMatch[1];
  
  return "NO VIDEO";
}

// Main handler function
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests for the actual extraction
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Get request body
    const { url, email, password } = req.body;

    if (!url || !email || !password) {
      return res.status(400).json({ error: 'URL, email, and password are required' });
    }

    // Create axios instance with cookie support
    const axiosInstance = axios.create({
      withCredentials: true,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Step 1: Get the login page to extract CSRF token
    const loginPageResponse = await axiosInstance.get('https://www.empowermentsuccess.com/login');
    const loginPageHtml = loginPageResponse.data;
    
    // Extract CSRF token
    const $ = cheerio.load(loginPageHtml);
    const csrfToken = $('meta[name="csrf-token"]').attr('content');
    
    if (!csrfToken) {
      return res.status(500).json({ error: 'Could not extract CSRF token from login page' });
    }
    
    // Get cookies from login page response
    const cookies = loginPageResponse.headers['set-cookie'];
    
    // Step 2: Submit login form
    const loginResponse = await axiosInstance.post(
      'https://www.empowermentsuccess.com/login',
      new URLSearchParams({
        'utf8': '✓',
        'authenticity_token': csrfToken,
        'member[email]': email,
        'member[password]': password,
        'member[remember_me]': '0',
        'commit': 'Sign In'
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies ? cookies.join('; ') : ''
        }
      }
    );
    
    // Get cookies from login response
    const loginCookies = loginResponse.headers['set-cookie'];
    
    // Check if login was successful
    if (loginResponse.data.includes('Sign in to your account')) {
      return res.status(401).json({ error: 'Login failed. Please check your credentials.' });
    }
    
    // Step 3: Access the target page
    const pageResponse = await axiosInstance.get(url, {
      headers: {
        'Cookie': loginCookies ? loginCookies.join('; ') : ''
      }
    });
    
    // Extract Wistia ID
    const wistiaId = extractWistiaId(pageResponse.data);
    
    if (wistiaId === 'NO VIDEO') {
      return res.status(404).json({ error: 'No Wistia video found on the provided page.' });
    }
    
    // Return the Wistia ID
    return res.status(200).json({ wistiaId });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'An error occurred during the extraction process.',
      details: error.response?.data || 'No additional details available'
    });
  }
};
