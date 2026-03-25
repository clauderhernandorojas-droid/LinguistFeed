const authService = require('../services/authService');

/**
 * Middleware to authenticate requests using JWT
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authenticate(req, res, next) {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }
    
    // Check if it's a Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }
    
    const token = parts[1];
    
    // Verify the token
    const decoded = authService.verifyToken(token);
    
    // Add user info to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  authenticate
};