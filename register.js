import { auth, db } from './firebase-config.js';
import './theme.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { logActivity } from './logger.js';

// Initialize registration form
export function initializeRegisterForm() {
  const form = document.getElementById('signupForm');
  if (!form) return;

  const inputs = form.querySelectorAll('input');
  const successToast = document.getElementById('successToast');

  // Validation patterns
  const validators = {
    fullName: (val) => val.trim().length >= 2,
    email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    password: (val) => val.length >= 8,
    confirmPassword: (val) => val === document.getElementById('password').value
  };

  // Real-time validation feedback
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      validateField(input);
    });

    input.addEventListener('blur', () => {
      validateField(input);
    });
  });

  function validateField(input) {
    const fieldName = input.name;
    const errorDiv = document.getElementById(
      `${fieldName === 'confirmPassword' ? 'confirm' : fieldName.replace('fullName', 'name')}Error`
    );

    const isValid = validators[fieldName](input.value);

    if (!isValid && input.value !== "") {
      errorDiv.classList.remove('opacity-0');
      input.classList.add('border-red-500');
      input.classList.remove('border-gray-300');
    } else {
      errorDiv.classList.add('opacity-0');
      input.classList.remove('border-red-500');
      input.classList.add('border-gray-300');
    }
    return isValid;
  }

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let isFormValid = true;
    inputs.forEach(input => {
      if (!validateField(input)) {
        isFormValid = false;
      }
    });

    if (!isFormValid) return;

    // Gather form data
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const device = `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`;

    // Disable submit button during registration
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      console.log('User registered successfully! UID:', user.uid);

      // Log success
      await logActivity({
        uid: user.uid,
        email: user.email,
        action: 'register',
        success: true,
        device: device
      });

      // Store additional user data in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        fullName: fullName,
        email: email,
        createdAt: new Date().toISOString(),
        uid: user.uid
      });

      console.log('User profile saved to Firestore');

      // Show success message
      successToast.classList.remove('hidden');
      form.reset();

      // Clear input styling
      inputs.forEach(input => {
        input.classList.remove('border-red-500');
        input.classList.add('border-gray-300');
      });

      // Redirect after delay
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);

    } catch (error) {
      // Handle Firebase errors
      let errorMessage = 'Registration failed. Please try again.';

      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      }

      alert(errorMessage);
      console.error('Registration error:', error);
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}
