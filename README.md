# Wistia ID Extractor - Vercel Deployment

A web application that extracts Wistia video IDs from Kajabi pages using Vercel serverless functions.

## Features

- Clean, responsive web interface
- Secure credential handling (credentials are never stored)
- Automatic login to Kajabi sites
- Wistia ID extraction from authenticated pages
- Real-time feedback and error handling
- Mobile-friendly design

## Deployment Instructions

### Option 1: Vercel CLI (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Extract and navigate to the project folder**:
   ```bash
   # Extract the zip file first, then:
   cd wistia-extractor-vercel
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project? **N** (for new deployment)
   - What's your project's name? **wistia-extractor** (or your preferred name)
   - In which directory is your code located? **./** (current directory)
   - Want to override the settings? **N** (use defaults)

5. **Your app will be deployed!** Vercel will provide you with a URL like:
   ```
   https://wistia-extractor-abc123.vercel.app
   ```

### Option 2: Vercel Dashboard (Drag & Drop)

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Create New Project**: Click "Add New..." → "Project"

3. **Import Project**: 
   - Click "Import" next to "Import Git Repository"
   - Or drag and drop the entire `wistia-extractor-vercel` folder

4. **Configure Project**:
   - Project Name: `wistia-extractor` (or your preferred name)
   - Framework Preset: **Other** (or leave as detected)
   - Root Directory: `./` (should be auto-detected)

5. **Deploy**: Click "Deploy" button

6. **Your app will be live!** You'll get a URL like:
   ```
   https://wistia-extractor-abc123.vercel.app
   ```

## How to Use

1. **Open your deployed application** in a web browser

2. **Fill in the form**:
   - **Kajabi Page URL**: The full URL of the Kajabi page containing the Wistia video
   - **Email**: Your login email for the Kajabi site
   - **Password**: Your login password for the Kajabi site

3. **Click "Extract Wistia ID"**

4. **Results**:
   - **Success**: The Wistia ID will be displayed
   - **No Video**: "NO VIDEO" message if no Wistia video is found
   - **Error**: Error message if something goes wrong

## Technical Details

### Architecture
- **Frontend**: Static HTML/CSS/JavaScript
- **Backend**: Vercel serverless function (`/api/extract-wistia-id.js`)
- **Authentication**: Handles Kajabi login automatically
- **Extraction**: Multiple pattern matching for Wistia IDs

### Security
- Credentials are only used for authentication and never stored
- HTTPS encryption for all communications
- CORS headers properly configured
- No persistent sessions or data storage

### Supported Sites
- Primarily designed for `empowermentsuccess.com`
- May work with other Kajabi sites with similar login mechanisms

## Troubleshooting

### Common Issues

1. **"Failed to fetch login page" error**:
   - Check if the target site is accessible
   - Verify the site uses standard Kajabi login forms

2. **"NO VIDEO" result**:
   - Ensure the page actually contains a Wistia video
   - Check if you have access to the page when logged in manually

3. **Login failures**:
   - Verify your email and password are correct
   - Check if the site requires additional authentication steps

4. **Deployment issues**:
   - Ensure all files are included in the deployment
   - Check Vercel function logs for specific errors

### Getting Help

If you encounter issues:
1. Check the browser console for error messages (F12 → Console)
2. Verify your credentials work when logging in manually
3. Ensure the target page contains a Wistia video when accessed normally

## File Structure

```
wistia-extractor-vercel/
├── api/
│   └── extract-wistia-id.js    # Vercel serverless function
├── index.html                  # Frontend interface
├── package.json               # Project dependencies
├── vercel.json               # Vercel configuration
└── README.md                 # This file
```

## Updates and Maintenance

To update the application:
1. Modify the files as needed
2. Redeploy using `vercel` command or through the dashboard
3. Vercel will automatically update your live application

---

**Note**: This application is designed for legitimate use cases where you have proper authorization to access the Kajabi content. Always respect website terms of service and copyright policies.

