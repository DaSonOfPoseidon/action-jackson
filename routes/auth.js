const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const { TokenManager, csrfProtection, generateCSRFToken } = require('../middleware/auth');

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 5, // Much higher limit for tests
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true
});

// Stricter rate limiting for failed login attempts
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 3, // Much higher limit for tests
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * POST /auth/login - Admin login
 */
router.post('/login',
  loginRateLimit,
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid username format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('_csrf').optional()
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(`Login validation failed from IP: ${req.ip} - ${JSON.stringify(errors.array())}`);
        
        // Check if this is an API request (JSON) or browser form submission
        const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
        const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

        if (acceptsJson || isJsonRequest) {
          // API/AJAX request - return JSON
          return res.status(400).json({
            error: 'Invalid input data',
            details: errors.array()
          });
        } else {
          // Browser form submission - redirect with error
          const errorParam = encodeURIComponent('Please check your username and password format');
          return res.redirect(`/admin/login?error=validation_failed&message=${errorParam}`);
        }
      }

      const { username, password, rememberMe } = req.body;

      // Log login attempt
      console.log(`Login attempt: ${username} from IP: ${req.ip} at ${new Date().toISOString()}`);

      // Authenticate user
      const authResult = await Admin.authenticate(username, password, req.ip);

      if (!authResult.success) {
        let errorMessage = 'Invalid username or password';
        let statusCode = 401;

        if (authResult.reason === 'account_locked') {
          errorMessage = 'Account temporarily locked due to failed login attempts';
          statusCode = 423; // HTTP 423 Locked
        }

        console.log(`Login failed: ${username} from IP: ${req.ip} - Reason: ${authResult.reason}`);
        
        // Check if this is an API request (JSON) or browser form submission
        const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
        const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

        if (acceptsJson || isJsonRequest) {
          // API/AJAX request - return JSON
          return res.status(statusCode).json({
            error: errorMessage,
            reason: authResult.reason,
            lockUntil: authResult.lockUntil
          });
        } else {
          // Browser form submission - redirect with error
          const errorParam = encodeURIComponent(errorMessage);
          return res.redirect(`/admin/login?error=login_failed&message=${errorParam}`);
        }
      }

      // Generate tokens
      const accessToken = TokenManager.generateAccessToken(authResult.user);
      const refreshToken = TokenManager.generateRefreshToken(authResult.user);

      // Create session
      req.session.adminId = authResult.user.id;
      req.session.username = authResult.user.username;
      req.session.role = authResult.user.role;
      req.session.loginTime = new Date();
      req.session.lastActivity = new Date();
      req.session.csrfToken = generateCSRFToken();

      // Set secure cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      };

      // Access token (short-lived)
      res.cookie('adminAccessToken', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      // Refresh token (longer-lived, only if "remember me")
      if (rememberMe) {
        res.cookie('adminRefreshToken', refreshToken, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      console.log(`Login successful: ${authResult.user.username} from IP: ${req.ip}`);

      // Check if this is an API request (JSON) or browser form submission
      const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
      const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

      if (acceptsJson || isJsonRequest) {
        // API/AJAX request - return JSON
        res.json({
          success: true,
          user: {
            username: authResult.user.username,
            role: authResult.user.role,
            lastLogin: authResult.user.lastLogin
          },
          tokens: {
            accessToken,
            refreshToken: rememberMe ? refreshToken : null
          }
        });
      } else {
        // Browser form submission - redirect to dashboard
        const redirectUrl = req.query.redirect || '/admin/dashboard';
        res.redirect(redirectUrl);
      }

    } catch (error) {
      console.error('Login error:', error);
      
      // Check if this is an API request (JSON) or browser form submission
      const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
      const isJsonRequest = req.headers['content-type'] && req.headers['content-type'].includes('application/json');

      if (acceptsJson || isJsonRequest) {
        // API/AJAX request - return JSON
        res.status(500).json({
          error: 'Authentication system error'
        });
      } else {
        // Browser form submission - redirect with error
        const errorParam = encodeURIComponent('System error occurred. Please try again.');
        res.redirect(`/admin/login?error=system_error&message=${errorParam}`);
      }
    }
  }
);

/**
 * POST /auth/refresh - Refresh access token
 */
router.post('/refresh',
  authRateLimit,
  async (req, res) => {
    try {
      // Get refresh token from cookie or body
      const refreshToken = req.cookies?.adminRefreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token required'
        });
      }

      // Verify refresh token
      const verification = TokenManager.verifyToken(refreshToken, 'refresh');
      if (!verification.success) {
        return res.status(401).json({
          error: 'Invalid or expired refresh token'
        });
      }

      // Check if admin still exists and is active
      const admin = await Admin.findOne({
        _id: verification.decoded.id,
        isActive: true
      });

      if (!admin) {
        return res.status(401).json({
          error: 'Admin account not found or inactive'
        });
      }

      // Generate new access token
      const newAccessToken = TokenManager.generateAccessToken({
        id: admin._id,
        username: admin.username,
        role: admin.role
      });

      // Set new access token cookie
      res.cookie('adminAccessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.json({
        success: true,
        accessToken: newAccessToken
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Token refresh system error'
      });
    }
  }
);

/**
 * POST /auth/logout - Admin logout
 */
router.post('/logout', (req, res) => {
  try {
    // Clear session
    if (req.session) {
      const username = req.session.username;
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        } else {
          console.log(`Logout: ${username} from IP: ${req.ip}`);
        }
      });
    }

    // Clear auth cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0
    };

    res.cookie('adminAccessToken', '', cookieOptions);
    res.cookie('adminRefreshToken', '', cookieOptions);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout system error'
    });
  }
});

/**
 * GET /auth/verify - Verify current authentication status
 */
router.get('/verify', async (req, res) => {
  try {
    // Check session
    if (!req.session || !req.session.adminId) {
      return res.status(401).json({
        authenticated: false,
        reason: 'no_session'
      });
    }

    // Check if admin still exists and is active
    const admin = await Admin.findOne({
      _id: req.session.adminId,
      isActive: true
    });

    if (!admin) {
      req.session.destroy();
      return res.status(401).json({
        authenticated: false,
        reason: 'invalid_admin'
      });
    }

    // Check session timeout
    const sessionTimeout = 60 * 60 * 1000; // 60 minutes
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date();
    
    if (Date.now() - lastActivity.getTime() > sessionTimeout) {
      req.session.destroy();
      return res.status(401).json({
        authenticated: false,
        reason: 'session_expired'
      });
    }

    // Update last activity
    req.session.lastActivity = new Date();

    res.json({
      authenticated: true,
      user: {
        username: admin.username,
        role: admin.role,
        lastLogin: admin.lastLogin
      },
      session: {
        loginTime: req.session.loginTime,
        lastActivity: req.session.lastActivity
      }
    });

  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({
      authenticated: false,
      reason: 'system_error'
    });
  }
});

/**
 * GET /auth/csrf - Get CSRF token
 */
router.get('/csrf', (req, res) => {
  // Check if there's an authenticated admin session
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({
      error: 'Session required for CSRF token'
    });
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }

  res.json({
    csrfToken: req.session.csrfToken
  });
});

module.exports = router;