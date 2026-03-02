// theme.js - Global theme management for the application
import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';

/**
 * Initializes the theme from localStorage immediately to prevent FOUC (Flash of Unstyled Content).
 * This should be called as early as possible.
 */
export function applyInitialTheme() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

/**
 * Toggles the theme between light and dark.
 * Updates localStorage and attempts to sync with Firestore if user is logged in.
 */
export async function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Update Firestore if user is authenticated
    const user = auth.currentUser;
    if (user) {
        try {
            const ref = doc(db, 'users', user.uid);
            await updateDoc(ref, { 'settings.darkMode': isDark }).catch(async () => {
                await setDoc(ref, { settings: { darkMode: isDark } }, { merge: true });
            });
        } catch (err) {
            console.error('Error syncing theme with Firestore:', err);
        }
    }

    return isDark;
}

/**
 * Syncs the theme from Firestore on auth state change.
 * This ensures the theme preference follows the user across devices.
 */
export function syncThemeFromFirestore() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const ref = doc(db, 'users', user.uid);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.settings && typeof data.settings.darkMode !== 'undefined') {
                        const isDark = data.settings.darkMode;
                        if (isDark) {
                            document.documentElement.classList.add('dark');
                        } else {
                            document.documentElement.classList.remove('dark');
                        }
                        localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    }
                }
            } catch (err) {
                console.error('Error loading theme from Firestore:', err);
            }
        }
    });
}

// Automatically apply theme on load if this script is included
applyInitialTheme();
syncThemeFromFirestore();
