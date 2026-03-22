const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const {createProxyMiddleware} = require('http-proxy-middleware');
const  connectDB = require('./database/dbconnection');
const { emailRouter } = require('./router/email.router');
const { sendOTP, verifyOTP } = require('./controller/email.controller');


// Prefer IPv4 to avoid IPv6-only routing issues in some environments.
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {
  // Older Node versions may not support this; ignore.
}

const app = express();
const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];
const configuredOrigins = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
const isLocalOrigin = (origin = "") =>
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(String(origin || "").trim());
const isTrustedPublicOrigin = (origin = "") => {
  const value = String(origin || "").trim();
  return (
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(value) ||
    /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(value)
  );
};

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (isLocalOrigin(origin) || isTrustedPublicOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

const PORT = Number(process.env.PORT) || 7000;

app.use(
    '/api/v1/msg',
    createProxyMiddleware({
        target:"http://localhost:7002",
        changeOrigin:true
    })
);

app.use('/api/v1/mail',emailRouter);
// Compatibility route: supports proxied requests that arrive as /send-otp or /verify-otp.
app.use('/', emailRouter);
app.post('/send-otp', sendOTP);
app.post('/verify-otp', verifyOTP);

app.use((err, req, res, next) => {
    console.log("messagemicroservice error:", err?.message || err);
    return res.status(500).json({
        success: false,
        message: err?.message || "Internal server error",
    });
});

app.use((req, res) => {
    return res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

connectDB()
app.listen(PORT, () => {
    console.log(`email server up ====>>>> on ${PORT}`);
});
