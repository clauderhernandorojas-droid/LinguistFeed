import { requireAuth, logout } from './auth.js';
import { handleLogout, renderArticleCardThumb, getTopicPlaceholderHtml } from './reader.js';
import { mountNavbarForCurrentUser } from './navbar.js';
import { renderTopics, getSavedStudentLevel } from './topics.js';

export { renderArticleCardThumb, getTopicPlaceholderHtml };

document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  getSavedStudentLevel();
  mountNavbarForCurrentUser('');
  renderTopics();
  if (typeof window.initSearch === 'function') {
    window.initSearch('searchBarTopics', ['#favorites-grid', '#others-grid'], '.topic-card');
  }
  handleLogout(logout);
});
