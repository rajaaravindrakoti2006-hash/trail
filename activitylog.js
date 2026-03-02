// Activity log module: subscribes to 'activityLogs' collection and renders rows
import { auth, db } from './firebase-config.js';
import './theme.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { collection, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

export function initializeActivityLog() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}

function _init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    attachListener();
    setupLogout();
    syncProfile(user);
  });
}

async function syncProfile(user) {
  try {
    const headerName = document.getElementById('display-user-name');
    const avatarImgEls = document.querySelectorAll('[data-purpose="user-avatar"]');

    // Fetch firestore data for full name if needed
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.exists() ? userDoc.data() : {};
    const displayName = userData.fullName || user.displayName || 'User';

    if (headerName) headerName.textContent = displayName;
    if (avatarImgEls.length > 0 && (userData.photoURL || user.photoURL)) {
      avatarImgEls.forEach(img => img.src = userData.photoURL || user.photoURL);
    }
  } catch (err) {
    console.error('Profile sync error:', err);
  }
}

import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  }
}

function attachListener() {
  const tbody = document.getElementById('activityTableBody');
  if (!tbody) return;

  const colRef = collection(db, 'activityLogs');
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(100));

  // Real-time listener
  onSnapshot(q, (snapshot) => {
    tbody.innerHTML = '';
    const uids = new Set();
    let total = 0;
    let alerts = 0;

    snapshot.forEach(doc => {
      total++;
      const d = doc.data();
      if (d.uid) uids.add(d.uid);
      if (d.success === false) alerts++;

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group';

      const uidTd = `<td class="px-6 py-4"><code class="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-primary font-mono">${(d.uid || '').slice(0, 6)}...</code></td>`;
      const emailTd = `<td class="px-6 py-4"><div class="flex flex-col"><span class="text-sm font-semibold">${d.email || '—'}</span><span class="text-[10px] text-slate-400">ID: ${d.uid || '—'}</span></div></td>`;
      const time = d.timestamp ? new Date(d.timestamp.seconds ? d.timestamp.seconds * 1000 : d.timestamp).toLocaleString() : '—';
      const timeTd = `<td class="px-6 py-4"><div class="flex flex-col"><span class="text-sm">${time.split(',')[0]}</span><span class="text-xs text-slate-400">${time.split(',').slice(1).join(',')}</span></div></td>`;
      const deviceTd = `<td class="px-6 py-4"><div class="flex items-center gap-2"><span class="material-symbols-outlined text-slate-400">laptop_mac</span><span class="text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">${d.device || 'Unknown'}</span></div></td>`;
      const statusTd = `<td class="px-6 py-4"><span class="flex items-center gap-1.5 text-xs font-bold ${d.success ? 'text-green-600' : 'text-red-600'}"><span class="h-1.5 w-1.5 rounded-full ${d.success ? 'bg-green-500' : 'bg-red-500'}"></span> ${d.success ? 'Success' : 'Failed'}</span></td>`;

      tr.innerHTML = uidTd + emailTd + timeTd + deviceTd + statusTd;
      tbody.appendChild(tr);
    });

    // Update stats
    const totalEl = document.getElementById('stat-total-sessions');
    const uniqueEl = document.getElementById('stat-unique-users');
    const alertsEl = document.getElementById('stat-security-alerts');

    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (uniqueEl) uniqueEl.textContent = uids.size.toLocaleString();
    if (alertsEl) alertsEl.textContent = alerts.toLocaleString();

  }, (err) => {
    console.error('Activity log listener error:', err);
  });
}
