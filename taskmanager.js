// Task manager module: CRUD tasks in 'tasks' collection
import { auth, db } from './firebase-config.js';
import './theme.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, orderBy, onSnapshot, where, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';

export function initializeTaskManager() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
}

function _init() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    bindForm();
    attachTasksListener();
    setupLogout();
    setupSearch();
    syncProfile(user);
    loadProjectsForDropdown(user);
  });
}

async function loadProjectsForDropdown(user) {
  try {
    const projectSelect = document.getElementById('taskProject');
    if (!projectSelect) return;

    const q = query(collection(db, 'projects'), where('owner', '==', user.uid));
    const snap = await getDocs(q);

    snap.forEach(docSnap => {
      const p = docSnap.data();
      const opt = document.createElement('option');
      opt.value = docSnap.id;
      opt.textContent = p.name;
      projectSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading projects:', err);
  }
}

function setupSearch() {
  const searchInput = document.querySelector('input[placeholder="Search tasks..."]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const taskItems = document.querySelectorAll('#taskList > div:not(#empty-state)');
      taskItems.forEach(item => {
        const title = item.querySelector('h3').textContent.toLowerCase();
        const desc = item.querySelector('p').textContent.toLowerCase();
        if (title.includes(term) || desc.includes(term)) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  }
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

    if (headerName) headerName.textContent = displayName.split(' ')[0];
    if (avatarImgEls.length > 0 && (userData.photoURL || user.photoURL)) {
      avatarImgEls.forEach(img => img.src = userData.photoURL || user.photoURL);
    }
  } catch (err) {
    console.error('Profile sync error:', err);
  }
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

function bindForm() {
  const titleEl = document.getElementById('taskTitle');
  const descEl = document.getElementById('taskDesc');
  const projectEl = document.getElementById('taskProject');
  const saveBtn = document.getElementById('saveTaskBtn');

  if (!titleEl || !descEl || !saveBtn) return;

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const title = titleEl.value.trim();
    const desc = descEl.value.trim();
    const projectId = projectEl ? projectEl.value : '';

    if (!title) { alert('Please enter a task title'); return; }

    try {
      const user = auth.currentUser;
      const ref = collection(db, 'tasks');
      await addDoc(ref, {
        title,
        description: desc,
        projectId,
        completed: false,
        owner: user.uid,
        createdAt: new Date().toISOString()
      });

      await logActivity({
        uid: user.uid,
        email: user.email,
        action: 'task_creation',
        success: true,
        device: `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.appName}`
      });

      titleEl.value = '';
      descEl.value = '';
      if (projectEl) projectEl.value = '';
    } catch (err) {
      console.error('Create task error:', err);
      alert('Failed to create task');
    }
  });
}

function attachTasksListener() {
  const listEl = document.getElementById('taskList');
  const emptyState = document.getElementById('empty-state');
  const activeCounter = document.getElementById('active-task-count');

  if (!listEl) return;

  const user = auth.currentUser;
  const ref = collection(db, 'tasks');
  const q = query(ref, where('owner', '==', user.uid), orderBy('createdAt', 'desc'));

  onSnapshot(q, async (snapshot) => {
    // Fetch all user projects once to map IDs to names
    const projectsMap = {};
    try {
      const pSnap = await getDocs(query(collection(db, 'projects'), where('owner', '==', user.uid)));
      pSnap.forEach(pd => projectsMap[pd.id] = pd.data().name);
    } catch (e) { console.warn('Could not map projects', e); }

    // Preserve empty state element if it exists
    const emptyStateHTML = emptyState ? emptyState.outerHTML : '';
    listEl.innerHTML = '';

    let activeItems = 0;

    if (snapshot.empty) {
      if (emptyState) {
        emptyState.classList.remove('hidden');
        listEl.appendChild(emptyState);
      }
      if (activeCounter) activeCounter.textContent = '0 Tasks Active';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    snapshot.forEach(docSnap => {
      const t = docSnap.data();
      const id = docSnap.id;
      if (!t.completed) activeItems++;

      const projectName = t.projectId ? (projectsMap[t.projectId] || 'Unknown Project') : 'No Project';

      const item = document.createElement('div');
      item.className = t.completed ? 'group bg-slate-50 dark:bg-slate-800/40 rounded-xl p-5 border border-slate-100 dark:border-slate-800/60 shadow-none transition-all' : 'group bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 transition-all';

      item.innerHTML = `
        <div class="flex items-start gap-4">
          <div class="pt-1"><input data-id="${id}" class="task-checkbox w-6 h-6 rounded-lg border-slate-300 dark:border-slate-600 text-primary focus:ring-primary bg-transparent transition-all cursor-pointer" type="checkbox" ${t.completed ? 'checked' : ''}></div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <h3 class="text-lg font-bold ${t.completed ? 'text-slate-400 line-through' : 'text-slate-900'} dark:text-${t.completed ? 'slate-500' : 'white'} truncate">${escapeHtml(t.title)}</h3>
              <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-delete="${id}" class="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"><span class="material-symbols-outlined text-[20px]">delete</span></button>
              </div>
            </div>
            <p class="${t.completed ? 'text-slate-400 line-through' : 'text-slate-600'} dark:text-slate-400 text-sm mb-3 line-clamp-2">${escapeHtml(t.description || '')}</p>
            <div class="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400 dark:text-slate-500">
              <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">schedule</span>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
              <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <span class="material-symbols-outlined text-[14px]">folder</span>
                ${escapeHtml(projectName)}
              </span>
              <span class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                <span class="material-symbols-outlined text-[14px]">category</span>
                ${t.completed ? 'Completed' : 'Active'}
              </span>
            </div>
          </div>
        </div>
      `;

      listEl.appendChild(item);
    });

    if (activeCounter) activeCounter.textContent = `${activeItems} Tasks Active`;
    bindTaskActions();
  }, (err) => {
    console.error('Tasks listener error:', err);
  });
}

function bindTaskActions() {
  document.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.removeEventListener('change', onTaskToggle);
    cb.addEventListener('change', onTaskToggle);
  });

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.removeEventListener('click', onTaskDelete);
    btn.addEventListener('click', onTaskDelete);
  });
}

async function onTaskToggle(e) {
  const id = e.target.getAttribute('data-id');
  const checked = e.target.checked;
  try {
    const ref = doc(db, 'tasks', id);
    await updateDoc(ref, { completed: checked });
  } catch (err) {
    console.error('Toggle task error:', err);
  }
}

async function onTaskDelete(e) {
  const id = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (!id) return;
  if (!confirm('Delete this task?')) return;
  try {
    const ref = doc(db, 'tasks', id);
    await deleteDoc(ref);
  } catch (err) {
    console.error('Delete task error:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>\"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', '\'': '&#39;' }[c]; });
}
