module.exports = {
  "/api": {
    target: "http://localhost:8000",
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
    headers: {
      Connection: 'keep-alive'
    },
    proxyTimeout: 60000,
    timeout: 60000
  },
  "/sanctum": {
    target: "http://localhost:8000",
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
    headers: {
      Connection: 'keep-alive'
    },
    proxyTimeout: 60000,
    timeout: 60000
  },
  "/storage": {
    target: "http://localhost:8000",
    secure: false,
    changeOrigin: true,
    logLevel: "debug",
    headers: {
      Connection: 'keep-alive'
    },
    proxyTimeout: 60000,
    timeout: 60000
  }
};
