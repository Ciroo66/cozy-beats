import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { getYouTubeInfo, downloadYouTubeAudio, searchYouTube } from './server/yt-converter.js'

function youtubeConverterPlugin() {
  return {
    name: 'vite-plugin-youtube-converter',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        // Universal CORS headers & OPTIONS preflight for all /api/ endpoints
        if (req.url.startsWith('/api/')) {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
          res.setHeader('Access-Control-Expose-Headers', 'X-Audio-Mime, Content-Length')

          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            return res.end()
          }
        }

        const urlObj = new URL(req.url, `http://${req.headers.host}`)

        // 0. Search YouTube songs
        if (urlObj.pathname === '/api/yt-search') {
          const query = urlObj.searchParams.get('q')
          if (!query) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            return res.end(JSON.stringify({ error: 'Missing search query (q)' }))
          }

          try {
            const results = await searchYouTube(query, 8)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            return res.end(JSON.stringify({ results }))
          } catch (err) {
            console.error('Error in /api/yt-search:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            return res.end(JSON.stringify({ error: err.message || 'Search failed' }))
          }
        }

        // 1. Fetch YouTube video metadata
        if (urlObj.pathname === '/api/yt-info') {
          const targetUrl = urlObj.searchParams.get('url')
          if (!targetUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Missing url parameter' }))
          }

          try {
            const info = await getYouTubeInfo(targetUrl)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            return res.end(JSON.stringify(info))
          } catch (err) {
            console.error('Error in /api/yt-info:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: err.message || 'Failed to fetch YouTube info' }))
          }
        }

        // 2. Download and convert YouTube video to audio
        if (urlObj.pathname === '/api/yt-download') {
          // Handle both GET (with query param) and POST (with json body)
          let targetUrl = urlObj.searchParams.get('url')

          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            await new Promise(resolve => req.on('end', resolve))
            try {
              const parsed = JSON.parse(body)
              if (parsed.url) targetUrl = parsed.url
            } catch {}
          }

          if (!targetUrl) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: 'Missing YouTube URL' }))
          }

          try {
            console.log(`[YouTube Converter] Downloading audio for: ${targetUrl}`)
            const audioData = await downloadYouTubeAudio(targetUrl)
            
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/octet-stream')
            res.setHeader('X-Audio-Mime', audioData.mimeType)
            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('Content-Length', audioData.size)
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Expose-Headers', 'X-Audio-Mime, Content-Length')
            return res.end(audioData.buffer)
          } catch (err) {
            console.error('Error in /api/yt-download:', err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify({ error: err.message || 'Failed to download YouTube audio' }))
          }
        }

        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), youtubeConverterPlugin()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
})
