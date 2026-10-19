const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');

const config = getDefaultConfig(__dirname);

const originalEnhanceMiddleware = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    return (req, res, next) => {
      // Handle LMS CORS proxy for browser development
      if (req.url && req.url.startsWith('/lms-proxy')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Moodle-Session, X-Requested-With, Cookie, Accept');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        const targetPath = req.url.replace('/lms-proxy', '');
        const targetUrl = new URL(`https://lmsclus.ostimteknik.edu.tr${targetPath}`);

        const headers = { ...req.headers };
        delete headers.host;
        delete headers.referer;
        delete headers.origin;

        // Extract session cookie from X-Moodle-Session custom header or cookie
        const moodleSession = req.headers['x-moodle-session'];
        if (moodleSession) {
          const cookieVal = moodleSession.includes('MoodleSession=')
            ? moodleSession
            : `MoodleSession=${moodleSession}`;
          headers['cookie'] = cookieVal;
        }

        const proxyReq = https.request(
          targetUrl,
          {
            method: req.method,
            headers: {
              ...headers,
              host: 'lmsclus.ostimteknik.edu.tr',
            },
          },
          (proxyRes) => {
            const respHeaders = { ...proxyRes.headers };
            respHeaders['access-control-allow-origin'] = '*';
            res.writeHead(proxyRes.statusCode || 200, respHeaders);
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', (err) => {
          console.error('[Metro LMS Proxy Error]:', err.message);
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify([{ error: true, exception: { message: `LMS Proxy Error: ${err.message}` } }]));
        });

        req.pipe(proxyReq);
        return;
      }

      if (originalEnhanceMiddleware) {
        return originalEnhanceMiddleware(metroMiddleware, server)(req, res, next);
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
