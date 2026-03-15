const https = require('https');
const userSchema = require('../controller/user.schema');

const otpStorage = new Map();
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

let mailConfigError = null;
const BREVO_API_URL = String(process.env.BREVO_API_URL || 'api.brevo.com').trim();
const MAIL_PROVIDER = String(process.env.MAIL_PROVIDER || 'brevo').trim().toLowerCase();

const getEmailConfig = () => ({
  apiKey: String(process.env.BREVO_API_KEY || '').trim(),
  senderEmail: String(process.env.EMAIL_FROM || '').trim(),
  senderName: String(process.env.EMAIL_NAME || 'Elite Marketplace').trim(),
});

const validateEmailConfig = () => {
  if (MAIL_PROVIDER !== 'brevo') {
    mailConfigError = `Unsupported MAIL_PROVIDER "${MAIL_PROVIDER}". Use "brevo".`;
    console.log(mailConfigError);
    return false;
  }
  const { apiKey, senderEmail } = getEmailConfig();
  if (!apiKey || !senderEmail) {
    mailConfigError = 'BREVO_API_KEY or EMAIL_FROM is missing in messagemicroservice .env';
    console.log(mailConfigError);
    return false;
  }
  mailConfigError = null;
  return true;
};

validateEmailConfig();
console.log(`Mail provider: ${MAIL_PROVIDER}`);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(email, otp) {
  const key = normalizeEmail(email);
  const expirytime = Date.now() + 10 * 60 * 1000;
  otpStorage.set(key, {
    otp,
    expirytime,
    attempts: 0,
  });
  return expirytime;
}

const ensureMailReady = () => {
  validateEmailConfig();
  if (mailConfigError) {
    throw new Error(mailConfigError);
  }
};

const sendBrevoEmail = async (payload = {}) => {
  ensureMailReady();

  const { apiKey } = getEmailConfig();

  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: BREVO_API_URL,
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'api-key': apiKey,
          accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const status = res.statusCode || 500;
          if (status >= 200 && status < 300) {
            return resolve(data ? JSON.parse(data) : {});
          }
          let message = `Brevo error (HTTP ${status})`;
          try {
            const parsed = data ? JSON.parse(data) : {};
            message = parsed?.message || parsed?.error || message;
          } catch (_) {
            if (data) message = data;
          }
          return reject(new Error(message));
        });
      }
    );

    req.on('error', (error) => {
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
};

async function sendOTPEMAIL(email, otp) {
  return sendEmail(
    email,
    'Your one time password',
    `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:0;">
        <h2>Your OTP code is</h2>
        <div style="background-color:#13b4ff; padding:20px; text-align:center; border-radius:8px;">
          <h1 style="color:#fff; font-size:36px; margin:0;">${otp}</h1>
        </div>
      </div>
    `,
    `Your OTP code is: ${otp}. This code will expire in 10 minutes.`
  );
}

async function sendEmail(to, subject, htmlContent, textContent) {
  const { senderEmail, senderName } = getEmailConfig();

  return sendBrevoEmail({
    sender: {
      email: senderEmail,
      name: senderName,
    },
    to: [
      {
        email: to,
      },
    ],
    subject,
    htmlContent,
    textContent,
  });
}

async function sendWelcomeEmail(user) {
  const subject = 'Welcome to Elite Marketplace!';

  const html = `
    <div style="font-family: Arial; max-width:600px;">
      <h2>Welcome ${user.name || ''}</h2>
      <p>Thank you for signing up to <b>Elite Marketplace</b>.</p>
      <p>You can now explore products, shop, and become a seller anytime.</p>
      <br/>
      <p>Happy Shopping!</p>
    </div>
  `;

  const text = 'Welcome to Elite Marketplace!';

  return sendEmail(user.email, subject, html, text);
}

async function sendLoginAlertEmail(user) {
  const subject = 'Login Alert - Elite Marketplace';

  const html = `
    <div style="font-family: Arial;">
      <h2>Hello ${user.name || ''},</h2>
      <p>You just logged into your Elite Marketplace account.</p>
      <p>If this was not you, please reset your password immediately.</p>
      <br/>
      <small>Time: ${new Date().toLocaleString()}</small>
    </div>
  `;

  const text = 'You logged into Elite Marketplace';

  return sendEmail(user.email, subject, html, text);
}

async function sendSellerApprovalEmail(user) {
  const subject = "You're now a seller on Elite Marketplace!";

  const html = `
    <div style="font-family: Arial;">
      <h2>Congratulations ${user.name || ''}</h2>
      <p>Your request to become a seller has been approved.</p>
      <p>You can now list products and start selling.</p>
      <br/>
      <p>We wish you great sales success!</p>
    </div>
  `;

  const text = 'You are now a seller on Elite Marketplace!';

  return sendEmail(user.email, subject, html, text);
}

async function sendMessageNotificationEmail(payload = {}) {
  const recipientName = String(payload.recipientName || "").trim();
  const senderName = String(payload.senderName || "Marketplace User").trim();
  const preview = String(payload.preview || "").trim();
  const actionUrl = String(payload.actionUrl || "").trim();

  const subject = `New message from ${senderName}`;
  const html = `
    <div style="font-family: Arial; max-width:600px;">
      <h2>Hello ${recipientName || ""},</h2>
      <p>You received a new message on <b>Elite Marketplace</b>.</p>
      <p><b>From:</b> ${senderName}</p>
      ${preview ? `<p><b>Message preview:</b> ${preview}</p>` : ""}
      ${
        actionUrl
          ? `<p><a href="${actionUrl}" style="color:#ea580c; text-decoration:none;">Open Marketplace Messages</a></p>`
          : ""
      }
      <br/>
      <p>Log in to reply securely on the platform.</p>
    </div>
  `;
  const text = actionUrl
    ? `New message from ${senderName}. Open: ${actionUrl}`
    : `New message from ${senderName}. Log in to Elite Marketplace to reply.`;

  return sendEmail(payload.recipientEmail, subject, html, text);
}

const toMailUser = (input = {}) => ({
  email: normalizeEmail(input.email),
  name: String(input.name || "").trim(),
});

const validateMailUser = (user = {}) => {
  if (!user.email) return "Email is required";
  return "";
};

async function sendWelcome(req, res) {
  try {
    const user = toMailUser(req.body || {});
    const validationError = validateMailUser(user);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    await sendWelcomeEmail(user);
    return res.status(200).json({
      success: true,
      message: `Welcome email sent to ${user.email}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send welcome email",
    });
  }
}

async function sendLoginAlert(req, res) {
  try {
    const user = toMailUser(req.body || {});
    const validationError = validateMailUser(user);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    await sendLoginAlertEmail(user);
    return res.status(200).json({
      success: true,
      message: `Login alert email sent to ${user.email}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send login alert email",
    });
  }
}

async function sendSellerApproval(req, res) {
  try {
    const user = toMailUser(req.body || {});
    const validationError = validateMailUser(user);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    await sendSellerApprovalEmail(user);
    return res.status(200).json({
      success: true,
      message: `Seller approval email sent to ${user.email}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send seller approval email",
    });
  }
}

const isInternalAuthorized = (req) => {
  const configuredKey = String(process.env.INTERNAL_NOTIFY_KEY || "").trim();
  if (!configuredKey) return true;
  const incomingKey = String(req.headers["x-internal-key"] || "").trim();
  return Boolean(incomingKey && incomingKey === configuredKey);
};

async function sendMessageNotification(req, res) {
  try {
    if (!isInternalAuthorized(req)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: internal notification key mismatch",
      });
    }

    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    const senderName = String(req.body?.senderName || "").trim();
    const preview = String(req.body?.preview || "").trim();
    const recipientName = String(req.body?.recipientName || "").trim();
    const actionUrl = String(req.body?.actionUrl || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "recipientEmail is required" });
    }
    if (!senderName) {
      return res.status(400).json({ success: false, error: "senderName is required" });
    }

    await sendMessageNotificationEmail({
      recipientEmail,
      recipientName,
      senderName,
      preview,
      actionUrl,
      conversationId: String(req.body?.conversationId || "").trim(),
    });

    return res.status(200).json({
      success: true,
      message: `Message notification email sent to ${recipientEmail}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send message notification email",
    });
  }
}

async function sendOTP(req, res) {
  try {
    const { email } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const otp = generateOTP();
    storeOTP(normalizedEmail, otp);

    try {
      await sendOTPEMAIL(normalizedEmail, otp);
      return res.status(200).json({
        success: true,
        message: `OTP sent to ${normalizedEmail}, expires in 10mins`,
      });
    } catch (error) {
      console.log('send OTP error:', error?.message || error);
      const allowDevOtp =
        String(process.env.ALLOW_DEV_OTP || "").trim() === "true" ||
        process.env.NODE_ENV !== "production";
      if (allowDevOtp) {
        return res.status(202).json({
          success: true,
          message:
            "OTP generated but email could not be sent. Use the OTP below in development.",
          devOtp: otp,
          mailError: error?.message || "Failed to send OTP",
        });
      }
      return res.status(500).json({
        success: false,
        error: error?.message || 'Failed to send OTP',
      });
    }
  } catch (error) {
    console.log('send OTP error:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to send OTP',
    });
  }
}

async function verifyOTP(req, res) {
  try {
    const input = req.body && Object.keys(req.body).length ? req.body : req.query;
    const email = normalizeEmail(input?.email);
    const otp = String(input?.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and OTP are required',
      });
    }

    const storeData = otpStorage.get(email);

    if (!storeData) {
      return res.status(400).json({
        success: false,
        error: 'OTP not found or expired',
      });
    }

    if (Date.now() > storeData.expirytime) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        error: 'OTP has expired',
      });
    }

    if (storeData.otp === otp) {
      const verifyemail = await userSchema.findOne({ email });
      if (verifyemail) {
        verifyemail.isVerified = true;
        await verifyemail.save();
        otpStorage.delete(email);
        return res.status(200).json({
          success: true,
          data: {
            email: verifyemail.email,
            userId: verifyemail._id,
            isVerified: true,
          },
          message: 'Email Verification Successful. Please login.',
        });
      }
      otpStorage.delete(email);
      return res.status(404).json({
        success: false,
        error: 'No account found for this email',
      });
    }

    storeData.attempts += 1;
    if (storeData.attempts >= 3) {
      otpStorage.delete(email);
      return res.status(400).json({
        success: false,
        error: 'Too many attempts. Please request a new otp',
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid OTP',
    });
  } catch (error) {
    console.log('Verification OTP Error', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function sendOrderConfirmation(req, res) {
  try {
    if (!isInternalAuthorized(req)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: internal notification key mismatch",
      });
    }

    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    const recipientName = String(req.body?.recipientName || "").trim();
    const orderId = String(req.body?.orderId || "").trim();
    const total = String(req.body?.total || "").trim();
    const orderUrl = String(req.body?.orderUrl || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "recipientEmail is required" });
    }
    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required" });
    }

    const subject = `Order confirmation ${orderId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px;">
        <h2>Hello ${recipientName || "Customer"},</h2>
        <p>Your order <b>${orderId}</b> has been confirmed.</p>
        ${total ? `<p><b>Total:</b> ${total}</p>` : ""}
        ${orderUrl ? `<p><a href="${orderUrl}" style="color:#ea580c;">View order</a></p>` : ""}
        <p>Thank you for shopping with Elite Marketplace.</p>
      </div>
    `;
    const text = `Order confirmation ${orderId}${total ? ` | Total: ${total}` : ""}`;

    await sendEmail(recipientEmail, subject, html, text);
    return res.status(200).json({
      success: true,
      message: `Order confirmation email sent to ${recipientEmail}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send order confirmation email",
    });
  }
}

async function sendSellerNewOrder(req, res) {
  try {
    if (!isInternalAuthorized(req)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: internal notification key mismatch",
      });
    }

    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    const recipientName = String(req.body?.recipientName || "").trim();
    const orderId = String(req.body?.orderId || "").trim();
    const total = String(req.body?.total || "").trim();
    const orderUrl = String(req.body?.orderUrl || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "recipientEmail is required" });
    }
    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required" });
    }

    const subject = `New order received ${orderId}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px;">
        <h2>Hello ${recipientName || "Seller"},</h2>
        <p>You have a new order: <b>${orderId}</b>.</p>
        ${total ? `<p><b>Total:</b> ${total}</p>` : ""}
        ${orderUrl ? `<p><a href="${orderUrl}" style="color:#ea580c;">View order</a></p>` : ""}
        <p>Please fulfill it as soon as possible.</p>
      </div>
    `;
    const text = `New order ${orderId}${total ? ` | Total: ${total}` : ""}`;

    await sendEmail(recipientEmail, subject, html, text);
    return res.status(200).json({
      success: true,
      message: `Seller order notification sent to ${recipientEmail}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send seller order notification email",
    });
  }
}

async function sendPasswordReset(req, res) {
  try {
    if (!isInternalAuthorized(req)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: internal notification key mismatch",
      });
    }

    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    const recipientName = String(req.body?.recipientName || "").trim();
    const resetUrl = String(req.body?.resetUrl || "").trim();
    const expiresIn = String(req.body?.expiresIn || "15 minutes").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "recipientEmail is required" });
    }
    if (!resetUrl) {
      return res.status(400).json({ success: false, error: "resetUrl is required" });
    }

    const subject = "Password reset request";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px;">
        <h2>Hello ${recipientName || ""},</h2>
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}" style="color:#ea580c;">Reset password</a></p>
        <p>This link expires in ${expiresIn}.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `;
    const text = `Reset your password: ${resetUrl} (expires in ${expiresIn})`;

    await sendEmail(recipientEmail, subject, html, text);
    return res.status(200).json({
      success: true,
      message: `Password reset email sent to ${recipientEmail}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send password reset email",
    });
  }
}

async function sendOrderTracking(req, res) {
  try {
    if (!isInternalAuthorized(req)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: internal notification key mismatch",
      });
    }

    const recipientEmail = normalizeEmail(req.body?.recipientEmail);
    const recipientName = String(req.body?.recipientName || "").trim();
    const orderId = String(req.body?.orderId || "").trim();
    const trackingUrl = String(req.body?.trackingUrl || "").trim();
    const qrCode = String(req.body?.qrCode || "").trim();

    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: "recipientEmail is required" });
    }
    if (!orderId) {
      return res.status(400).json({ success: false, error: "orderId is required" });
    }
    if (!trackingUrl) {
      return res.status(400).json({ success: false, error: "trackingUrl is required" });
    }

    const subject = `Track your order ${orderId}`;
    const safeQrCode = qrCode && qrCode.startsWith("data:image") ? qrCode : "";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; color:#0f172a; background:#ffffff;">
        <div style="background:#ea580c; color:#ffffff; padding:18px 24px; border-radius:12px 12px 0 0;">
          <p style="margin:0; font-size:16px; font-weight:700; letter-spacing:0.2px;">
            Elite Marketplace
          </p>
          <p style="margin:6px 0 0; font-size:13px; opacity:0.95;">
            Order Tracking
          </p>
        </div>
        <div style="padding:20px 24px; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 12px 12px; background:#ffffff;">
          <h2 style="margin:0 0 8px;">Hello ${recipientName || "Customer"},</h2>
          <p style="margin:0 0 12px;">Your order <b>${orderId}</b> has been created.</p>
          <p style="margin:0 0 16px;">Track your order status anytime using the button below.</p>
          <a href="${trackingUrl}" style="display:inline-block; background:#ea580c; color:#ffffff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;">
            Track Order
          </a>
          <div style="margin-top:18px; padding-top:16px; border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 8px; font-weight:600;">Scan to track</p>
            <p style="margin:0 0 12px; color:#475569; font-size:13px;">Open your camera and scan the QR code.</p>
            ${
              safeQrCode
                ? `<img src="${safeQrCode}" alt="Order Tracking QR Code" style="width:180px; height:180px; object-fit:contain; border:1px solid #e2e8f0; border-radius:8px;" />`
                : ""
            }
          </div>
          <p style="margin:16px 0 0; color:#64748b; font-size:12px;">
            If the button doesn’t work, copy and paste this link into your browser:
            <br/>
            <span style="color:#0f172a;">${trackingUrl}</span>
          </p>
        </div>
        <div style="margin-top:12px; background:#ea580c; color:#ffffff; text-align:center; padding:10px 16px; border-radius:8px;">
          <p style="margin:0; font-size:12px;">Thank you for shopping with Elite Marketplace.</p>
        </div>
      </div>
    `;
    const text = `Track your order ${orderId}: ${trackingUrl}`;

    await sendEmail(recipientEmail, subject, html, text);

    return res.status(200).json({
      success: true,
      message: `Order tracking email sent to ${recipientEmail}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to send order tracking email",
    });
  }
}

module.exports = {
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
  sendWelcomeEmail,
  sendLoginAlertEmail,
  sendSellerApprovalEmail,
};
