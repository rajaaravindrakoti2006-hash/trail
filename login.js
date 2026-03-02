import { auth, db } from './firebase-config.js';
import './theme.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { logActivity } from './logger.js';

// Handle login form submission
export function initializeLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('errorMessage');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    // Hide previous error
    errorEl.classList.add('hidden');

    // Disable button during login
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';

    const device = `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`;

    try {
      // Sign in with Firebase
      console.log('Attempting login with email:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('Login successful! User UID:', user.uid);

      // Log success
      await logActivity({
        uid: user.uid,
        email: user.email,
        action: 'login',
        success: true,
        device: device
      });

      // Fetch user data from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // Success: Set session in localStorage
      const sessionData = {
        email: user.email,
        uid: user.uid,
        fullName: userDocSnap.exists() ? userDocSnap.data().fullName : 'User',
        lastLogin: new Date().toISOString()
      };

      localStorage.setItem('currentUser', JSON.stringify(sessionData));

      // Redirect to home/dashboard
      console.log('Login successful for:', email);
      // Ensure redirect path is correct and navigate
      setTimeout(() => {
        window.location.href = './home.html';
      }, 300);

    } catch (error) {
      // Display error message
      let errorMessage = 'Invalid email or password.';

      console.error('Login error code:', error.code);
      console.error('Login error message:', error.message);

      // Log failure
      await logActivity({
        email: email,
        action: 'login',
        success: false,
        device: device
      });

      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many login attempts. Please try again later.';
      }

      errorEl.textContent = errorMessage;
      errorEl.classList.remove('hidden');
      console.error('Login error:', error);

      // Clear password field for security
      document.getElementById('password').value = '';
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// Check if user is already logged in and redirect
export function checkAuthStatus() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is logged in, redirect to home
      const currentUser = localStorage.getItem('currentUser');
      if (currentUser) {
        console.log('User already logged in. Redirecting to home...');
        // window.location.href = 'home.html'; // Auto-redirect disabled
      }
    }
  });
}

// Logout function
export async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem('currentUser');
    console.log('Logout successful');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Get current user session
export function getCurrentUser() {
  const currentUserData = localStorage.getItem('currentUser');
  return currentUserData ? JSON.parse(currentUserData) : null;
}

// Check if user is authenticated
export function isAuthenticated() {
  return localStorage.getItem('currentUser') !== null;
}
