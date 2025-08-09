const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

/**
 * JWT Token Management
 */
class TokenManager {
  static generateAccessToken(user) {
    return jwt.sign(
      { 
        id: user.id,
        username: user.username,
        role: user.role,
        type: 'access'
      },
      process.env.ADMIN_JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRE || '15m',
        issuer: 'action-jackson-admin',
        audience: 'action-jackson-admin'
      }
    );
  }

  static generateRefreshToken(user) {
    return jwt.sign(
      { 
        id: user.id,
        username: user.username,
        type: 'refresh'
      },
      process.env.ADMIN_JWT_SECRET,
      { 
        expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '7d',
        issuer: 'action-jackson-admin',
        audience: 'action-jackson-admin'
      }
    );
  }

  static verifyToken(token, type = 'access') {
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET, {
        issuer: 'action-jackson-admin',
        audience: 'action-jackson-admin'
      });
      
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }
      
      return { success: true, decoded };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Authentication Middleware
 */
const requireAuth = async (req, res, next) => {
  try {
    // Check for JWT token in header or cookie
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token && req.cookies?.adminAccessToken) {
      token = req.cookies.adminAccessToken;
    }
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }
    
    // Verify token
    const verification = TokenManager.verifyToken(token, 'access');
    
    if (!verification.success) {
      // Token expired or invalid
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }
    
    // Check if admin still exists and is active
    const admin = await Admin.findOne({ 
      _id: verification.decoded.id,
      isActive: true 
    });
    
    if (!admin) {
      return res.status(401).json({ 
        error: 'Admin account not found or inactive',
        code: 'ADMIN_INVALID'
      });
    }
    
    // Add admin info to request
    req.admin = {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      lastLogin: admin.lastLogin
    };
    
    // Log admin action for audit trail
    console.log(`Admin access: ${admin.username} (${req.ip}) - ${req.method} ${req.originalUrl}`);
    
    next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication system error',
      code: 'AUTH_SYSTEM_ERROR'
    });
  }
};

/**
 * Role-based Authorization Middleware
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Role hierarchy: superadmin > admin
    const roleHierarchy = {
      'admin': 1,
      'superadmin': 2
    };
    
    const userRoleLevel = roleHierarchy[req.admin.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
    
    if (userRoleLevel < requiredRoleLevel) {
      console.log(`Access denied: ${req.admin.username} (${req.admin.role}) tried to access ${requiredRole} resource`);
      return res.status(403).json({ 
        error: 'Insufficient privileges',
        code: 'INSUFFICIENT_PRIVILEGES'
      });
    }
    
    next();
  };
};

/**
 * Session Validation Middleware (for session-based routes)
 */
const requireSession = (req, res, next) => {
  if (!req.session || !req.session.adminId) {
    return res.status(401).json({ 
      error: 'Valid session required',
      code: 'SESSION_REQUIRED'
    });
  }
  
  // Update session activity
  req.session.lastActivity = new Date();
  
  next();
};

/**
 * CSRF Protection Middleware
 */
const csrfProtection = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  const token = req.body._csrf || req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;
  
  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      code: 'CSRF_INVALID'
    });
  }
  
  next();
};

/**
 * Admin Page Middleware (for rendering admin pages)
 */
const adminPageAuth = async (req, res, next) => {
  try {
    // Check session for admin pages
    if (!req.session || !req.session.adminId) {
      return res.redirect('/admin/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    
    // Verify admin still exists and is active
    const admin = await Admin.findOne({ 
      _id: req.session.adminId,
      isActive: true 
    });
    
    if (!admin) {
      req.session.destroy();
      return res.redirect('/admin/login?error=account_invalid');
    }
    
    // Check session timeout (60 minutes)
    const sessionTimeout = 60 * 60 * 1000; // 60 minutes
    const lastActivity = req.session.lastActivity ? new Date(req.session.lastActivity) : new Date(req.session.createdAt);
    
    if (Date.now() - lastActivity.getTime() > sessionTimeout) {
      req.session.destroy();
      return res.redirect('/admin/login?error=session_expired');
    }
    
    // Update last activity
    req.session.lastActivity = new Date();
    
    // Add admin to request and locals for templates
    req.admin = {
      id: admin._id,
      username: admin.username,
      role: admin.role,
      lastLogin: admin.lastLogin
    };
    
    res.locals.admin = req.admin;
    res.locals.csrfToken = req.session.csrfToken || (req.session.csrfToken = generateCSRFToken());
    
    next();
    
  } catch (error) {
    console.error('Admin page auth error:', error);
    return res.redirect('/admin/login?error=system_error');
  }
};

/**
 * Generate CSRF Token
 */
function generateCSRFToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Security Headers Middleware for Admin Pages
 */
const adminSecurityHeaders = (req, res, next) => {
  // Stricter CSP for admin pages
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'"
  ].join('; '));
  
  // Prevent caching of admin pages
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

module.exports = {
  TokenManager,
  requireAuth,
  requireRole,
  requireSession,
  csrfProtection,
  adminPageAuth,
  adminSecurityHeaders,
  generateCSRFToken
};