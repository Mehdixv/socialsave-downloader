# SocialSave Download - Universal Video Downloader

A powerful video downloader SaaS that downloads videos directly from multiple platforms without redirecting to third-party sites.

## Features
- 🎥 Direct video downloads (no redirects)
- 🎵 Audio extraction to MP3
- 📱 Multi-platform support (YouTube, TikTok, Instagram, Facebook, Twitter)
- 🚀 Real-time progress tracking
- 📊 Multiple quality options
- 🔄 Auto file cleanup
- 📱 Mobile responsive design

## Supported Platforms
- YouTube
- TikTok  
- Instagram
- Facebook
- Twitter/X
- LinkedIn
- Pinterest
- Snapchat

## Tech Stack
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Video Processing**: yt-dlp (Python)
- **Deployment**: Railway, Heroku, Vercel compatible

## Environment Variables
```
PORT=3000
NODE_ENV=production
```

## Quick Deploy

### Railway
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/Mehdixv/socialsave-downloader)

1. Click the Railway button above
2. Connect your GitHub account
3. Deploy automatically

### Heroku
```bash
git clone https://github.com/Mehdixv/socialsave-downloader.git
cd socialsave-downloader
heroku create your-app-name
git push heroku main
```

## Local Development
```bash
npm install
node server.js
```

## API Endpoints
- `POST /api/info` - Get video information
- `POST /api/download` - Download video
- `POST /api/download-audio` - Download audio only
- `GET /api/health` - Health check

## License
MIT License - feel free to use for commercial projects!

---
Built with ❤️ for the video downloading community
