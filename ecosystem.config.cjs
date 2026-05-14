module.exports = {
  apps: [
    {
      name: 'it-inventory',
      script: 'npm',
      args: 'run dev -- --host 0.0.0.0 --port 5173',
      cwd: '/root/Itinventory',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'it-inventory-reminders',
      script: 'scripts/payment-reminder-cron.mjs',
      cwd: '/root/Itinventory',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'it-inventory-ai-credit-low',
      script: 'scripts/ai-credit-low-cron.mjs',
      cwd: '/root/Itinventory',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};



