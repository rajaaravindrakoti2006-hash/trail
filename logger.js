import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

/**
 * Logs a user activity to Firestore
 * @param {Object} data - Activity data
 * @param {string} data.uid - User ID
 * @param {string} data.email - User Email
 * @param {string} data.action - Action performed (login, register, etc)
 * @param {boolean} data.success - Whether the action was successful
 * @param {string} [data.device] - Device/Browser info
 */
export async function logActivity({ uid, email, action, success, device }) {
    try {
        const colRef = collection(db, 'activityLogs');
        await addDoc(colRef, {
            uid: uid || 'anonymous',
            email: email || 'anonymous',
            action: action || 'unknown',
            success: !!success,
            device: device || navigator.userAgent,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}
