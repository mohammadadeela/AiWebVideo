module.exports = {
  apps: [
    {
      name: 'aiwebvideo-web',
      cwd: '/var/www/aiwebvideo',
      script: 'artifacts/api-server/dist/index.mjs',
      interpreter: 'node',
      // Node 20 loads the project's private runtime environment directly, so
      // a PM2 reload cannot accidentally drop DATABASE_URL or SESSION_SECRET.
      node_args: '--env-file=.env.local --enable-source-maps',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1500M',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        STATIC_DIR: '/var/www/aiwebvideo/artifacts/aiwebvideo/dist/public',
        ASSETS_DIR: '/var/lib/aiwebvideo/assets',
      },
    },
  ],
};
