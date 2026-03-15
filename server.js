const path = require('path');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
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
