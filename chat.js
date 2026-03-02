import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { collection, query, where, orderBy, limit, addDoc, onSnapshot, getDocs, getDoc, serverTimestamp, updateDoc, doc, writeBatch } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

let currentUser = null;
let activeChatUserId = null;
let unsubscribeMessages = null;

// UI Elements
const chatToggleBtn = document.getElementById('chat-toggle-btn');
const chatWindow = document.getElementById('chat-window');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatForm = document.getElementById('chat-form');
const closeChatBtn = document.getElementById('close-chat-btn');
const showUsersBtn = document.getElementById('show-users-btn');
const chatUserList = document.getElementById('chat-user-list');
const usersContainer = document.getElementById('users-container');
const activeChatName = document.getElementById('active-chat-name');
const activeChatAvatar = document.getElementById('active-chat-avatar');
const activeChatStatus = document.getElementById('active-chat-status');

// Global join function for message buttons
window.joinVideoCall = (roomName, userName) => {
    initVideoUI(roomName, userName);
};
const chatNotificationCount = document.getElementById('chat-notification-count');
const headerNotificationCount = document.getElementById('header-notification-count');
const videoCallBtn = document.getElementById('video-call-btn');
const videoCallOverlay = document.getElementById('video-call-overlay');
const endCallBtn = document.getElementById('end-call-btn');
const callAvatar = document.getElementById('call-avatar');
const callName = document.getElementById('call-name');
let jitsiApi = null;

// Initialize Chat
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUsers();
        listenForGlobalNotifications();
        listenForIncomingCalls();
    } else {
        currentUser = null;
    }
});

// Toggle Chat Window
chatToggleBtn.addEventListener('click', () => {
    const isHidden = chatWindow.classList.contains('hidden');
    if (isHidden) {
        chatWindow.classList.remove('hidden');
        setTimeout(() => {
            chatWindow.classList.remove('translate-y-4', 'opacity-0');
            chatWindow.classList.add('translate-y-0', 'opacity-100');
        }, 10);

        // Show user list if no chat is active
        if (!activeChatUserId) {
            chatUserList.classList.remove('hidden');
            chatMessages.classList.add('hidden');
            loadUsers(); // Refresh list when window opens
        } else {
            markMessagesAsRead(activeChatUserId);
        }
    } else {
        closeChat();
    }
});

function closeChat() {
    chatWindow.classList.add('translate-y-4', 'opacity-0');
    chatWindow.classList.remove('translate-y-0', 'opacity-100');
    setTimeout(() => {
        chatWindow.classList.add('hidden');
    }, 300);
}

closeChatBtn.addEventListener('click', closeChat);

// Toggle User List
showUsersBtn.addEventListener('click', () => {
    chatUserList.classList.toggle('hidden');
    chatMessages.classList.toggle('hidden');
});

// Load Users from Firestore with Last Message Preview
async function loadUsers() {
    try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        usersContainer.innerHTML = '';

        const usersData = [];
        querySnapshot.forEach((userDoc) => {
            if (userDoc.id !== currentUser.uid) {
                usersData.push({ id: userDoc.id, ...userDoc.data() });
            }
        });

        for (const userData of usersData) {
            // Fetch last message for this user to show in "history"
            const conversationId = [currentUser.uid, userData.id].sort().join('_');
            const lastMsgRef = collection(db, 'messages');
            const q = query(
                lastMsgRef,
                where('conversationId', '==', conversationId),
                limit(20) // Get some recent messages to find the last one
            );

            let lastMsgText = 'No messages yet';
            let lastMsgTime = '';

            try {
                const lastMsgSnap = await getDocs(q);
                if (!lastMsgSnap.empty) {
                    // Sort locally to avoid needing a composite index
                    const allMsgs = lastMsgSnap.docs.map(d => d.data());
                    allMsgs.sort((a, b) => {
                        const tA = a.timestamp ? (a.timestamp.seconds || a.timestamp / 1000) : 0;
                        const tB = b.timestamp ? (b.timestamp.seconds || b.timestamp / 1000) : 0;
                        return tB - tA; // Newest first
                    });

                    const msg = allMsgs[0];
                    lastMsgText = msg.text.length > 25 ? msg.text.substring(0, 25) + '...' : msg.text;
                    lastMsgTime = msg.timestamp ? new Date(msg.timestamp.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
                }
            } catch (historyError) {
                console.warn("History fetch failed, probably still indexing. Showing default:", historyError.message);
            }

            const userElement = document.createElement('div');
            userElement.className = 'px-3 py-3 flex items-center space-x-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl cursor-pointer transition-all duration-200 group';
            userElement.innerHTML = `
                <div class="relative">
                    <div class="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 border-2 border-white dark:border-slate-800 shadow-sm">
                        ${userData.fullName ? userData.fullName[0].toUpperCase() : '?'}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-baseline mb-0.5">
                        <div class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${userData.fullName || 'User'}</div>
                        <div class="text-[10px] text-slate-400 font-medium">${lastMsgTime}</div>
                    </div>
                    <div class="text-xs text-slate-500 truncate group-hover:text-slate-600 dark:group-hover:text-slate-300">${lastMsgText}</div>
                </div>
            `;
            userElement.onclick = () => startChat(userData.id, userData.fullName || 'User');
            usersContainer.appendChild(userElement);
        }
    } catch (error) {
        console.error("Error loading users:", error);
    }
}

// Start Chat with a User
function startChat(userId, userName) {
    activeChatUserId = userId;
    activeChatName.textContent = userName;
    activeChatAvatar.textContent = userName[0].toUpperCase();
    activeChatStatus.textContent = 'Online';

    chatUserList.classList.add('hidden');
    chatMessages.classList.remove('hidden');
    chatInput.disabled = false;
    document.getElementById('send-btn').disabled = false;
    videoCallBtn.classList.remove('hidden'); // Show video call button
    chatInput.focus();

    markMessagesAsRead(userId);
    loadMessages();
}

// Mark messages from a specific sender as read
async function markMessagesAsRead(senderId) {
    if (!currentUser) return;

    try {
        const messagesRef = collection(db, 'messages');
        const q = query(
            messagesRef,
            where('senderId', '==', senderId),
            where('receiverId', '==', currentUser.uid),
            where('read', '==', false)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        snapshot.forEach((msgDoc) => {
            batch.update(msgDoc.ref, { read: true });
        });
        await batch.commit();
    } catch (error) {
        console.error("Error marking messages as read:", error);
    }
}

// Load Messages for the active conversation
function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();

    const conversationId = [currentUser.uid, activeChatUserId].sort().join('_');
    const messagesRef = collection(db, 'messages');
    const q = query(
        messagesRef,
        where('conversationId', '==', conversationId)
        // orderBy('timestamp', 'asc') // Removing this to bypass index requirement
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        // Clear container completely to avoid duplicates when local user sends a message
        chatMessages.innerHTML = '';

        if (snapshot.empty) {
            chatMessages.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-400 text-sm italic">
                    No history found. Say hello!
                </div>
            `;
            return;
        }

        const messagesData = [];
        snapshot.forEach((doc) => {
            messagesData.push({ id: doc.id, ...doc.data() });
        });

        messagesData.sort((a, b) => {
            const tA = (a.timestamp?.seconds || a.timestamp / 1000) || Date.now();
            const tB = (b.timestamp?.seconds || b.timestamp / 1000) || Date.now();
            return tA - tB;
        });

        const fragment = document.createDocumentFragment();
        messagesData.forEach((message) => {
            const isMine = message.senderId === currentUser.uid;
            const msgEl = document.createElement('div');
            msgEl.className = `flex ${isMine ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`;

            let messageContent = message.text;
            if (message.type === 'video-call') {
                messageContent = `
                    <div class="flex flex-col items-center space-y-2 py-2">
                        <div class="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </div>
                        <p class="font-bold text-xs uppercase tracking-wider">Video Call Started</p>
                        <button onclick="window.joinVideoCall('${message.roomName}', '${isMine ? 'You' : 'Someone'}')" class="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-full text-xs font-bold transition-all shadow-sm">
                            Join Call
                        </button>
                    </div>
                `;
            }

            msgEl.innerHTML = `
                <div class="group relative max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMine ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm'}">
                    ${messageContent}
                    <div class="text-[9px] mt-1 opacity-60 ${isMine ? 'text-right' : 'text-left'}">
                        ${message.timestamp ? new Date(message.timestamp.seconds ? message.timestamp.seconds * 1000 : message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </div>
                </div>
            `;
            fragment.appendChild(msgEl);
        });
        chatMessages.appendChild(fragment);

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // If window is open and showing this chat, mark as read
        if (!chatWindow.classList.contains('hidden') && activeChatUserId) {
            markMessagesAsRead(activeChatUserId);
        }
    }, (error) => {
        console.error("Snapshot error:", error);
        if (error.code === 'failed-precondition') {
            chatMessages.innerHTML = `
                <div class="p-4 text-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg text-xs italic">
                    <p class="font-bold mb-1">Indexing Required</p>
                    Your message history is being indexed by the database. This takes 1-2 minutes. Please wait and try again.
                </div>
            `;
        } else {
            chatMessages.innerHTML = `<div class="text-red-500 text-xs italic text-center p-4">Error loading messages: ${error.message}</div>`;
        }
    });
}

// Global listener for unread messages to update counts
function listenForGlobalNotifications() {
    if (!currentUser) return;

    const messagesRef = collection(db, 'messages');
    const qUnread = query(
        messagesRef,
        where('receiverId', '==', currentUser.uid),
        where('read', '==', false)
    );

    onSnapshot(qUnread, (snapshot) => {
        const unreadCount = snapshot.size;

        // Update Floating Button Badge
        if (unreadCount > 0) {
            chatNotificationCount.textContent = unreadCount > 9 ? '9+' : unreadCount;
            chatNotificationCount.classList.remove('hidden');

            // Update Header Bell Badge
            headerNotificationCount.textContent = unreadCount;
            headerNotificationCount.classList.remove('hidden');
        } else {
            chatNotificationCount.classList.add('hidden');
            headerNotificationCount.classList.add('hidden');
        }
    });
}

// Send Message
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !activeChatUserId) return;

    chatInput.value = '';
    const conversationId = [currentUser.uid, activeChatUserId].sort().join('_');

    try {
        await addDoc(collection(db, 'messages'), {
            conversationId,
            senderId: currentUser.uid,
            receiverId: activeChatUserId,
            text,
            read: false,
            timestamp: serverTimestamp()
        });

        // Refresh users list to update "last message" history preview
        loadUsers();
    } catch (error) {
        console.error("Error sending message:", error);
    }
});

// Video Call Logic - Consolidated
videoCallBtn.addEventListener('click', (e) => {
    e.preventDefault();
    console.log("Video Call button clicked. Active User:", activeChatUserId);
    if (!activeChatUserId) {
        alert("Please select a user to start a video call.");
        return;
    }
    startVideoCall(activeChatUserId, activeChatName.textContent);
});

async function startVideoCall(userId, userName) {
    // Generate a fixed room name based on conversation ID to avoid mismatch
    const roomName = `SecurePortal_Call_${[currentUser.uid, userId].sort().join('_').substring(0, 10)}${Date.now()}`;
    console.log("Starting call to:", userName, "in room:", roomName);

    try {
        const conversationId = [currentUser.uid, userId].sort().join('_');
        console.log("Conversation ID for call notification:", conversationId);

        // Notify the receiver via a special message type
        await addDoc(collection(db, 'messages'), {
            conversationId,
            senderId: currentUser.uid,
            receiverId: userId,
            text: `📞 Started a video call. [Join Call](call:${roomName})`,
            type: 'video-call',
            roomName: roomName,
            read: false,
            timestamp: serverTimestamp()
        });

        initVideoUI(roomName, userName);
    } catch (error) {
        console.error("Error starting video call:", error);
    }
}

function initVideoUI(roomName, userName) {
    videoCallOverlay.classList.remove('hidden');
    callName.textContent = userName || 'User';
    callAvatar.textContent = userName ? userName[0].toUpperCase() : '?';

    // Clear loading state
    document.getElementById('call-loading-state').classList.add('hidden');

    if (jitsiApi) jitsiApi.dispose();

    // Switching to meet.ffmuc.net - a reliable public Jitsi instance 
    // that doesn't require moderator login for new rooms.
    const domain = "meet.ffmuc.net";
    const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: document.getElementById('jitsi-container'),
        userInfo: {
            displayName: currentUser.email || 'User'
        },
        configOverwrite: {
            startWithAudioMuted: false,
            disableThirdPartyRequests: true,
            prejoinPageEnabled: false,
            enableWelcomePage: false
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'hangup', 'chat', 'tileview', 'fullscreen', 'settings']
        }
    };

    if (window.JitsiMeetExternalAPI) {
        jitsiApi = new window.JitsiMeetExternalAPI(domain, options);
        jitsiApi.addEventListeners({
            readyToClose: () => endCall(),
            videoConferenceLeft: () => endCall()
        });
    } else {
        console.error("Jitsi Meet API script not loaded yet. Retrying...");
        setTimeout(() => initVideoUI(roomName, userName), 1000);
    }
}

endCallBtn.addEventListener('click', endCall);

function endCall() {
    if (jitsiApi) jitsiApi.dispose();
    videoCallOverlay.classList.add('hidden');
    document.getElementById('call-loading-state').classList.remove('hidden');
}

// Global listener for incoming calls (using messages with type 'video-call')
function listenForIncomingCalls() {
    console.log("Initializing incoming call listener for:", currentUser.uid);
    const messagesRef = collection(db, 'messages');
    const q = query(
        messagesRef,
        where('receiverId', '==', currentUser.uid),
        where('type', '==', 'video-call'),
        limit(5)
    );

    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            console.log("Incoming call message detected!");
            const calls = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Client-side sort to avoid index requirement
            calls.sort((a, b) => {
                const tA = a.timestamp?.toMillis() || 0;
                const tB = b.timestamp?.toMillis() || 0;
                return tB - tA;
            });

            const lastCall = calls[0];
            const now = Date.now();
            const callTime = lastCall.timestamp ? lastCall.timestamp.toMillis() : now;

            // Only alert if the call is recent (within 60 seconds)
            if (now - callTime < 60000 && videoCallOverlay.classList.contains('hidden')) {
                showIncomingCallPrompt(lastCall.roomName, lastCall.senderId);
            }
        }
    }, (error) => {
        console.error("Call listener error:", error.message);
    });
}

function showIncomingCallPrompt(roomName, senderId) {
    getDoc(doc(db, 'users', senderId)).then(userDoc => {
        const callerName = userDoc.exists() ? userDoc.data().fullName : 'Someone';
        if (confirm(`${callerName} is inviting you to a video call! Join now?`)) {
            window.joinVideoCall(roomName, callerName);
        }
    });
}

