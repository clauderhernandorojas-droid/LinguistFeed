const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

// Secret key for JWT
const JWT_SECRET = 'LinguistFeed_Master_Key_2026'; // <--- ¡DEBE SER IGUAL!
// Token expiration time
const TOKEN_EXPIRATION = '7d'; // 7 days

/**
 * Service for authentication and user management
 */
class AuthService {
  /**
   * Register a new user
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} level - CEFR level
   * @returns {Promise<Object>} - User object
   */
  async registerUser(email, password, level) {
    try {
      console.log(`Registering new user with email: ${email}, level: ${level}`);
      
      // Validate email format
      if (!this.isValidEmail(email)) {
        throw new Error('Invalid email format');
      }
      
      // Validate password
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Validate level
      if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
        throw new Error('Invalid CEFR level');
      }
      
      // Check if user already exists
      const existingUser = await db.get(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Hash the password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Insert the user
      const result = await db.run(
        'INSERT INTO users (email, password_hash, level) VALUES (?, ?, ?)',
        [email, passwordHash, level]
      );
      
      console.log(`User registered with ID ${result.id}`);
      
      // Get the user without password
      const user = await this.getUserById(result.id);
      
      return user;
    } catch (error) {
      console.error('Error registering user:', error.message);
      throw error;
    }
  }

  /**
   * Login a user
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} - Object with user and token
   */
  async loginUser(email, password) {
    try {
      console.log(`Attempting login for user: ${email}`);
      
      // Get the user
      const user = await db.get(
        'SELECT id, email, password_hash, level FROM users WHERE email = ?',
        [email]
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }
      
      console.log(`User ${email} logged in successfully`);
      
      // Generate JWT token
      const token = this.generateToken(user);
      
      // Return user without password and token
      const { password_hash, ...userWithoutPassword } = user;
      
      return {
        user: userWithoutPassword,
        token
      };
    } catch (error) {
      console.error('Error logging in user:', error.message);
      throw error;
    }
  }

  /**
   * Get a user by ID
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Object>} - User object without password
   */
  async getUserById(userId) {
    try {
      const user = await db.get(
        'SELECT id, email, level, created_at FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error.message);
      throw error;
    }
  }

  /**
   * Update user's CEFR level
   * 
   * @param {number} userId - User ID
   * @param {string} level - New CEFR level
   * @returns {Promise<Object>} - Updated user object
   */
  async updateUserLevel(userId, level) {
    try {
      console.log(`Updating level to ${level} for user ${userId}`);
      
      // Validate level
      if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
        throw new Error('Invalid CEFR level');
      }
      
      // Update the user
      await db.run(
        'UPDATE users SET level = ? WHERE id = ?',
        [level, userId]
      );
      
      // Get the updated user
      return this.getUserById(userId);
    } catch (error) {
      console.error('Error updating user level:', error.message);
      throw error;
    }
  }

  /**
   * Add an interest to a user
   * 
   * @param {number} userId - User ID
   * @param {string} interestName - Interest name
   * @returns {Promise<Array>} - Array of user's interests
   */
  async addUserInterest(userId, interestName) {
    try {
      console.log(`Adding interest ${interestName} to user ${userId}`);
      
      // Get the interest ID
      let interest = await db.get(
        'SELECT id FROM interests WHERE name = ?',
        [interestName]
      );
      
      // If interest doesn't exist, create it
      if (!interest) {
        console.log(`Interest ${interestName} not found, creating it`);
        
        const result = await db.run(
          'INSERT INTO interests (name) VALUES (?)',
          [interestName]
        );
        
        interest = { id: result.id };
      }
      
      // Check if user already has this interest
      const existingInterest = await db.get(
        'SELECT * FROM user_interests WHERE user_id = ? AND interest_id = ?',
        [userId, interest.id]
      );
      
      if (!existingInterest) {
        // Add the interest to the user
        await db.run(
          'INSERT INTO user_interests (user_id, interest_id) VALUES (?, ?)',
          [userId, interest.id]
        );
      }
      
      // Get all user's interests
      return this.getUserInterests(userId);
    } catch (error) {
      console.error('Error adding user interest:', error.message);
      throw error;
    }
  }

  /**
   * Remove an interest from a user
   * 
   * @param {number} userId - User ID
   * @param {string} interestName - Interest name
   * @returns {Promise<Array>} - Array of user's interests
   */
  async removeUserInterest(userId, interestName) {
    try {
      console.log(`Removing interest ${interestName} from user ${userId}`);
      
      // Get the interest ID
      const interest = await db.get(
        'SELECT id FROM interests WHERE name = ?',
        [interestName]
      );
      
      if (!interest) {
        throw new Error(`Interest ${interestName} not found`);
      }
      
      // Remove the interest from the user
      await db.run(
        'DELETE FROM user_interests WHERE user_id = ? AND interest_id = ?',
        [userId, interest.id]
      );
      
      // Get all user's interests
      return this.getUserInterests(userId);
    } catch (error) {
      console.error('Error removing user interest:', error.message);
      throw error;
    }
  }

  /**
   * Get all interests for a user
   * 
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - Array of interest objects
   */
  async getUserInterests(userId) {
    try {
      const interests = await db.all(
        `SELECT i.id, i.name
         FROM interests i
         JOIN user_interests ui ON i.id = ui.interest_id
         WHERE ui.user_id = ?
         ORDER BY i.name`,
        [userId]
      );
      
      return interests;
    } catch (error) {
      console.error('Error getting user interests:', error.message);
      throw error;
    }
  }

  /**
   * Generate a JWT token for a user
   * 
   * @param {Object} user - User object
   * @returns {string} - JWT token
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      level: user.level
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  }

  /**
   * Verify a JWT token
   * 
   * @param {string} token - JWT token
   * @returns {Object} - Decoded token payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      console.error('Error verifying token:', error.message);
      throw new Error('Invalid token');
    }
  }

  /**
   * Validate email format
   * 
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = new AuthService();