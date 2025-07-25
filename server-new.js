const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const app = express();

const execPromise = util.promisify(exec);

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve downloads directory
app.use('/downloads', express.static(downloadsDir));

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

// Helper function to validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Helper function to format duration
function formatDuration(seconds) {
  if (!seconds || seconds === 'Unknown') return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get video info only (without downloading)
app.post('/api/info', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid video URL is required' 
      });
    }

    console.log('Getting info for:', url);
    const platform = detectPlatform(url);
    
    // Get detailed video information
    const infoCommand = `yt-dlp --print "%(title)s|||%(duration)s|||%(uploader)s|||%(view_count)s|||%(thumbnail)s" "${url}"`;
    
    try {
      const { stdout } = await execPromise(infoCommand, { timeout: 30000 });
      const [title, duration, uploader, viewCount, thumbnail] = stdout.trim().split('|||');
      
      res.json({
        success: true,
        platform: platform,
        videoInfo: {
          title: title || 'Unknown Title',
          duration: formatDuration(duration),
          uploader: uploader || 'Unknown',
          viewCount: viewCount || 'Unknown',
          thumbnail: thumbnail || null
        }
      });
    } catch (error) {
      console.error('Info error:', error);
      res.json({
        success: true,
        platform: platform,
        videoInfo: {
          title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video Ready`,
          duration: 'Unknown',
          uploader: 'SocialSave',
          viewCount: 'Unknown',
          thumbnail: null
        }
      });
    }

  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get video information'
    });
  }
});

// Download video endpoint
app.post('/api/download', async (req, res) => {
  try {
    const { url, quality = 'best[height<=720]' } = req.body;
    
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid video URL is required' 
      });
    }

    console.log('Downloading video:', url);
    
    // Generate unique filename prefix
    const fileId = crypto.randomBytes(8).toString('hex');
    const outputTemplate = path.join(downloadsDir, `${fileId}_%(title)s.%(ext)s`);
    
    // Get video info first
    const infoCommand = `yt-dlp --print "%(title)s|||%(duration)s|||%(uploader)s|||%(ext)s" "${url}"`;
    console.log('Getting video info...');
    
    let videoInfo;
    try {
      const { stdout: infoOutput } = await execPromise(infoCommand, { timeout: 30000 });
      const [title, duration, uploader, ext] = infoOutput.trim().split('|||');
      videoInfo = {
        title: title || 'Unknown Title',
        duration: duration || 'Unknown',
        uploader: uploader || 'Unknown',
        extension: ext || 'mp4'
      };
    } catch (error) {
      console.error('Error getting video info:', error);
      videoInfo = {
        title: 'Video',
        duration: 'Unknown',
        uploader: 'Unknown',
        extension: 'mp4'
      };
    }

    // Download the video
    const downloadCommand = `yt-dlp -f "${quality}" -o "${outputTemplate}" "${url}"`;
    console.log('Starting download with command:', downloadCommand);
    
    const { stdout, stderr } = await execPromise(downloadCommand, { 
      timeout: 300000, // 5 minutes timeout
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
    console.log('Download completed');
    
    // Find the downloaded file
    const files = fs.readdirSync(downloadsDir);
    const downloadedFile = files.find(file => file.startsWith(fileId));
    
    if (!downloadedFile) {
      throw new Error('Downloaded file not found');
    }

    const filePath = path.join(downloadsDir, downloadedFile);
    const fileStats = fs.statSync(filePath);
    const downloadUrl = `/downloads/${downloadedFile}`;
    
    // Clean filename for display
    const displayName = downloadedFile.replace(`${fileId}_`, '');
    
    res.json({
      success: true,
      videoInfo: {
        ...videoInfo,
        filename: displayName,
        fileSize: formatFileSize(fileStats.size),
        downloadUrl: downloadUrl,
        fullPath: downloadUrl
      },
      message: 'Video downloaded successfully!'
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download video. Please try again.'
    });
  }
});

// Download audio only endpoint
app.post('/api/download-audio', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid video URL is required' 
      });
    }

    console.log('Downloading audio:', url);
    
    // Generate unique filename prefix
    const fileId = crypto.randomBytes(8).toString('hex');
    const outputTemplate = path.join(downloadsDir, `${fileId}_%(title)s.%(ext)s`);
    
    // Download audio only
    const downloadCommand = `yt-dlp -f "bestaudio" --extract-audio --audio-format mp3 -o "${outputTemplate}" "${url}"`;
    console.log('Starting audio download...');
    
    const { stdout, stderr } = await execPromise(downloadCommand, { 
      timeout: 300000, // 5 minutes timeout
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
    console.log('Audio download completed');
    
    // Find the downloaded file
    const files = fs.readdirSync(downloadsDir);
    const downloadedFile = files.find(file => file.startsWith(fileId));
    
    if (!downloadedFile) {
      throw new Error('Downloaded audio file not found');
    }

    const filePath = path.join(downloadsDir, downloadedFile);
    const fileStats = fs.statSync(filePath);
    const downloadUrl = `/downloads/${downloadedFile}`;
    
    // Clean filename for display
    const displayName = downloadedFile.replace(`${fileId}_`, '');
    
    res.json({
      success: true,
      audioInfo: {
        filename: displayName,
        fileSize: formatFileSize(fileStats.size),
        downloadUrl: downloadUrl,
        format: 'MP3'
      },
      message: 'Audio downloaded successfully!'
    });

  } catch (error) {
    console.error('Audio download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to download audio. Please try again.'
    });
  }
});

// Clean up old files (run every hour)
setInterval(() => {
  console.log('Cleaning up old files...');
  const files = fs.readdirSync(downloadsDir);
  const now = Date.now();
  
  files.forEach(file => {
    const filePath = path.join(downloadsDir, file);
    const stats = fs.statSync(filePath);
    const ageInHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);
    
    // Delete files older than 2 hours
    if (ageInHours > 2) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old file: ${file}`);
    }
  });
}, 60 * 60 * 1000); // Run every hour

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SocialSave Download Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SocialSave Download Server running on port ${PORT}`);
  console.log(`📁 Downloads directory: ${downloadsDir}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
});
