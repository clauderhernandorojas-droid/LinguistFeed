/**
 * auth.js - Handles user authentication
 * 
 * This module provides functions for user login, registration, and session management.
 */

// Key for storing user data in localStorage
const USER_STORAGE_KEY = 'linguistfeed_user';

/**
 * Checks if a user is currently logged in
 * @returns {boolean} True if a user is logged in, false otherwise
 */
function isLoggedIn() {
    return !!getUser();
}

/**
 * Gets the current logged in user
 * @returns {Object|null} User object if logged in, null otherwise
 */
function getUser() {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (!userJson) return null;
    
    try {
        return JSON.parse(userJson);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

/**
 * Logs in a user (placeholder implementation)
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} Promise that resolves to the user data
 */
async function login(email, password) {
    // This is a placeholder implementation
    // In a real app, this would make an API call to verify credentials
    
    // For now, we'll simulate a successful login with mock data
    if (email && password) {
        const userData = {
            id: 'user123',
            email: email,
            name: email.split('@')[0], // Use part of email as name
            role: 'student'
        };
        
        // Store user data in localStorage
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        
        return userData;
    } else {
        throw new Error('Email and password are required');
    }
}

/**
 * Registers a new user (placeholder implementation)
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's name
 * @returns {Promise} Promise that resolves to the user data
 */
async function register(email, password, name) {
    // This is a placeholder implementation
    // In a real app, this would make an API call to create a new user
    
    // For now, we'll simulate a successful registration with mock data
    if (email && password && name) {
        const userData = {
            id: 'user' + Math.floor(Math.random() * 1000),
            email: email,
            name: name,
            role: 'student'
        };
        
        // Store user data in localStorage
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
        
        return userData;
    } else {
        throw new Error('Email, password, and name are required');
    }
}

/**
 * Logs out the current user
 */
function logout() {
    localStorage.removeItem(USER_STORAGE_KEY);
    // Redirect to home page
    window.location.href = 'index.html';
}

/**
 * Redirects to login page if user is not logged in
 * Use this function on pages that require authentication
 */
function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    }
}

// Export the functions so they can be imported in other files
export {
    isLoggedIn,
    getUser,
    login,
    register,
    logout,
    requireAuth
};