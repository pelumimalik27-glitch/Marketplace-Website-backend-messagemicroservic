const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  sendOTP,
  verifyOTP,
  sendWelcome,
  sendLoginAlert,
  sendSellerApproval,
  sendMessageNotification,
  sendOrderConfirmation,
  sendSellerNewOrder,
  sendPasswordReset,
  sendOrderTracking,
} = require('../controller/email.controller');


const  emailRouter = express.Router();

// Rate limiter for OTP requests: max 10 requests per 15 minutes per email
// This allows reasonable retries while preventing abuse
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 10, // Limit each email to 10 OTP requests per windowMs (one every ~90 seconds)
  message: {
    success: false,
    error: 'Too Many Requests. Please wait before requesting another OTP.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    // Use email as key instead of IP to prevent shared IPs from blocking each other
    const email = req.body?.email || req.query?.email || 'unknown';
    return email;
  },
});

emailRouter.route('/send-otp').post(otpLimiter, sendOTP);
emailRouter.route('/verify-otp').post(verifyOTP);
emailRouter.route('/welcome').post(sendWelcome);
emailRouter.route('/login-alert').post(sendLoginAlert);
emailRouter.route('/seller-approval').post(sendSellerApproval);
emailRouter.route('/message-notification').post(sendMessageNotification);
emailRouter.route('/order-confirmation').post(sendOrderConfirmation);
emailRouter.route('/seller-new-order').post(sendSellerNewOrder);
emailRouter.route('/password-reset').post(sendPasswordReset);
emailRouter.route('/order-tracking').post(sendOrderTracking);

module.exports = {emailRouter};
