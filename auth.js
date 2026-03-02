// Import Firebase services
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
//vinond
// Handle login form submission
export function initializeLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('errorMessage');
    
    // Hide previous error
    errorEl.classList.add('hidden');

    try {
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

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
      alert('Login successful! Redirecting...');
      window.location.href = 'home.html';
      
    } catch (error) {
      // Display error message
      errorEl.textContent = error.message || 'Invalid email or password.';
      errorEl.classList.remove('hidden');
      
      // Clear password field for security
      document.getElementById('password').value = '';
    }
  });
}

// Check if user is already logged in
export function checkAuthStatus() {
  const currentUser = localStorage.getItem('currentUser');
  if (currentUser) {
    console.log('User already logged in. Redirecting to home...');
    window.location.href = 'home.html';
  }
}
