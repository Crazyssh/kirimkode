module.exports = {
  apps: [
    {
      name: "kirimkode",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/kirimkode",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Auto restart kalau crash
      max_restarts: 10,
      restart_delay: 5000,
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/kirimkode/error.log",
      out_file: "/var/log/kirimkode/out.log",
      merge_logs: true,
    },
  ],
};
