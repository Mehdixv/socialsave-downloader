const express = require('express');
const { YtDlp } = require('ytdlp-nodejs');
const path = require('path');
const app = express();

const ytdlp = new YtDlp();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/download', async (req, res) => {
  const { url } = req.body;
  try {
    const info = await ytdlp.getInfo(url);
    res.json({
      title: info.title,
      author: info.uploader,
      duration: info.duration,
      link: info.formats.find(f => f.ext === 'mp4' && f.filesize)?.url || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video info' });
  }
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
