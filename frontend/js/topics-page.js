import { requireAuth, logout } from './auth.js';
import { handleLogout } from './reader.js';
import { mountNavbar } from './navbar.js';
import { renderTopics } from './topics.js';

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  mountNavbar('student', '');
  renderTopics();
  handleLogout(logout);
});
