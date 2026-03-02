import { auth, db } from './firebase-config.js';
import './theme.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js';
import { collection, addDoc, doc, deleteDoc, query, orderBy, onSnapshot, where, getDoc } from 'https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js';
import { logActivity } from './logger.js';

export function initializeProjects() {
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
        setupEventListeners();
        attachProjectsListener(user);
        syncProfile(user);
    });
}

function setupEventListeners() {
    const modal = document.getElementById('projectModal');
    const openBtn = document.getElementById('openAddProjectBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelProjectBtn');
    const form = document.getElementById('projectForm');
    const logoutBtn = document.getElementById('logout-btn');

    const toggleModal = (show) => {
        if (show) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
            form.reset();
        }
    };

    if (openBtn) openBtn.onclick = () => toggleModal(true);
    if (closeBtn) closeBtn.onclick = () => toggleModal(false);
    if (cancelBtn) cancelBtn.onclick = () => toggleModal(false);

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('projectName').value.trim();
            const desc = document.getElementById('projectDesc').value.trim();
            const user = auth.currentUser;

            if (!name || !user) return;

            try {
                const ref = collection(db, 'projects');
                await addDoc(ref, {
                    name,
                    description: desc,
                    owner: user.uid,
                    createdAt: new Date().toISOString(),
                    taskCount: 0
                });

                await logActivity({
                    uid: user.uid,
                    email: user.email,
                    action: 'project_creation',
                    success: true,
                    device: `${navigator.userAgent.includes('Mobi') ? 'Mobile' : 'Desktop'} / ${navigator.userAgent}`
                });

                toggleModal(false);
            } catch (err) {
                console.error('Project creation failed:', err);
                alert('Failed to create project');
            }
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            const user = auth.currentUser;
            if (user) {
                await logActivity({
                    uid: user.uid,
                    email: user.email,
                    action: 'logout',
                    success: true,
                    device: 'Web Browser'
                });
            }
            await signOut(auth);
            localStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        };
    }
}

function attachProjectsListener(user) {
    const grid = document.getElementById('projectGrid');
    const emptyState = document.getElementById('empty-projects');
    const loading = document.getElementById('project-loading');

    const q = query(collection(db, 'projects'), where('owner', '==', user.uid), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        if (loading) loading.style.display = 'none';
        grid.innerHTML = '';

        if (snapshot.empty) {
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
            const card = createProjectCard(id, p);
            grid.appendChild(card);
        });
    });
}

function createProjectCard(id, data) {
    const div = document.createElement('div');
    div.className = 'group bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-primary/40 transition-all duration-300 relative';

    const date = new Date(data.createdAt).toLocaleDateString();

    div.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="flex justify-between items-start mb-4">
                <div class="p-3 bg-primary/10 text-primary rounded-xl">
                    <span class="material-symbols-outlined text-2xl">folder</span>
                </div>
                <button data-delete="${id}" class="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
            <h3 class="text-xl font-black text-slate-900 dark:text-white mb-2 truncate">${escapeHtml(data.name)}</h3>
            <p class="text-slate-500 dark:text-slate-400 text-sm mb-6 flex-grow line-clamp-3">${escapeHtml(data.description || 'No description provided.')}</p>
            <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">schedule</span>
                    ${date}
                </span>
                <a href="taskmanager.html?project=${id}" class="text-primary hover:underline flex items-center gap-1 group/link">
                    View Tasks
                    <span class="material-symbols-outlined text-xs group-hover/link:translate-x-1 transition-transform">arrow_forward</span>
                </a>
            </div>
        </div>
    `;

    // Attach delete handler
    div.querySelector('[data-delete]').onclick = async () => {
        if (confirm(`Are you sure you want to delete "${data.name}"?`)) {
            try {
                await deleteDoc(doc(db, 'projects', id));
                await logActivity({
                    uid: auth.currentUser.uid,
                    email: auth.currentUser.email,
                    action: 'project_deletion',
                    success: true,
                    device: 'Web Browser'
                });
            } catch (err) {
                console.error('Delete project failed:', err);
                alert('Failed to delete project');
            }
        }
    };

    return div;
}

async function syncProfile(user) {
    try {
        const headerName = document.getElementById('display-user-name');
        const avatarImgEls = document.querySelectorAll('[data-purpose="user-avatar"]');

        const userDoc = await getDoc(doc(db, 'users', user.uid));
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', '\'': '&#39;' }[c]));
}
