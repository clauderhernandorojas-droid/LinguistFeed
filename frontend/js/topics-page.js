import { requireAuth, logout } from './auth.js';
import { handleLogout } from './reader.js';
import { mountNavbar } from './navbar.js';
import { renderTopics } from './topics.js';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  mountNavbar('student', '');
  renderTopics();
  if (typeof window.initSearch === 'function') {
    window.initSearch('searchBarTopics', ['#favorites-grid', '#others-grid'], '.topic-card');
  }
  handleLogout(logout);
});
