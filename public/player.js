const socket = io(); 

let pendingAction = null; 
let pendingData = null;
window.allUsersDB = [];
let currentShareLinkGlobal = ""; 
let currentProfileView = '';
let currentChatTarget = null;

const activeUser = localStorage.getItem('streamVibeActiveUser') || 'Khách Vô Danh';

// FIX: Đảm bảo khi đang xem phim, bạn vẫn ở trong kênh riêng tư
socket.on('connect', () => {
    if (activeUser && activeUser !== 'Khách Vô Danh') {
        socket.emit('join_user_channel', activeUser);
    }
});

function openConfirm(action, data, title, message) {
    pendingAction = action; pendingData = data; 
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMessage').innerText = message; 
    document.getElementById('universalConfirmModal').style.display = 'flex';
}

function closeConfirm() { 
    document.getElementById('universalConfirmModal').style.display = 'none'; 
    pendingAction = null; pendingData = null; 
}

function executeConfirmAction() {
    if (pendingAction === 'deleteChatMessage') {
        const chatId = pendingData;
        fetch('/api/chat/' + chatId, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if(data.success) {
                socket.emit('delete_chat_realtime', { videoId: videoId, chatId: chatId });
                const el = document.getElementById('chat-' + chatId);
                if (el) el.remove();
            }
        });
    }
    closeConfirm();
}

function getUserRole(username) {
    if (!username) return 'user'; 
    
    const activeUserLoggedIn = localStorage.getItem('streamVibeActiveUser');
    if (username === activeUserLoggedIn) {
        const exactRole = localStorage.getItem('streamVibeActiveRole');
        if (exactRole) return exactRole;
    }

    if (window.allUsersDB && window.allUsersDB.length > 0) {
        const foundUser = window.allUsersDB.find(u => u.username === username);
        if (foundUser) return foundUser.role;
    }

    const name = username.toLowerCase();
    if (name === 'lam' || name === 'lâm' || name === 'boss') return 'superadmin';
    if (name === 'admin_thong ke'.toLowerCase()) return 'statadmin';
    if (name.includes('admin') || name.includes('quanly')) return 'admin';
    return 'user';
}

const role = getUserRole(activeUser);
const radarSection = document.getElementById('hlsRadarSection');
const videoSection = document.getElementById('mainVideoSection');
if (role === 'user') {
    radarSection.style.display = 'none';
    videoSection.style.margin = '0 auto';
    videoSection.style.maxWidth = '1100px'; 
}

const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('id') || 'demo_hash_id';
let ownerName = 'Hệ Thống';

function timeAgo(dateString) {
    if (!dateString) return "Vừa xong";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + " năm trước";
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " tháng trước";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval + " ngày trước";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " giờ trước";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " phút trước";
    return "Vừa xong";
}
socket.emit('join_video', videoId);

function getAvatarUrl(username) {
    let avatars = JSON.parse(localStorage.getItem('streamVibeAvatars')) || {};
    if (avatars[username]) return avatars[username];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff`;
}

function shareVideo(id, event) {
    if(event) event.stopPropagation();
    
    const link = window.location.origin + '/player.html?id=' + id;
    currentShareLinkGlobal = link;

    const shareInput = document.getElementById('shareLinkURLInput');
    const shareModal = document.getElementById('shareVideoModal');
    
    if (shareInput && shareModal) {
        shareInput.value = link;
        shareModal.style.display = 'flex';
    } else {
        navigator.clipboard.writeText(link).then(() => {
            openAlert("Thành công!", "Đã copy link video vào bộ nhớ tạm.", "success");
        });
    }
}

function copyShareLinkDirectly() {
    const input = document.getElementById('shareLinkURLInput');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        openAlert("Thành công!", "Đã sao chép link video vào bộ nhớ tạm.", "success");
    }).catch(err => {
        openAlert("Lỗi", "Trình duyệt không hỗ trợ copy tự động.", "error");
    });
}

function shareToApp(platform) {
    const encodedLink = encodeURIComponent(currentShareLinkGlobal);
    const text = encodeURIComponent("Xem video này trên StreamVibe nhé! 🚀");
    let url = "";

    switch(platform) {
        case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`; break;
        case 'messenger': 
            url = `fb-messenger://share/?link=${encodedLink}`; 
            if(!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                url = `https://www.facebook.com/dialog/send?link=${encodedLink}&app_id=291667064273102&redirect_uri=${encodedLink}`;
            }
            break;
        case 'zalo': url = `https://chat.zalo.me/?url=${encodedLink}`; break;
        case 'telegram': url = `https://t.me/share/url?url=${encodedLink}&text=${text}`; break;
        case 'gmail': url = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent("Chia sẻ luồng Video StreamVibe")}&body=${encodedLink}`; break;
    }

    if(url) window.open(url, '_blank'); 
}

async function openUserProfile(username) {
    currentProfileView = username;
    
    const avatarEl = document.getElementById('viewProfileAvatar');
    if(avatarEl) avatarEl.src = getAvatarUrl(username);
    
    const nameEl = document.getElementById('viewProfileName');
    if(nameEl) nameEl.innerHTML = `${username} ${username.toLowerCase() === 'lam' ? '<i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 14px;"></i>' : ''}`;
    
    let userRole = getUserRole(username);
    let roleStr = "Thành viên hệ thống";
    let roleColor = "var(--text-sub)";
    let bgRoleColor = "rgba(255,255,255,0.05)";
    
    if (userRole === 'superadmin') {
        roleStr = "Tổng Tư Lệnh (Super Admin)";
        roleColor = "#f59e0b";
        bgRoleColor = "rgba(245, 158, 11, 0.1)";
    } else if (userRole === 'admin') {
        roleStr = "Quản trị viên (Admin)";
        roleColor = "#ef4444";
        bgRoleColor = "rgba(239, 68, 68, 0.1)";
    } else if (userRole === 'statadmin') {
        roleStr = "Quản lý Thống Kê";
        roleColor = "#10b981";
        bgRoleColor = "rgba(16, 185, 129, 0.1)";
    }
    
    const roleEl = document.getElementById('viewProfileRole');
    if(roleEl) {
        roleEl.innerText = roleStr;
        roleEl.style.color = roleColor;
        roleEl.style.background = bgRoleColor;
        
        // NẾU LÀ NGƯỜI DÙNG BÌNH THƯỜNG THÌ ẨN CÁI MÁC ĐI
        if (userRole === 'user') {
            roleEl.style.display = 'none';
        } else {
            // NẾU LÀ ADMIN, TỔNG TƯ LỆNH THÌ HIỆN LÊN CHO NGẦU
            roleEl.style.display = 'inline-block';
        }
    }

    const btnFollow = document.getElementById('btnFollowUser');
    const btnMsg = document.getElementById('btnMessageUser');
    if (username === activeUser) {
        if(btnFollow) btnFollow.style.display = 'none';
        if(btnMsg) btnMsg.style.display = 'none';
    } else {
        if(btnFollow) btnFollow.style.display = 'inline-block';
        if(btnMsg) btnMsg.style.display = 'inline-block';
    }

    const modalEl = document.getElementById('userProfileModal');
    if(modalEl) modalEl.style.display = 'flex';

    const videoGrid = document.getElementById('profileVideoGrid');
    if(videoGrid) videoGrid.innerHTML = '<p style="color:var(--text-secondary); font-size: 15px; padding: 10px;">Đang tải dữ liệu...</p>';
    
    const vCountEl = document.getElementById('profileVideoCount');
    if(vCountEl) vCountEl.innerText = '0';
    
    const fCountEl = document.getElementById('profileFollowerCount');
    if(fCountEl) fCountEl.innerText = '0';

    try {
        const res = await fetch(`/api/users/${username}/profile?viewer=${activeUser}`);
        const data = await res.json();
        
        if (data.success) {
            if(fCountEl) fCountEl.innerText = data.followerCount;
            if(btnFollow) {
                if (data.isFollowing) {
                    btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Đang theo dõi`;
                    btnFollow.style.background = 'rgba(255,255,255,0.1)';
                } else {
                    btnFollow.innerHTML = `<i class="fa-solid fa-user-plus"></i> Theo dõi`;
                    btnFollow.style.background = 'var(--accent-blue)';
                }
            }

            if(vCountEl) vCountEl.innerText = data.videos.length;
            if(videoGrid) {
                if (data.videos.length === 0) {
                    videoGrid.innerHTML = '<p style="color:var(--text-secondary); font-size: 15px; grid-column: 1/-1; text-align: center; padding: 20px;">Người dùng này chưa tải lên video nào.</p>';
                } else {
                    videoGrid.innerHTML = '';
                    data.videos.forEach(video => {
                        const id = video.videoId;
                        const title = video.title || 'Video không tên';
                        const views = Array.isArray(video.views) ? video.views.length : 0;
                        const thumbBg = `url('/videos/${id}/thumbnail.jpg') center top / cover no-repeat`;
                        
                        const card = document.createElement('div');
                        card.style.background = 'rgba(15, 23, 42, 0.5)';
                        card.style.border = '1px solid rgba(255,255,255,0.05)';
                        card.style.borderRadius = '12px';
                        card.style.padding = '12px';
                        card.style.cursor = 'pointer';
                        card.style.transition = '0.2s';
                        card.onmouseover = () => { card.style.borderColor = 'var(--accent-primary)'; card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';};
                        card.onmouseout = () => { card.style.borderColor = 'rgba(255,255,255,0.05)';
                        card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none';};
                        card.onclick = () => { window.location.href = '/player.html?id=' + id; };
                        card.innerHTML = `
                            <div style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: ${thumbBg}; margin-bottom: 12px;"></div>
                            <div style="font-size: 16px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                            <div style="font-size: 13px; color: #94a3b8; margin-top: 6px;"><i class="fa-solid fa-eye"></i> ${views} lượt xem</div>
                        `;
                        videoGrid.appendChild(card);
                    });
                }
            }
        } else {
            if(videoGrid) videoGrid.innerHTML = '<p style="color:#ef4444; font-size: 15px; text-align:center;">Lỗi lấy dữ liệu</p>';
        }
    } catch (err) {
        if(videoGrid) videoGrid.innerHTML = '<p style="color:#ef4444; font-size: 15px; text-align:center;">Lỗi kết nối</p>';
    }
}

function closeUserProfile() { 
    const modalEl = document.getElementById('userProfileModal');
    if(modalEl) modalEl.style.display = 'none'; 
}

async function toggleFollow() {
    try {
        const res = await fetch(`/api/users/${currentProfileView}/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUser: activeUser })
        });
        const data = await res.json();
        if (data.success) {
            const fCountEl = document.getElementById('profileFollowerCount');
            if(fCountEl) fCountEl.innerText = data.followerCount;
            const btnFollow = document.getElementById('btnFollowUser');
            if(btnFollow) {
                if (data.isFollowing) {
                    btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Đang theo dõi`;
                    btnFollow.style.background = 'rgba(255,255,255,0.1)';
                } else {
                    btnFollow.innerHTML = `<i class="fa-solid fa-user-plus"></i> Theo dõi`;
                    btnFollow.style.background = 'var(--accent-blue)';
                }
            }
        }
    } catch(e) { console.error(e); }
}

function goToPrivateChat() {
    window.location.href = `/?tab=privateMessages&chatUser=${currentProfileView}`;
}

function openImageViewer(src) {
    document.getElementById('fullSizeImage').src = src;
    document.getElementById('imageViewerModal').style.display = 'flex';
}
function closeImageViewer() { document.getElementById('imageViewerModal').style.display = 'none'; }

function openAlert(title, message, type = 'success') {
    document.getElementById('alertTitle').innerText = title; document.getElementById('alertMessage').innerText = message;
    const icon = document.getElementById('alertIcon');
    if(type === 'error') { icon.style.color = '#ef4444'; icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>'; } 
    else { icon.style.color = '#10b981'; icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; }
    document.getElementById('universalAlertModal').style.display = 'flex';
}
function closeAlert() { document.getElementById('universalAlertModal').style.display = 'none'; }

async function initPlayer() {
    try {
        await fetch(`/api/videos/${videoId}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: activeUser })
        });

        const res = await fetch('/api/videos');
        const data = await res.json();
        
        if(data.success) {
            const video = data.videos.find(v => v.videoId === videoId);
            if(video) {
                ownerName = video.uploader || 'Hệ Thống';
                document.getElementById('videoTitle').innerText = video.title || 'Video chưa đặt tên';
                
                const isBoss = (ownerName.toLowerCase() === 'lam');
                document.getElementById('uploaderName').innerHTML = `${ownerName} ${isBoss ? '<i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 12px;"></i>' : ''}`;
                
                document.getElementById('uploaderAvatar').src = getAvatarUrl(ownerName);
                
                const viewCount = Array.isArray(video.views) ? video.views.length : 0;
                const timeString = timeAgo(video.createdAt);
                document.getElementById('viewCount').innerText = `${viewCount} lượt xem độc nhất • Tải lên: ${timeString}`;

                const isLiked = Array.isArray(video.likes) && video.likes.includes(activeUser);
                const btn = document.getElementById('likeButton');
                const icon = document.getElementById('likeIcon');
                const textEl = document.getElementById('likeText');

                if(isLiked) {
                    btn.classList.add('liked');
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                    icon.style.color = '#ef4444';
                    textEl.innerText = 'Đã thích';
                }
            } else {
                document.getElementById('videoTitle').innerText = "Video không tồn tại hoặc đã bị xóa";
            }
        }
        renderChatBox();
    } catch (error) { console.error("Lỗi lấy thông tin video: ", error); }
}

async function toggleLike() {
    const btn = document.getElementById('likeButton');
    const icon = document.getElementById('likeIcon');
    const textEl = document.getElementById('likeText');
    
    try {
        const res = await fetch(`/api/videos/${videoId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: activeUser })
        });
        const data = await res.json();
        
        if(data.success) {
            if(data.isLiked) {
                btn.classList.add('liked');
                icon.classList.remove('fa-regular');
                icon.classList.add('fa-solid');
                icon.style.color = '#ef4444';
                textEl.innerText = 'Đã thích';
                
                for(let i=0; i<4; i++) {
                    setTimeout(() => spawnDanmakuText(`❤️ ${activeUser} thả tim! ❤️`, '#ef4444'), i*400);
                }
                saveAndDisplayMessage(activeUser, 'Vừa thả tim (Like) video này! Đỉnh quá! ❤️🔥');
            } else {
                btn.classList.remove('liked');
                icon.classList.remove('fa-solid');
                icon.classList.add('fa-regular');
                icon.style.color = '#f43f5e';
                textEl.innerText = 'Thích';
            }
        }
    } catch(e) { console.error("Lỗi khi tương tác nút Like", e); }
}

const chunksGrid = document.getElementById('chunksGrid');
if (chunksGrid) {
    for(let i=0; i<30; i++) {
        let chunk = document.createElement('div');
        chunk.className = 'chunk-block';
        chunk.id = 'chunk-' + i;
        chunksGrid.appendChild(chunk);
    }
}

const videoElement = document.getElementById('videoPlayer');
const localVideoSrc = `/videos/${videoId}/main.m3u8`; 
const demoHlsSrc = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

if (videoElement) {
    videoElement.poster = `/videos/${videoId}/thumbnail.jpg`;

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(localVideoSrc);
        hls.attachMedia(videoElement);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            addTerminalLog(`<span style="color:#10b981;">[Hệ Thống] Kết nối video cục bộ thành công!</span>`);
        });

        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                addTerminalLog(`<span style="color:#ef4444;">[Cảnh báo] Không tìm thấy luồng HLS nội bộ. Tự động chuyển sang Luồng Dự Phòng (Demo Stream)...</span>`);
                hls.loadSource(demoHlsSrc);
                hls.attachMedia(videoElement);
            }
        });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        videoElement.src = localVideoSrc;
        videoElement.onerror = () => { videoElement.src = demoHlsSrc; };
    }
}

const chatBox = document.getElementById('liveChatBox');

async function renderChatBox() {
    if (!chatBox) return;
    chatBox.innerHTML = ''; 
    try {
        const res = await fetch('/api/chat/' + videoId);
        const data = await res.json();
        
        if(data.success && data.chats) {
            data.chats.forEach(chat => {
                appendChatMessageToDOM(chat.user, chat.text, chat._id);
            });
        }
    } catch(error) { console.error("Lỗi lấy dữ liệu chat:", error); }
}

function appendChatMessageToDOM(user, text, chatId = null, isSystem = false, isError = false) {
    if (!chatBox) return;
    const msgEl = document.createElement('div');
    if(chatId) msgEl.id = 'chat-' + chatId; 
    
    if (isSystem) {
        msgEl.className = `sys-message ${isError ? 'err' : ''}`;
        msgEl.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-bell'}"></i> ${text}`;
    } else {
        msgEl.className = 'chat-message';
        const avatar = getAvatarUrl(user);
        
        let deleteHtml = '';
        if (user === activeUser || role === 'superadmin' || role === 'admin') {
            deleteHtml = `<button class="chat-delete-btn" onclick="deleteMessage('${chatId}')" title="Xóa bình luận"><i class="fa-solid fa-trash-can"></i></button>`;
        }

        msgEl.innerHTML = `
            <img src="${avatar}" class="chat-avatar" alt="Avatar" onclick="openUserProfile('${user}')" onerror="this.src='https://ui-avatars.com/api/?name=User&background=1e293b&color=fff'">
            <div class="chat-content-bubble">
                <div class="chat-header-row">
                    <div class="chat-username" onclick="openUserProfile('${user}')">${user}</div>
                    ${deleteHtml}
                </div>
                <div class="chat-text">${text}</div>
            </div>
        `;
    }
    
    chatBox.appendChild(msgEl);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function deleteMessage(chatId) {
    openConfirm('deleteChatMessage', chatId, 'Xóa bình luận', 'Bạn có chắc chắn muốn xóa vĩnh viễn bình luận này không?');
}

socket.on('receive_chat_realtime', (data) => {
    appendChatMessageToDOM(data.user, data.text, data.chatId);
    
    if (data.user !== activeUser) {
        spawnDanmakuText(`${data.user}: ${data.text}`, '#fcd34d');
    }
});

socket.on('remove_chat_ui', (chatId) => {
    const el = document.getElementById('chat-' + chatId);
    if (el) el.remove();
});

const danmakuStage = document.getElementById('danmakuStage');
function spawnDanmakuText(text, color = '#fff') {
    if (!danmakuStage) return;
    const el = document.createElement('div');
    el.className = 'danmaku-text';
    el.innerText = text;
    el.style.color = color;
    el.style.top = (Math.random() * 75 + 5) + '%';
    danmakuStage.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

async function saveAndDisplayMessage(user, text) {
    try {
        const res = await fetch('/api/chat/' + videoId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, text })
        });
        const data = await res.json();
        
        if(data.success) {
            socket.emit('send_chat_realtime', {
                videoId: videoId,
                user: user,
                text: text,
                chatId: data.chat._id
            });
        }
    } catch(error) { console.error("Lỗi gửi tin nhắn:", error); }
}

function sendReaction(emoji) {
    spawnDanmakuText(`${activeUser}: ${emoji}`, '#fff'); 
    saveAndDisplayMessage(activeUser, `Đã thả cảm xúc: ${emoji}`);
    addTerminalLog(`[Danmaku] Bạn thả cảm xúc: ${emoji}`);
}

function sendCustomDanmaku(e) {
    e.preventDefault();
    const input = document.getElementById('danmakuInput');
    const text = input.value.trim();
    if(!text) return;
    
    spawnDanmakuText(`${activeUser}: ${text}`, '#fcd34d'); 
    saveAndDisplayMessage(activeUser, text);
    addTerminalLog(`[Danmaku] Đã gửi: "${text}"`);
    input.value = '';
}

let inCinemaRoom = false;
let currentRoomCode = '';
let isRemoteAction = false; 

function toggleCinemaRoom() {
    const btn = document.getElementById('btnCreateRoom');
    const badge = document.getElementById('syncStatusBadge');
    const display = document.getElementById('roomCodeDisplay');

    if(!inCinemaRoom) {
        inCinemaRoom = true;
        btn.innerHTML = `<i class="fa-solid fa-rectangle-xmark"></i> Hủy phòng chiếu`;
        btn.style.background = 'var(--accent-danger)';
        badge.innerText = "Đang đồng bộ WebSockets";
        badge.style.background = 'var(--accent-green)';
        
        currentRoomCode = `ROOM-${Math.floor(Math.random()*8999)+1000}`;
        display.innerText = `MÃ PHÒNG: ${currentRoomCode}`;
        
        socket.emit('join_sync_room', currentRoomCode); 

        addTerminalLog(`[Sync Room] Tạo phòng thành công.`);
        appendChatMessageToDOM('Hệ Thống', `Đã mở phòng chiếu chung ${currentRoomCode}. Bạn đã vào kênh đồng bộ Socket.`, null, true);
    } else {
        inCinemaRoom = false;
        btn.innerHTML = `<i class="fa-solid fa-circle-plus"></i> Khởi tạo phòng chiếu chung`;
        btn.style.background = 'var(--accent-purple)';
        badge.innerText = "Chế độ đơn lẻ";
        badge.style.background = 'var(--accent-purple)';
        display.innerText = "";
        
        socket.emit('leave_sync_room', currentRoomCode);
        currentRoomCode = '';
        
        addTerminalLog(`[Sync Room] Đã đóng phòng. Ngắt kết nối đồng bộ.`);
        appendChatMessageToDOM('Hệ Thống', `Đã giải tán phòng chiếu chung. Trở về chế độ xem cá nhân.`, null, true, true);
    }
}

socket.on('room_notification', (msg) => {
    if(inCinemaRoom) {
        appendChatMessageToDOM('Hệ Thống', msg, null, true);
        addTerminalLog(`[Sync Room] ${msg}`);
    }
});

if (videoElement) {
    videoElement.addEventListener('play', () => {
        if(inCinemaRoom && !isRemoteAction) {
            socket.emit('video_action', { roomCode: currentRoomCode, action: 'play', time: videoElement.currentTime });
            addTerminalLog(`[Sync Room] TRUYỀN: Gửi lệnh Phát Video`);
        }
        isRemoteAction = false;
    });
    
    videoElement.addEventListener('pause', () => {
        if(inCinemaRoom && !isRemoteAction) {
            socket.emit('video_action', { roomCode: currentRoomCode, action: 'pause', time: videoElement.currentTime });
            addTerminalLog(`[Sync Room] TRUYỀN: Gửi lệnh Tạm Dừng`);
        }
        isRemoteAction = false;
    });
}

socket.on('sync_video_action', (data) => {
    if(inCinemaRoom && videoElement) {
        isRemoteAction = true; 
        
        if(Math.abs(videoElement.currentTime - data.time) > 1) {
            videoElement.currentTime = data.time;
        }

        if(data.action === 'play') {
            videoElement.play();
            spawnDanmakuText(`[Socket] Giám khảo đã bấm Phát`, '#10b981');
        } else if(data.action === 'pause') {
            videoElement.pause();
            spawnDanmakuText(`[Socket] Giám khảo đã bấm Dừng`, '#ef4444');
        }
    }
});

const terminalLog = document.getElementById('terminalLog');
function addTerminalLog(message) {
    if(role === 'user' || !terminalLog) return; 
    const time = new Date().toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.innerHTML = `<span style="color:#64748b;">[${time}]</span> ${message}`;
    terminalLog.appendChild(line);
    terminalLog.scrollTop = terminalLog.scrollHeight;
}

function startAdvancedSimulations() {
    if(role === 'user') return;
    let chunkCount = 0;
    
    setInterval(() => {
        if(chunkCount >= 30) return;
        
        const randNet = Math.random();
        const aiTitle = document.getElementById('aiDecisionTitle');
        const aiDesc = document.getElementById('aiDecisionDesc');
        const aiIndicator = document.querySelector('.ai-status-indicator');
        if (!aiTitle) return;
        
        let currentChunkSrc = "Server";

        if (randNet > 0.65) {
            aiTitle.innerText = "AI: Phát hiện mạng Client sụt giảm";
            aiDesc.innerText = "Tự động hạ luồng pre-fetch xuống 720p để tránh đứng hình...";
            aiDesc.style.color = "#f59e0b";
            aiIndicator.style.borderColor = "rgba(245, 158, 11, 0.3)";
            addTerminalLog(`<span style="color:#eab308;">[AI] Cảnh báo nghẽn mạng! Chuyển phân đoạn ${chunkCount} sang chuẩn nén thấp.</span>`);
            
            document.getElementById('serverLoadText').innerText = `${Math.floor(Math.random()*200)+300} KB/s`;
            document.getElementById('p2pLoadText').innerText = "0 KB/s";
            document.getElementById('peerNode').classList.remove('active');
        } else if(randNet > 0.2) {
            aiTitle.innerText = "AI: Mạng ổn định • Mesh CDN Active";
            aiDesc.innerText = "Đang chia sẻ tệp cho Node Peer B qua mạng ngang hàng...";
            aiDesc.style.color = "#10b981";
            aiIndicator.style.borderColor = "rgba(16, 185, 129, 0.3)";
            
            currentChunkSrc = "Mesh Peer";
            document.getElementById('serverLoadText').innerText = "45 KB/s (Metadata)";
            document.getElementById('p2pLoadText').innerText = "1.4 MB/s";
            document.getElementById('peerNode').classList.add('active');
            
            addTerminalLog(`<span style="color:#10b981;">[P2P] Chuyển main${chunkCount}.ts cho Peer B thành công. Cứu 95% băng thông.</span>`);
        } else {
            aiTitle.innerText = "AI: Băng thông lý tưởng (Mạng Fiber)";
            aiDesc.innerText = "Đang kéo luồng 1080p Ultra-HD từ Máy chủ gốc...";
            aiDesc.style.color = "#3b82f6";
            aiIndicator.style.borderColor = "rgba(59, 130, 246, 0.3)";
            
            document.getElementById('serverLoadText').innerText = "2.8 MB/s";
            document.getElementById('p2pLoadText').innerText = "0 KB/s";
            document.getElementById('peerNode').classList.remove('active');
        }

        const chunkEl = document.getElementById('chunk-' + chunkCount);
        if (chunkEl) chunkEl.classList.add('loaded');
        chunkCount++;
    }, 3000); 
}

// HÀM MỚI ĐỂ HIỆN SỐ ĐỎ KHI CÓ TIN NHẮN
function updateMsgBadge() {
    const badge = document.getElementById('msgBadge');
    if(!badge) return;
    let unread = parseInt(localStorage.getItem('streamVibeUnreadMsg_' + activeUser) || '0');
    if(unread > 0) {
        badge.style.display = 'block'; // Đổi ở đây
        badge.innerText = unread;
    } else {
        badge.style.display = 'none';
    }
}

// FIX: Hiện số đỏ cho Private Message kể cả ở trong file Video Player
socket.on('receive_private_message', (data) => {
    const activeTab = localStorage.getItem('streamVibeActiveTab');
    if (data.receiver === activeUser && (activeTab !== 'privateMessages' || currentChatTarget !== data.sender)) {
        let unread = parseInt(localStorage.getItem('streamVibeUnreadMsg_' + activeUser) || '0');
        unread++;
        localStorage.setItem('streamVibeUnreadMsg_' + activeUser, unread);
        updateMsgBadge();
        
        // Hiện popup xanh báo luôn cho dễ thấy!
        openAlert("Tin nhắn riêng", `Bạn có tin nhắn mới từ ${data.sender}!`, "success");
    }
});

window.onload = () => {
    fetch('/api/users').then(res => res.json()).then(data => { if(data.success) window.allUsersDB = data.users; });

    addTerminalLog("Hệ thống StreamVibe đã sẵn sàng.");
    startAdvancedSimulations();
    
    initPlayer();
    updateMsgBadge(); // <--- ĐẢM BẢO CHẠY UPDATE LÚC MỞ TRANG XEM PHIM
    
    appendChatMessageToDOM('Hệ Thống', `Chào mừng ${activeUser} đến với StreamVibe. Bạn có thể bình luận ở đây nhé!`, null, true);
};

async function loadNotifications() {
    const container = document.getElementById('notiContainer');
    const badge = document.getElementById('notiBadge');
    
    try {
        const resNotis = await fetch('/api/notifications');
        const dataNotis = await resNotis.json();
        
        const resVideos = await fetch('/api/videos');
        const dataVideos = await resVideos.json();
        
        if (dataNotis.success && dataVideos.success) {
            const activeUser = localStorage.getItem('streamVibeActiveUser');
            let readNotis = JSON.parse(localStorage.getItem('streamVibeReadNotis_' + activeUser)) || [];
            
            const myVideoIds = dataVideos.videos
                .filter(v => v.uploader === activeUser)
                .map(v => v.videoId);
            
            const validNotis = dataNotis.notis.filter(n => 
                n.user !== activeUser && myVideoIds.includes(n.videoId)
            );
            
            let unreadCount = validNotis.filter(n => !readNotis.includes(n.id)).length;
            
            if(unreadCount > 0) {
                if(badge) badge.style.display = 'block';
                if(badge) badge.innerText = unreadCount;
            } else {
                if(badge) badge.style.display = 'none';
            }

            if(validNotis.length === 0) {
                if(container) container.innerHTML = '<p style="color: var(--text-secondary); padding: 15px;">Chưa có bình luận nào trên các video của bạn.</p>';
                return;
            }

            if(container) container.innerHTML = '';
            validNotis.forEach((noti) => {
                const isRead = readNotis.includes(noti.id);
                const el = document.createElement('div');
                el.className = `noti-item ${isRead ? '' : 'unread'}`;
                el.onclick = () => {
                    if(!isRead) {
                        readNotis.push(noti.id);
                        localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(readNotis));
                    }
                    window.location.href = '/player.html?id=' + noti.videoId;
                };

                const videoTitle = dataVideos.videos.find(v => v.videoId === noti.videoId)?.title || 'Video của bạn';

                el.innerHTML = `
                    <img src="${getAvatarUrl(noti.user)}" class="noti-avatar" onerror="this.src='https://ui-avatars.com/api/?name=User&background=1e293b&color=fff'">
                    <div class="noti-info">
                        <div class="noti-time">${timeAgo(noti.createdAt)} <span style="color:#94a3b8; font-weight:500;">• Tại video: ${videoTitle}</span></div>
                        <div class="noti-text"><b>${noti.user}</b> đã bình luận: "${noti.text}"</div>
                    </div>
                `;
                container.appendChild(el);
            });
        }
    } catch(err) {
        if(container) container.innerHTML = '<p style="color: #ef4444; padding:15px;">Lỗi tải thông báo.</p>';
    }
}

function clearNotifications() {
    const activeUser = localStorage.getItem('streamVibeActiveUser');
    fetch('/api/notifications').then(r=>r.json()).then(d => {
        if(d.success) {
            const allIds = d.notis.map(n => n.id);
            localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(allIds));
            loadNotifications();
        }
    });
}