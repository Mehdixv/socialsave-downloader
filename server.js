const express = require('express');
const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const fs = require('fs');
const app = express();

// Initialize yt-dlp
const ytdlp = new YtDlp();

// Middleware
app.use(express.json());
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

// Universal download endpoint - works with any supported platform
app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Please provide a valid video URL' });
  }

  const platform = detectPlatform(url);
  
  try {
    console.log(`Processing ${platform} video: ${url}`);
    
    // Get video information
    const info = await ytdlp.getInfo(url);
    
    // Find the best quality MP4 format
    const formats = info.formats || [];
    const mp4Format = formats
      .filter(f => f.ext === 'mp4' && f.url)
      .sort((a, b) => (b.filesize || 0) - (a.filesize || 0))[0];
    
    if (!mp4Format) {
      return res.status(404).json({ error: 'No downloadable MP4 format found' });
    }

    res.json({
      success: true,
      platform: platform,
      title: info.title || 'Video',
      author: info.uploader || info.channel || 'Unknown',
      duration: formatDuration(info.duration),
      thumbnail: info.thumbnail || '',
      downloadUrl: mp4Format.url,
      filesize: formatFileSize(mp4Format.filesize),
      quality: mp4Format.height ? `${mp4Format.height}p` : 'Standard'
    });
    
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ 
      error: `Failed to process ${platform} video. Please check the URL and try again.`,
      details: error.message 
    });
  }
});

// Platform-specific endpoints for future expansion
app.post('/api/youtube', async (req, res) => {
  await handlePlatformDownload(req, res, 'youtube');
});

app.post('/api/instagram', async (req, res) => {
  await handlePlatformDownload(req, res, 'instagram');
});

app.post('/api/tiktok', async (req, res) => {
  await handlePlatformDownload(req, res, 'tiktok');
});

app.post('/api/facebook', async (req, res) => {
  await handlePlatformDownload(req, res, 'facebook');
});

app.post('/api/twitter', async (req, res) => {
  await handlePlatformDownload(req, res, 'twitter');
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
  return app._router.handle({ ...req, method: 'POST', url: '/api/download' }, res);
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running!', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Universal Video Downloader Server running on port ${PORT}`);
  console.log(`📱 Supported platforms: YouTube, Instagram, TikTok, Facebook, Twitter, LinkedIn, Pinterest`);
});
