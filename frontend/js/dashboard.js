/**
 * dashboard.js - Handles dashboard functionality
 * 
 * This module provides functions for displaying user progress and dashboard information.
 */

import { fetchUserProgress } from './api.js';
import { getUser, requireAuth } from './auth.js';

/**
 * Displays user progress on the dashboard
 * @param {Object} progressData - The user progress data
 */
function displayUserProgress(progressData) {
    // Update articles read count
    const articlesReadElement = document.getElementById('articles-read');
    if (articlesReadElement) {
        articlesReadElement.textContent = progressData.articlesRead;
    }
    
    // Update quizzes taken count
    const quizzesTakenElement = document.getElementById('quizzes-taken');
    if (quizzesTakenElement) {
        quizzesTakenElement.textContent = progressData.quizzesTaken;
    }
    
    // Update vocabulary learned count
    const vocabularyLearnedElement = document.getElementById('vocabulary-learned');
    if (vocabularyLearnedElement) {
        vocabularyLearnedElement.textContent = progressData.vocabularyLearned;
    }
    
    // Update streak count
    const streakElement = document.getElementById('streak');
    if (streakElement) {
        streakElement.textContent = progressData.streak;
    }
}

/**
 * Displays user information on the dashboard
 */
function displayUserInfo() {
    const user = getUser();
    
    // Update user name
    const userNameElement = document.getElementById('user-name');
    if (userNameElement && user) {
        userNameElement.textContent = user.name;
    }
}

/**
 * Initializes the dashboard page
 * Fetches user progress and displays dashboard information
 */
async function initDashboard() {
    // Require authentication for the dashboard page
    requireAuth();
    
    // Display user information
    displayUserInfo();
    
    try {
        // Get current user
        const user = getUser();
        
        if (user) {
            // Fetch user progress data
            const progressData = await fetchUserProgress(user.id);
            
            // Display user progress
            displayUserProgress(progressData);
        }
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

// Export the functions so they can be imported in other files
export {
    displayUserProgress,
    displayUserInfo,
    initDashboard
};