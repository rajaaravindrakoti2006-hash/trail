import { auth, db } from './firebase-config.js';
import './theme.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs, getDoc, doc, where } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Check authentication status and load user data
export function checkAuthAndLoadUser() {
  const storedUser = localStorage.getItem('currentUser');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (!storedUser) {
        window.location.href = 'login.html';
      } else {
        setTimeout(() => location.reload(), 1000);
      }
      return;
    }

    try {
      // Fetch user data from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : {};

      displayUserInfo(userData.fullName || user.displayName || user.email);

      // Update avatar
      const avatarImgEls = document.querySelectorAll('[data-purpose="user-avatar"]');
      if (avatarImgEls.length > 0 && (userData.photoURL || user.photoURL)) {
        avatarImgEls.forEach(img => img.src = userData.photoURL || user.photoURL);
      }

      // Fetch Stats: Activity
      const activityRef = collection(db, 'activityLogs');
      const qAct = query(activityRef, where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(1));
      const activitySnap = await getDocs(qAct);

      const lastLoginEl = document.getElementById('last-login-text');
      if (lastLoginEl && !activitySnap.empty) {
        const lastAct = activitySnap.docs[0].data();
        const time = lastAct.timestamp ? new Date(lastAct.timestamp.seconds ? lastAct.timestamp.seconds * 1000 : lastAct.timestamp).toLocaleString() : 'Just now';
        lastLoginEl.textContent = `Last activity: ${time}`;
      }

      // Fetch Stats: Projects & Tasks counts
      const projectsSnap = await getDocs(query(collection(db, 'projects'), where('owner', '==', user.uid)));
      const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('owner', '==', user.uid)));

      const summaryEl = document.getElementById('dashboard-summary');
      if (summaryEl) {
        summaryEl.innerHTML = `You have <span class="font-bold text-indigo-600 dark:text-indigo-400">${projectsSnap.size} projects</span> and <span class="font-bold text-indigo-600 dark:text-indigo-400">${tasksSnap.size} total tasks</span> across your workspace. Your account security status is currently optimal.`;
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      displayUserInfo(user.email);
    }
  });
}

// Display user information on the dashboard
function displayUserInfo(userName) {
  const displayNameEl = document.getElementById('display-user-name');
  const welcomeNameEl = document.getElementById('welcome-name');

  if (displayNameEl) {
    displayNameEl.textContent = userName;
  }
  if (welcomeNameEl) {
    welcomeNameEl.textContent = userName;
  }
}

import { logActivity } from './logger.js';

// Handle logout functionality
export function initializeLogout() {
  const logoutBtn = document.getElementById('logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const user = auth.currentUser;
      const device = `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`;

      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Logging out...';

      try {
        if (user) {
          await logActivity({
            uid: user.uid,
            email: user.email,
            action: 'logout',
            success: true,
            device: device
          });
        }

        // Sign out from Firebase
        await signOut(auth);

        // Clear localStorage
        localStorage.removeItem('currentUser');

        console.log('Logout successful');

        // Redirect to login page
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 500);
      } catch (error) {
        console.error('Logout error:', error);
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Logout';
        alert('Error logging out. Please try again.');
      }
    });
  }
}

// Get current user data from session
export function getCurrentUser() {
  const currentUserData = localStorage.getItem('currentUser');
  return currentUserData ? JSON.parse(currentUserData) : null;
}

// Check if user is authenticated
export function isAuthenticated() {
  return auth.currentUser !== null;
}

// Initialize dashboard
export function initializeDashboard() {
  checkAuthAndLoadUser();

  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLogout);
  } else {
    initializeLogout();
  }
}
