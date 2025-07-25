const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const app = express();

const execPromise = util.promisify(exec);

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Helper function to detect platform from URL
function detectPlatform(url) {
  const platforms = {
    'youtube.com': 'youtube',
    'youtu.be': 'youtube',
    'instagram.com': 'instagram',
    'facebook.com': 'facebook',
    'twitter.com': 'twitter',
    'x.com': 'twitter',
    'tiktok.com': 'tiktok',
    'linkedin.com': 'linkedin',
    'pinterest.com': 'pinterest',
    'snapchat.com': 'snapchat'
  };
  
  for (const [domain, platform] of Object.entries(platforms)) {
    if (url.includes(domain)) {
      return platform;
    }
  }
  return 'unknown';
}

// Fast download endpoint using yt-dlp directly
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid video URL' });
  }

  const platform = detectPlatform(url);
  console.log(`Processing ${platform} video: ${url}`);
  
  try {
    // Use yt-dlp command directly for better performance
    const command = `yt-dlp --print-json --no-download "${url}"`;
    
    const { stdout, stderr } = await execPromise(command, { timeout: 15000 });
    
    if (stderr && !stdout) {
      throw new Error('Failed to fetch video information');
    }

    const videoInfo = JSON.parse(stdout.trim());
    
    // Get the best quality download URL
    const formats = videoInfo.formats || [];
    const bestFormat = formats
      .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.url)
      .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

    if (!bestFormat) {
      return res.status(404).json({ error: 'No downloadable format found' });
    }

    res.json({
      success: true,
      platform: platform,
      title: videoInfo.title || 'Video',
      author: videoInfo.uploader || videoInfo.channel || 'Unknown',
      duration: formatDuration(videoInfo.duration),
      thumbnail: videoInfo.thumbnail || '',
      downloadUrl: bestFormat.url,
      filesize: formatFileSize(bestFormat.filesize),
      quality: bestFormat.height ? `${bestFormat.height}p` : 'Standard',
      directDownload: true
    });
    
  } catch (error) {
    console.error('Download error:', error.message);
    
    // Fallback: Use a more reliable yt-dlp service
    try {
      const fallbackResponse = await fallbackDownload(url, platform);
      res.json(fallbackResponse);
    } catch (fallbackError) {
      res.status(500).json({ 
        error: `Failed to process ${platform} video. The video might be private or unavailable.`,
        details: error.message 
      });
    }
  }
});

// Fallback download method
async function fallbackDownload(url, platform) {
  // Try to get just basic info and generate a download link
  const command = `yt-dlp --get-url --get-title --get-duration "${url}"`;
  
  try {
    const { stdout } = await execPromise(command, { timeout: 10000 });
    const lines = stdout.trim().split('\n');
    
    return {
      success: true,
      platform: platform,
      title: lines[1] || 'Video',
      author: 'Unknown',
      duration: lines[2] || 'Unknown',
      thumbnail: '',
      downloadUrl: lines[0] || url,
      filesize: 'Unknown',
      quality: 'Standard',
      directDownload: true
    };
  } catch (error) {
    throw new Error('Video unavailable or private');
  }
}

// Direct download endpoint for faster downloads
app.get('/api/direct-download', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  try {
    // Get direct download URL
    const command = `yt-dlp --get-url "${url}"`;
    const { stdout } = await execPromise(command, { timeout: 10000 });
    
    const downloadUrl = stdout.trim();
    
    // Redirect to the actual video file
    res.redirect(downloadUrl);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to get download URL' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'SocialSave Download Server is running!', 
    timestamp: new Date().toISOString(),
    platforms: ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Twitter', 'LinkedIn']
  });
});

// Platform-specific endpoints
app.post('/api/youtube', async (req, res) => {
  await handlePlatformDownload(req, res, 'youtube');
});

app.post('/api/instagram', async (req, res) => {
  await handlePlatformDownload(req, res, 'instagram');
});

app.post('/api/tiktok', async (req, res) => {
  await handlePlatformDownload(req, res, 'tiktok');
});

// Generic platform handler
async function handlePlatformDownload(req, res, expectedPlatform) {
  const { url } = req.body;
  
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid video URL' });
  }

  const detectedPlatform = detectPlatform(url);
  
  if (detectedPlatform !== expectedPlatform && detectedPlatform !== 'unknown') {
    return res.status(400).json({ 
      error: `This endpoint is for ${expectedPlatform} videos, but you provided a ${detectedPlatform} URL` 
    });
  }

  // Reuse the main download logic
  req.body = { url };
  return await app._router.handle({ ...req, method: 'POST', url: '/api/download' }, res);
}

// Helper functions
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SocialSave Download Server running on port ${PORT}`);
  console.log(`📱 Supported platforms: YouTube, Instagram, TikTok, Facebook, Twitter, LinkedIn, Pinterest`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
});
