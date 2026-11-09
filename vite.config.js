import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { countStoryLater } from './scripts/storycount.mjs'

const STORY_MAP = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AlienMe story map</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/story/map.tsx"></script>
  </body>
</html>`

function storyMap() {
  return {
    name: 'story-map',
    apply: 'serve',
    configureServer(server) {
      let counted = { json: null, result: null }
      server.middlewares.use(async (req, res, next) => {
        if (req.url.split('?')[0] !== '/storycount.json') return next()
        try {
          const { storyJSON } = await server.ssrLoadModule('/src/story/count.ts')
          const json = storyJSON()
          if (counted.json !== json) counted = { json, result: countStoryLater(json) }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(await counted.result))
        } catch (e) {
          counted = { json: null, result: null }
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e.stderr || e.message || e) }))
        }
      })
      server.middlewares.use(async (req, res, next) => {
        if (req.url.split('?')[0] !== '/storymap.html') return next()
        res.setHeader('Content-Type', 'text/html')
        res.end(await server.transformIndexHtml(req.url, STORY_MAP))
      })
    },
  }
}

function tagManager(id) {
  return {
    name: 'tag-manager',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtm.js?id=${id}` }, injectTo: 'head-prepend' },
      {
        tag: 'script',
        children: "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());",
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), storyMap(), tagManager('GTM-PSMWFFL6')],
})
