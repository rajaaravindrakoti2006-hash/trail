import './theme.js';

// Check authentication status and update Landing Page UI
export function checkAuthAndUpdateUI() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}

function _init() {
  // Check if user session exists in localStorage
  const currentUser = localStorage.getItem('currentUser');

  if (currentUser) {
    console.log('User session found.');
    // No longer changing button text automatically to avoid confusion
  }
}