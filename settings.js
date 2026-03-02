// Settings module: loads and saves user preferences, updates password, deletes account
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser, signOut } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { toggleTheme } from './theme.js';

export function initializeSettings() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}

function _init() {
  setupHandlers();
  checkAuthAndLoad();
}

function setupHandlers() {
  // Password update form
  const passwordForm = document.getElementById('passwordForm');
  const updateBtn = document.getElementById('updatePasswordBtn');

  if (passwordForm && updateBtn) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const currentInput = document.getElementById('currentPassword');
      const nextInput = document.getElementById('newPassword');
      const confirmInput = document.getElementById('confirmPassword');
      const btnText = updateBtn.querySelector('.btn-text');

      const currentVal = currentInput.value.trim();
      const newVal = nextInput.value;
      const confirmVal = confirmInput.value;

      if (!currentVal) { alert('Please enter your current password'); return; }
      if (newVal.length < 8) { alert('New password must be at least 8 characters'); return; }
      if (newVal !== confirmVal) { alert('Passwords do not match'); return; }

      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        // UI Loading state
        updateBtn.disabled = true;
        if (btnText) btnText.textContent = 'Updating...';

        // Re-authenticate
        const cred = EmailAuthProvider.credential(user.email, currentVal);
        await reauthenticateWithCredential(user, cred);

        // Update password
        await updatePassword(user, newVal);

        await logActivity({
          uid: user.uid,
          email: user.email,
          action: 'password_change',
          success: true,
          device: `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`
        });

        alert('Password updated successfully');
        passwordForm.reset();
      } catch (err) {
        console.error('Password update error:', err);
        let msg = 'Failed to update password';
        if (err.code === 'auth/wrong-password') msg = 'Current password is incorrect';

        await logActivity({
          uid: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          action: 'password_change',
          success: false,
          device: `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`
        });

        alert(msg);
      } finally {
        updateBtn.disabled = false;
        if (btnText) btnText.textContent = 'Update Password';
      }
    });
  }

  // Preferences toggles
  const darkToggle = document.querySelectorAll('[data-purpose="dark-toggle"]');
  const notifToggle = document.querySelectorAll('[data-purpose="notif-toggle"]');

  darkToggle.forEach(btn => btn.addEventListener('click', async () => {
    await toggleTheme();
  }));

  notifToggle.forEach(btn => btn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) { alert('Not authenticated'); return; }

    // Simplistic UX toggle: switch a class or translate state if you had it.
    // For now we'll just toggle a conceptual 'active' state
    const enabled = btn.classList.toggle('bg-primary');
    try {
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, { 'settings.notifications': enabled }).catch(async () => {
        await setDoc(ref, { settings: { notifications: enabled } }, { merge: true });
      });
    } catch (err) {
      console.error('Notifications save error:', err);
    }
  }));

  // Delete account button
  const deleteBtn = Array.from(document.querySelectorAll('button')).find(b => /Delete my account/i.test(b.textContent));
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return;
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        const ref = doc(db, 'users', user.uid);
        await deleteDoc(ref).catch(err => { console.warn('Could not delete user doc:', err); });

        await deleteUser(user);
        localStorage.removeItem('currentUser');
        alert('Account deleted');
        window.location.href = 'register.html';
      } catch (err) {
        console.error('Account deletion error:', err);
        if (err.code === 'auth/requires-recent-login') {
          alert('Please re-login before deleting your account.');
          await signOut(auth);
          window.location.href = 'login.html';
        } else {
          alert(err.message || 'Failed to delete account');
        }
      }
    });
  }
}
async function checkAuthAndLoad() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      const userData = snap.exists() ? snap.data() : {};

      // Update UI with settings
      applySettingsToUI(userData.settings || {});

      // Sync Profile Header
      const headerName = document.getElementById('display-user-name');
      const avatarImgEls = document.querySelectorAll('[data-purpose="user-avatar"]');
      const displayName = userData.fullName || user.displayName || 'User';

      if (headerName) headerName.textContent = displayName.split(' ')[0];
      if (avatarImgEls.length > 0 && (userData.photoURL || user.photoURL)) {
        avatarImgEls.forEach(img => img.src = userData.photoURL || user.photoURL);
      }

    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setupLogout();
  });
}

import { logActivity } from './logger.js';

function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const user = auth.currentUser;
        if (user) {
          await logActivity({
            uid: user.uid,
            email: user.email,
            action: 'logout',
            success: true,
            device: `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`
          });
        }
        await signOut(auth);
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }
}

function applySettingsToUI(settings) {
  try {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    if (settings.notifications) {
      document.querySelectorAll('[data-purpose="notif-toggle"]').forEach(b => b.classList.add('bg-primary'));
    }
  } catch (err) { console.error(err); }
}
