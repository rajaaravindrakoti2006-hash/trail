import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { toggleTheme } from './theme.js';
import { logActivity } from './logger.js';

export function initializeProfile() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}

function _init() {
  bindForm();
  loadProfileOnAuth();
  setupLogout();
  setupThemeToggle();
}

function setupThemeToggle() {
  const toggleBtn = document.getElementById('dark-mode-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      await toggleTheme();
    });
  }
}

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

function bindForm() {
  const form = document.querySelector('form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const data = {
      fullName: document.getElementById('fullName')?.value || '',
      phone: document.getElementById('phone')?.value || '',
      bio: document.getElementById('bio')?.value || '',
      location: document.getElementById('location')?.value || ''
    };

    try {
      // Update firebase auth profile displayName if fullName is present
      if (data.fullName) {
        await updateProfile(user, { displayName: data.fullName }).catch(() => { });
      }

      // Update Firestore user doc
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, data).catch(async () => {
        // If doc doesn't exist, create it with merge true
        await setDoc(ref, data, { merge: true });
      });

      // Update local session
      const session = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (data.fullName) session.fullName = data.fullName;
      localStorage.setItem('currentUser', JSON.stringify(session));

      // Log success
      await logActivity({
        uid: user.uid,
        email: user.email,
        action: 'profile_update',
        success: true,
        device: `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`
      });

      // Custom Toast UI feedback
      const toast = document.getElementById('success-toast');
      if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
      }
    } catch (err) {
      console.error('Profile update error:', err);
      // Fallback to alert for errors for visibility
      alert(err.message || 'Failed to update profile');
    }
  });
}

function loadProfileOnAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      let profileData = {
        fullName: user.displayName || 'No Name Set',
        email: user.email,
        photoURL: user.photoURL,
        createdAt: user.metadata.creationTime,
        lastLogin: user.metadata.lastSignInTime
      };

      if (snap.exists()) {
        const firestoreData = snap.data();
        profileData = { ...profileData, ...firestoreData };
      }

      applyProfileToUI(profileData);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      // hide loading overlay if present
      const loading = document.getElementById('loading-overlay');
      if (loading) {
        setTimeout(() => {
          loading.classList.add('opacity-0');
          setTimeout(() => loading.style.display = 'none', 500);
        }, 800);
      }
    }
  });
}

function applyProfileToUI(data) {
  try {
    const fullNameEl = document.getElementById('fullName');
    const emailEl = document.getElementById('email');
    const heroName = document.getElementById('hero-name');
    const heroPlan = document.getElementById('hero-plan');
    const headerName = document.getElementById('display-user-name');
    const welcomeName = document.getElementById('welcome-name');
    const createdEl = document.querySelector('[data-purpose="created-date"]');
    const lastLoginEl = document.querySelector('[data-purpose="last-login"]');
    const avatarImgEls = document.querySelectorAll('[data-purpose="user-avatar"]');

    if (fullNameEl && data.fullName) fullNameEl.value = data.fullName;
    if (emailEl && data.email) emailEl.value = data.email;
    if (heroName && data.fullName) heroName.textContent = data.fullName;
    if (headerName && data.fullName) headerName.textContent = data.fullName.split(' ')[0]; // Show first name in header
    if (welcomeName && data.fullName) welcomeName.textContent = data.fullName;

    if (createdEl && data.createdAt) {
      const date = new Date(data.createdAt);
      createdEl.textContent = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    if (lastLoginEl && data.lastLogin) {
      const date = new Date(data.lastLogin);
      lastLoginEl.textContent = date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }

    if (data.photoURL && avatarImgEls.length > 0) {
      avatarImgEls.forEach(img => img.src = data.photoURL);
    }
  } catch (err) {
    console.error('Error applying profile to UI:', err);
  }
}
