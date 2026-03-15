const express = require('express');
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
emailRouter.route('/send-otp').post(sendOTP);
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
