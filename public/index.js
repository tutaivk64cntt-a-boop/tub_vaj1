const socket = io(); 

let pendingAction = null; 
let pendingData = null;
window.allUsersDB = [];
let currentShareLinkGlobal = ""; 
let currentProfileView = '';
let currentChatTarget = null;

const activeUser = localStorage.getItem('streamVibeActiveUser');

if (activeUser) {
    socket.emit('join_user_channel', activeUser);
}
socket.on('connect', () => {
    if (activeUser) {
        socket.emit('join_user_channel', activeUser);
    }
});

function openMobileSidebar() {
    document.querySelector('.sidebar').classList.add('active');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function closeMobileSidebar() {
    document.querySelector('.sidebar').classList.remove('active');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function getAvatarUrl(username) {
    let avatars = JSON.parse(localStorage.getItem('streamVibeAvatars')) || {};
    if (avatars[username]) {
        return avatars[username];
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1e293b&color=fff&size=128`;
}

function changeAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            let avatars = JSON.parse(localStorage.getItem('streamVibeAvatars')) || {};
            avatars[activeUser] = base64Image;
            localStorage.setItem('streamVibeAvatars', JSON.stringify(avatars));
            
            document.getElementById('profileEditAvatar').src = base64Image;
            updateProfileUI(activeUser);
            loadVideoLists(); 
            openAlert("Thành công", "Đã cập nhật ảnh đại diện mới!", "success");
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// ==========================================
// TÍNH NĂNG PROFILE, THEO DÕI VÀ NHẮN TIN
// ==========================================

async function openUserProfile(username) {
    currentProfileView = username;
    document.getElementById('viewProfileAvatar').src = getAvatarUrl(username);
    document.getElementById('viewProfileName').innerHTML = `${username} ${username.toLowerCase() === 'lam' ? '<i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 14px;"></i>' : ''}`;
    
    let userRole = getUserRole(username);
    let roleStr = "Thành viên hệ thống";
    let roleColor = "var(--text-secondary)";
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
    if (roleEl) {
        roleEl.innerText = roleStr;
        roleEl.style.color = roleColor;
        roleEl.style.background = bgRoleColor;
        
        // Ẩn mác nếu là người dùng bình thường
        if (userRole === 'user') {
            roleEl.style.display = 'none';
        } else {
            roleEl.style.display = 'inline-block';
        }
    }
    const btnFollow = document.getElementById('btnFollowUser');
    const btnMsg = document.getElementById('btnMessageUser');
    
    if (username === activeUser) {
        btnFollow.style.display = 'none'; 
        btnMsg.style.display = 'none';
    } else {
        btnFollow.style.display = 'inline-flex'; 
        btnMsg.style.display = 'inline-flex';
    }

    const videoGrid = document.getElementById('profileVideoGrid');
    videoGrid.innerHTML = '<p style="color:var(--text-secondary); font-size: 15px; padding: 10px;">Đang tải dữ liệu...</p>';
    document.getElementById('profileVideoCount').innerText = '0';
    document.getElementById('profileFollowerCount').innerText = '0';

    document.getElementById('userProfileModal').style.display = 'flex';

    try {
        const res = await fetch(`/api/users/${username}/profile?viewer=${activeUser}`);
        const data = await res.json();
        
        if (data.success) {
            document.getElementById('profileFollowerCount').innerText = data.followerCount;
            if (data.isFollowing) {
                btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Đang theo dõi`;
                btnFollow.style.background = 'rgba(255,255,255,0.1)';
            } else {
                btnFollow.innerHTML = `<i class="fa-solid fa-user-plus"></i> Theo dõi`;
                btnFollow.style.background = 'var(--accent-primary)';
            }

            document.getElementById('profileVideoCount').innerText = data.videos.length;
            if (data.videos.length === 0) {
                videoGrid.innerHTML = '<p style="color:var(--text-secondary); font-size: 14px; grid-column: 1/-1; text-align: center; padding: 20px;">Người dùng này chưa tải lên video nào.</p>';
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
                    card.onmouseout = () => { card.style.borderColor = 'rgba(255,255,255,0.05)'; card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none';};
                    card.onclick = () => { window.location.href = '/player.html?id=' + id; };
                    
                    card.innerHTML = `
                        <div style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: ${thumbBg}; margin-bottom: 12px;"></div>
                        <div style="font-size: 15px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;"><i class="fa-solid fa-eye"></i> ${views} lượt xem</div>
                    `;
                    videoGrid.appendChild(card);
                });
            }
        }
    } catch (err) {}
}

function closeUserProfile() { 
    document.getElementById('userProfileModal').style.display = 'none'; 
}

async function toggleFollow() {
    try {
        const res = await fetch(`/api/users/${currentProfileView}/follow`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUser: activeUser })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('profileFollowerCount').innerText = data.followerCount;
            const btnFollow = document.getElementById('btnFollowUser');
            if (data.isFollowing) {
                btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Đang theo dõi`;
                btnFollow.style.background = 'rgba(255,255,255,0.1)';
            } else {
                btnFollow.innerHTML = `<i class="fa-solid fa-user-plus"></i> Theo dõi`;
                btnFollow.style.background = 'var(--accent-primary)';
            }
        }
    } catch(e) {}
}

function openPrivateChatFromProfile() {
    closeUserProfile();
    document.querySelector('.menu-item[data-tab="privateMessages"]').click();
    openChatWithUser(currentProfileView);
}

document.querySelectorAll('.menu-item').forEach(item => { 
    item.addEventListener('click', () => { 
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active')); item.classList.add('active'); 
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active')); 
        const targetId = item.getAttribute('data-tab');
        document.getElementById(targetId).classList.add('active'); 
        
        if (targetId === 'privateMessages') {
            loadContacts();
        }
        if (targetId === 'statistics') loadStatistics();
        if (targetId === 'settings') closeSettingPanel();
        
        localStorage.setItem('streamVibeActiveTab', targetId);
        if(window.innerWidth <= 768) closeMobileSidebar();
    }); 
});

// LOGIC HOÀN TOÀN MỚI: Quét từng người nhắn tin để hiển thị số đỏ chuẩn xác!
async function loadContacts() {
    const list = document.getElementById('contactList');
    const badge = document.getElementById('msgBadge');
    
    try {
        const res = await fetch(`/api/messages/contacts/${activeUser}`);
        const data = await res.json();
        if(data.success && data.contacts.length > 0) {
            list.innerHTML = '';
            
            let localReadData = JSON.parse(localStorage.getItem('sv_read_counts_' + activeUser)) || {};
            let totalUnread = 0;
            
            for(let contact of data.contacts) {
                const isActive = (contact === currentChatTarget) ? 'active' : '';
                let unreadBadgeHtml = '';
                
                // Fetch tin nhắn để so sánh xem có bao nhiêu tin chưa đọc
                const msgRes = await fetch(`/api/messages/${activeUser}/${contact}`);
                const msgData = await msgRes.json();
                if(msgData.success) {
                    let receivedMsgs = msgData.messages.filter(m => m.sender === contact).length;
                    let readCount = localReadData[contact] || 0;
                    let unread = receivedMsgs - readCount;
                    
                    if (unread > 0) {
                        totalUnread += unread;
                        unreadBadgeHtml = `<span style="margin-left: auto; background: #ef4444; color: white; padding: 2px 6px; border-radius: 10px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.5);">${unread}</span>`;
                    }
                }
                
                list.innerHTML += `<div class="contact-item ${isActive}" onclick="openChatWithUser('${contact}')"><img src="${getAvatarUrl(contact)}" class="contact-avatar"><div class="contact-name">${contact}</div>${unreadBadgeHtml}</div>`;
            }
            
            // Cập nhật số tổng ở thẻ Menu bên trái
            if(badge) {
                if(totalUnread > 0) {
                    badge.style.display = 'inline-block';
                    badge.innerText = totalUnread;
                } else {
                    badge.style.display = 'none';
                }
            }
        } else {
            if(badge) badge.style.display = 'none';
        }
    } catch(e) {}
}

async function openChatWithUser(username) {
    currentChatTarget = username;
    document.getElementById('chatEmptyState').style.display = 'none'; 
    document.getElementById('chatMainArea').style.display = 'flex';
    document.getElementById('currentChatName').innerText = username; 
    document.getElementById('currentChatAvatar').src = getAvatarUrl(username);
    
    const historyBox = document.getElementById('privateChatHistory');
    historyBox.innerHTML = '<p style="text-align:center; color:gray;">Đang tải...</p>';
    try {
        const res = await fetch(`/api/messages/${activeUser}/${username}`);
        const data = await res.json();
        if(data.success) {
            historyBox.innerHTML = '';
            data.messages.forEach(msg => appendPrivateMessageUI(msg.sender, msg.message));
            
            // ĐÁNH DẤU LÀ ĐÃ ĐỌC TOÀN BỘ TIN NHẮN CỦA NGƯỜI NÀY
            let receivedMsgs = data.messages.filter(m => m.sender === username).length;
            let localReadData = JSON.parse(localStorage.getItem('sv_read_counts_' + activeUser)) || {};
            localReadData[username] = receivedMsgs;
            localStorage.setItem('sv_read_counts_' + activeUser, JSON.stringify(localReadData));
            
            loadContacts(); // Refresh lại danh sách để xóa số đỏ
        }
    } catch(e){}
}

function appendPrivateMessageUI(sender, text) {
    const historyBox = document.getElementById('privateChatHistory');
    const isMine = (sender === activeUser);
    const bubbleClass = isMine ? 'msg-mine' : 'msg-theirs';
    historyBox.innerHTML += `<div class="msg-bubble ${bubbleClass}">${text}</div>`;
    historyBox.scrollTop = historyBox.scrollHeight;
}

async function sendPrivateMessage(e) {
    e.preventDefault();
    const input = document.getElementById('privateMsgInput'); 
    const text = input.value.trim();
    if(!text || !currentChatTarget) return;

    appendPrivateMessageUI(activeUser, text); 
    input.value = '';

    try {
        const res = await fetch('/api/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: activeUser, receiver: currentChatTarget, message: text })
        });
        const data = await res.json();
        if(data.success) {
            socket.emit('send_private_message', { sender: activeUser, receiver: currentChatTarget, message: text });
        }
    } catch(err) {}
}

socket.on('receive_private_message', (data) => {
    // Nếu đang mở đúng đoạn chat với người đó thì hiện tin nhắn ngay lập tức
    if ((data.sender === currentChatTarget && data.receiver === activeUser) || (data.sender === activeUser && data.receiver === currentChatTarget)) {
        if(data.sender !== activeUser) appendPrivateMessageUI(data.sender, data.message);
    }

    // Xử lý thông báo số đỏ
    if (data.receiver === activeUser) {
        const activeTab = localStorage.getItem('streamVibeActiveTab');
        if (activeTab === 'privateMessages' && currentChatTarget === data.sender) {
            // Nếu đang mở khung chat của họ -> Đánh dấu là đã đọc luôn
            let localReadData = JSON.parse(localStorage.getItem('sv_read_counts_' + activeUser)) || {};
            localReadData[data.sender] = (localReadData[data.sender] || 0) + 1;
            localStorage.setItem('sv_read_counts_' + activeUser, JSON.stringify(localReadData));
        } else {
            // Nếu đang ở tab khác hoặc chat với người khác -> Hiện Popup xanh báo có tin
            openAlert("Tin nhắn riêng", `Bạn có tin nhắn mới từ ${data.sender}!`, "success");
        }
    }
    
    loadContacts(); // Luôn chạy lại hàm này để nó tự tính toán và cập nhật số đỏ hoàn hảo!
});

// ==========================================
// CÁC HÀM TIỆN ÍCH VÀ QUẢN LÝ TÀI KHOẢN
// ==========================================

function openAlert(title, message, type = 'success') {
    document.getElementById('alertTitle').innerText = title; document.getElementById('alertMessage').innerText = message;
    const icon = document.getElementById('alertIcon');
    if(type === 'error') { icon.style.color = '#ef4444'; icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>'; } 
    else { icon.style.color = '#10b981'; icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; }
    document.getElementById('universalAlertModal').style.display = 'flex';
}

function closeAlert() { document.getElementById('universalAlertModal').style.display = 'none'; }

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
    if (pendingAction === 'logout') { 
        localStorage.removeItem('streamVibeActiveUser'); 
        localStorage.removeItem('streamVibeActiveRole');
        window.location.reload(); 
    } 
    else if (pendingAction === 'deleteUser') {
        fetch('/api/users/' + pendingData, { method: 'DELETE' }).then(res => res.json()).then(data => {
            if(data.success) {
                loadUsersList();
                document.getElementById('userSearchInput').value = ''; 
                if(localStorage.getItem('streamVibeActiveUser') === pendingData) { 
                    localStorage.removeItem('streamVibeActiveUser'); 
                    localStorage.removeItem('streamVibeActiveRole');
                    window.location.reload(); 
                } else { openAlert("Thành công", `Đã xóa tài khoản.`); }
            }
        });
    } 
    else if (pendingAction === 'deleteVideo') {
        fetch(`/delete-video/${pendingData}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
            if(data.success) { loadVideoLists(); openAlert("Đã xóa Video", "Phân đoạn HLS đã bị xóa."); } 
            else { openAlert("Lỗi", data.message, "error"); }
        });
    }
    closeConfirm();
}

function getUserRole(username) {
    if (!username) return 'user'; 
    if (username === localStorage.getItem('streamVibeActiveUser')) return localStorage.getItem('streamVibeActiveRole') || 'user';
    if (window.allUsersDB && window.allUsersDB.length > 0) {
        const found = window.allUsersDB.find(u => u.username === username);
        if (found) return found.role;
    }
    const name = username.toLowerCase();
    if (name === 'lam' || name === 'lâm' || name === 'boss') return 'superadmin';
    if (name === 'admin_thong ke'.toLowerCase()) return 'statadmin';
    if (name.includes('admin') || name.includes('quanly')) return 'admin';
    return 'user';
}

function openAddUserModal(role) {
    document.getElementById('newUserRole').value = role;
    if (role === 'admin') {
        document.getElementById('addUserTitle').innerText = "Thêm Quản Trị Viên";
        document.getElementById('adminTypeContainer').style.display = 'block';
    } else {
        document.getElementById('addUserTitle').innerText = "Thêm Khách";
        document.getElementById('adminTypeContainer').style.display = 'none';
    }
    document.getElementById('newUsernameInput').value = '';
    document.getElementById('newUserPasswordInput').value = '';
    document.getElementById('addUserModal').style.display = 'flex';
}

function closeAddUserModal() { document.getElementById('addUserModal').style.display = 'none'; }

async function submitNewUser(e) {
    e.preventDefault();
    const username = document.getElementById('newUsernameInput').value.trim();
    const password = document.getElementById('newUserPasswordInput').value;
    let role = document.getElementById('newUserRole').value;
    if (role === 'admin') role = document.getElementById('adminTypeSelect').value;
    
    try {
        const res = await fetch('/api/users/create', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, requester: activeUser })
        });
        const data = await res.json();
        if(data.success) { closeAddUserModal(); loadUsersList(); openAlert("Thành công", "Đã tạo tài khoản!"); } 
        else { openAlert("Lỗi bảo mật", data.message, "error"); }
    } catch(err) { openAlert("Lỗi", "Lỗi kết nối", "error"); }
}

function filterUsers() {
    let input = document.getElementById('userSearchInput').value.toLowerCase();
    let rows = document.querySelectorAll('.user-row');
    rows.forEach(row => { let name = row.querySelector('.username-cell').innerText.toLowerCase(); row.style.display = name.includes(input) ? '' : 'none'; });
}

function loadUsersList() {
    const superAdminTbody = document.getElementById('superAdminTableBody');
    const adminTbody = document.getElementById('adminTableBody'); 
    const userTbody = document.getElementById('userTableBody');
    const superAdminSection = document.getElementById('superAdminSection'); 
    const adminSection = document.getElementById('adminSection');
    if(!superAdminTbody) return;
    
    superAdminTbody.innerHTML = ''; adminTbody.innerHTML = ''; userTbody.innerHTML = '';
    fetch('/api/users').then(res => res.json()).then(data => {
        if (!data.success) return;
        window.allUsersDB = data.users; 
        const activeRole = getUserRole(activeUser);

        if (activeRole === 'superadmin') { 
            superAdminSection.style.display = 'block'; adminSection.style.display = 'block'; 
            if(document.getElementById('btnAddAdmin')) document.getElementById('btnAddAdmin').style.display = 'inline-flex';
        } else if (activeRole === 'admin') { 
            superAdminSection.style.display = 'none'; adminSection.style.display = 'block'; 
            if(document.getElementById('btnAddAdmin')) document.getElementById('btnAddAdmin').style.display = 'none';
        } else { 
            superAdminSection.style.display = 'none'; adminSection.style.display = 'none'; 
        } 

        let superAdminCount = 0; let adminCount = 0; let userCount = 0; let visibleCount = 0;
        
        data.users.forEach((userObj) => {
            const user = userObj.username; const targetRole = userObj.role;
            let canSee = false;
            if (activeRole === 'superadmin') canSee = true; 
            else if (activeRole === 'admin') { if (targetRole === 'user' || user === activeUser) canSee = true; }
            if (!canSee) return;
            visibleCount++; 
            const tr = document.createElement('tr'); tr.className = 'user-row'; 
            
            let actionHtml = '';
            if (user === activeUser) actionHtml = `<span style="color:var(--text-secondary);font-size:12px;"><i class="fa-solid fa-user-check" style="color:#10b981;"></i> Của bạn</span>`;
            else if (targetRole === 'superadmin') actionHtml = `<span style="color:var(--text-secondary);font-size:12px;"><i class="fa-solid fa-shield-halved" style="color:#f59e0b;"></i> Bất khả xâm phạm</span>`;
            else actionHtml = `<div style="display:flex;gap:8px;"><button class="btn-small" style="background:rgba(59,130,246,0.15);color:#93c5fd;" onclick="openUserProfile('${user}')"><i class="fa-solid fa-circle-info"></i> Xem</button><button class="btn-small" onclick="requestDeleteUser('${user}')"><i class="fa-solid fa-trash-can"></i> Xóa</button></div>`;

            let roleBadge = targetRole === 'admin' ? '<span style="color:#ef4444;font-size:10px;padding:2px 6px;margin-left:8px;background:rgba(239,68,68,0.1);">Q.Lý</span>' : (targetRole === 'statadmin' ? '<span style="color:#10b981;font-size:10px;padding:2px 6px;margin-left:8px;background:rgba(16,185,129,0.1);">T.Kê</span>' : '');
            let indexDisplay = targetRole === 'superadmin' ? '#' + (++superAdminCount) : (targetRole === 'admin' || targetRole === 'statadmin') ? '#' + (++adminCount) : '#' + (++userCount);
            
            tr.innerHTML = `<td>${indexDisplay}</td><td class="username-cell" style="color:#fff;font-weight:bold;">${user} ${roleBadge}</td><td style="color:#10b981;">**********</td><td>${actionHtml}</td>`;
            if (targetRole === 'superadmin') superAdminTbody.appendChild(tr); else if (targetRole === 'admin' || targetRole === 'statadmin') adminTbody.appendChild(tr); else userTbody.appendChild(tr);
        });
        document.getElementById('totalUsersCount').innerText = visibleCount + " tài khoản";
    });
}
function requestDeleteUser(user) { openConfirm('deleteUser', user, 'Xóa tài khoản', `Bạn muốn xóa tài khoản "${user}"?`); }

// ==========================================
// TÍNH NĂNG QUẢN LÝ VIDEO VÀ TẢI LÊN
// ==========================================

function toggleDropdown(id, event) {
    event.stopPropagation();
    const target = document.getElementById(`dropdown-${id}`); const isShown = target.classList.contains('show');
    document.querySelectorAll('.dropdown-content.show').forEach(m => m.classList.remove('show')); 
    if (!isShown) target.classList.add('show');
}
window.addEventListener('click', (e) => { if (!e.target.closest('.card-action-menu')) document.querySelectorAll('.dropdown-content.show').forEach(m => m.classList.remove('show')); });

function shareVideo(id, event) {
    if(event) event.stopPropagation();
    document.querySelectorAll('.dropdown-content.show').forEach(m => m.classList.remove('show'));
    currentShareLinkGlobal = window.location.origin + '/player.html?id=' + id;
    document.getElementById('shareLinkURLInput').value = currentShareLinkGlobal;
    document.getElementById('shareVideoModal').style.display = 'flex';
}
function copyShareLinkDirectly() {
    const input = document.getElementById('shareLinkURLInput'); input.select();
    navigator.clipboard.writeText(input.value).then(() => openAlert("Thành công!", "Đã copy link.", "success"));
}
function shareToApp(platform) {
    const encLink = encodeURIComponent(currentShareLinkGlobal); const text = encodeURIComponent("Xem video này trên StreamVibe nhé! 🚀");
    let url = "";
    switch(platform) {
        case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encLink}`; break;
        case 'messenger': url = `fb-messenger://share/?link=${encLink}`; if(!/Android|iPhone|iPad/i.test(navigator.userAgent)) url = `https://www.facebook.com/dialog/send?link=${encLink}&app_id=291667064273102&redirect_uri=${encLink}`; break;
        case 'zalo': url = `https://chat.zalo.me/?url=${encLink}`; break;
        case 'telegram': url = `https://t.me/share/url?url=${encLink}&text=${text}`; break;
        case 'gmail': url = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent("Chia sẻ Video")}&body=${encLink}`; break;
    }
    if(url) window.open(url, '_blank'); 
}

function openEditVideoModal(id, currentTitle, event) {
    event.stopPropagation(); document.getElementById(`dropdown-${id}`).classList.remove('show');
    document.getElementById('editVideoId').value = id; document.getElementById('editVideoTitleInput').value = currentTitle; document.getElementById('editVideoModal').style.display = 'flex';
}
async function submitEditVideo(event) {
    event.preventDefault(); const id = document.getElementById('editVideoId').value; const title = document.getElementById('editVideoTitleInput').value.trim();
    try {
        const res = await fetch(`/api/videos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
        const data = await res.json();
        if (data.success) { document.getElementById('editVideoModal').style.display = 'none'; loadVideoLists(); openAlert("Thành công", "Đã đổi tên!"); }
    } catch (e) { openAlert("Lỗi", "Lỗi mạng", "error"); }
}

function updateFfmpegCommand() { 
    const el = document.getElementById('ffmpegDynamicCode');
    if(el) el.innerHTML = `ffmpeg(videoPath)<br>&nbsp;&nbsp;.addOption('-profile:v', '${document.getElementById('paramProfile').value}')<br>&nbsp;&nbsp;.addOption('-hls_time', '${document.getElementById('paramTime').value}')<br>&nbsp;&nbsp;.output(outputPlaylist)`; 
}
if(document.getElementById('ffmpegDynamicCode')) updateFfmpegCommand();

function runHlsInspector(id) { 
    const r = document.getElementById('inspectResultArea');
    if(!id) return r.style.display = 'none'; 
    r.style.display = 'block'; document.getElementById('manifestOutput').innerHTML = `#EXTM3U<br>#EXT-X-VERSION:3<br>#EXTINF:10.000000,<br>/videos/${id}/main0.ts<br>#EXT-X-ENDLIST`;
}

function prepareUpload() { document.getElementById('uploaderInput').value = activeUser || 'Khách Vô Danh'; }
function updateFileName(input) { 
    if(input.files.length > 0) { 
        document.getElementById('fileNameText').innerText = input.files[0].name; 
        document.getElementById('fileNameText').style.color = "#60a5fa"; 
        let titleInput = document.getElementById('videoTitleInput');
        if(titleInput.value.trim() === '') titleInput.value = input.files[0].name.replace(/\.[^/.]+$/, "");
    } 
}
function showLoading() { 
    document.getElementById('loadingOverlay').style.display = 'flex'; let progress = 0;
    const bar = document.getElementById('uploadProgressBar'); const text = document.getElementById('uploadProgressText'); const loadingText = document.getElementById('loadingText');
    setInterval(() => {
        if (progress < 40) { progress += 4; loadingText.innerText = "ĐANG TẢI LÊN MÁY CHỦ..."; } 
        else if (progress < 85) { progress += 2; loadingText.innerText = "ĐANG BĂM HLS..."; } 
        else if (progress < 98) { progress += 1; loadingText.innerText = "ĐANG TẠO ẢNH BÌA..."; }
        if (progress > 99) progress = 99; bar.style.width = progress + '%'; text.innerText = progress + '%';
    }, 400);
}

function watchVideo(id) { window.location.href = '/player.html?id=' + id; }

async function loadVideoLists() {
    const myGrid = document.getElementById('myVideoGrid'); const publicGrid = document.getElementById('publicVideoGrid'); 
    const inspectSelector = document.getElementById('inspectSelector');
    if(myGrid) myGrid.innerHTML = '<p style="color:var(--text-secondary);">Đang tải...</p>';
    if(publicGrid) publicGrid.innerHTML = '<p style="color:var(--text-secondary);">Đang tải...</p>';
    if(inspectSelector) inspectSelector.innerHTML = '<option value="">-- Chọn Node Video --</option>';
    try {
        const res = await fetch('/api/videos'); const data = await res.json();
        if (data.success) {
            if(myGrid) myGrid.innerHTML = ''; if(publicGrid) publicGrid.innerHTML = '';
            const activeRole = getUserRole(activeUser);
            const myVideos = data.videos.filter(v => v.uploader === activeUser); 
            
            if(document.getElementById('workspaceMyVideoCount')) document.getElementById('workspaceMyVideoCount').innerText = myVideos.length;
            
            if (myVideos.length === 0 && myGrid) myGrid.innerHTML = "<p style='color:var(--text-secondary);'>Chưa có video.</p>";
            else if(myGrid) {
                myVideos.forEach((v, i) => {
                    myGrid.appendChild(createVideoCard(v, activeUser, activeRole, true, false)); 
                    if(inspectSelector) { const opt = document.createElement('option'); opt.value = v.videoId; opt.innerText = `Node #${i+1}`; inspectSelector.appendChild(opt); }
                });
            }

            if (data.videos.length === 0 && publicGrid) publicGrid.innerHTML = "<p style='color:var(--text-secondary);'>Trống.</p>";
            else if(publicGrid) {
                data.videos.forEach(v => {
                    const canDel = (v.uploader === activeUser || activeRole === 'superadmin');
                    publicGrid.appendChild(createVideoCard(v, activeUser, activeRole, canDel, true)); 
                });
            }
        }
    } catch (err) {}
}

function timeAgo(dateString) {
    if (!dateString) return "Vừa xong";
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    let i = Math.floor(seconds / 31536000); if (i > 1) return i + " năm trước";
    i = Math.floor(seconds / 2592000); if (i > 1) return i + " tháng trước";
    i = Math.floor(seconds / 86400); if (i >= 1) return i + " ngày trước";
    i = Math.floor(seconds / 3600); if (i >= 1) return i + " giờ trước";
    i = Math.floor(seconds / 60); if (i >= 1) return i + " phút trước";
    return "Vừa xong";
}

function createVideoCard(video, activeUser, activeRole, canDelete, showBadge = false) {
    const id = video.videoId; const ownerName = video.uploader; const safeTitle = (video.title||'').replace(/'/g, "\\'"); 
    const viewCount = Array.isArray(video.views) ? video.views.length : 0;
    const likeCount = video.likesCount !== undefined ? video.likesCount : (Array.isArray(video.likes) ? video.likes.length : 0);
    const card = document.createElement('div'); card.className = 'video-card glass-card';
    
    let menuHtml = canDelete ? `
        <div class="dropdown-content" id="dropdown-${id}">
            <div class="dropdown-item" onclick="watchVideo('${id}')"><i class="fa-solid fa-play"></i> Xem video</div>
            <div class="dropdown-item" onclick="shareVideo('${id}', event)"><i class="fa-solid fa-share-nodes"></i> Chia sẻ Link</div>
            <div class="dropdown-item" onclick="openEditVideoModal('${id}', '${safeTitle}', event)"><i class="fa-solid fa-pen"></i> Đổi tên</div>
            <div class="dropdown-item delete" onclick="requestDeleteVideo('${id}', event)"><i class="fa-solid fa-trash-can"></i> Xóa</div>
        </div>` : `
        <div class="dropdown-content" id="dropdown-${id}">
            <div class="dropdown-item" onclick="watchVideo('${id}')"><i class="fa-solid fa-play"></i> Xem video</div>
            <div class="dropdown-item" onclick="shareVideo('${id}', event)"><i class="fa-solid fa-share-nodes"></i> Chia sẻ Link</div>
        </div>`;

    let badgeHtml = showBadge ? `<div class="v-uploader-yt">${ownerName} ${ownerName.toLowerCase()==='lam' ? '<i class="fa-solid fa-crown" style="color:#fbbf24;"></i>' : ''}</div>` : `<div class="v-uploader-yt">Video của bạn</div>`;
        
    card.innerHTML = `
        <div class="thumb-area" style="background: url('/videos/${id}/thumbnail.jpg') center/cover;" onclick="watchVideo('${id}')">
            <div class="duration-badge">${video.duration}</div>
            <div class="play-btn-circle"><i class="fa-solid fa-play" style="margin-left:3px;"></i></div>
        </div>
        <div class="card-info-row">
            <div class="avatar-col"><img src="${getAvatarUrl(ownerName)}"></div>
            <div class="details-col" onclick="watchVideo('${id}')">
                <div class="v-title-yt">${video.title}</div>${badgeHtml}
                <div class="v-meta-yt">${viewCount} lượt xem • <span style="color:#fda4af;"><i class="fa-solid fa-heart" style="color:#f43f5e;"></i> ${likeCount}</span> • ${timeAgo(video.createdAt)}</div>
            </div>
            <div class="action-col"><button class="dots-btn-yt" onclick="toggleDropdown('${id}', event)"><i class="fa-solid fa-ellipsis-vertical"></i></button>${menuHtml}</div>
        </div>`;
    return card;
}
function requestDeleteVideo(id, event) { event.stopPropagation(); document.getElementById(`dropdown-${id}`).classList.remove('show'); openConfirm('deleteVideo', id, 'Xóa', 'Bạn chắc chắn muốn xóa?'); }

// ==========================================
// TÍNH NĂNG THỐNG KÊ, THÔNG BÁO VÀ AUTH
// ==========================================

async function loadNotifications() {
    const container = document.getElementById('notiContainer'); const badge = document.getElementById('notiBadge');
    try {
        const resN = await fetch('/api/notifications'); const dN = await resN.json();
        const resV = await fetch('/api/videos'); const dV = await resV.json();
        if (dN.success && dV.success) {
            let readNotis = JSON.parse(localStorage.getItem('streamVibeReadNotis_' + activeUser)) || [];
            const myVideoIds = dV.videos.filter(v => v.uploader === activeUser).map(v => v.videoId);
            const valid = dN.notis.filter(n => n.user !== activeUser && myVideoIds.includes(n.videoId));
            let unread = valid.filter(n => !readNotis.includes(n.id)).length;
            if(badge) badge.style.display = unread > 0 ? 'block' : 'none';
            if(badge) badge.innerText = unread;
            if(valid.length === 0 && container) { container.innerHTML = '<p style="color:var(--text-secondary);">Chưa có bình luận nào.</p>'; return; }
            if(container) container.innerHTML = '';
            valid.forEach((noti) => {
                const isRead = readNotis.includes(noti.id);
                const el = document.createElement('div'); el.className = `noti-item ${isRead ? '' : 'unread'}`;
                el.onclick = () => { if(!isRead) { readNotis.push(noti.id); localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(readNotis)); } window.location.href = '/player.html?id=' + noti.videoId; };
                const vTitle = dV.videos.find(v => v.videoId === noti.videoId)?.title || 'Video';
                el.innerHTML = `<img src="${getAvatarUrl(noti.user)}" class="noti-avatar"><div class="noti-info"><div class="noti-time">${timeAgo(noti.createdAt)} <span style="color:#94a3b8;">• Tại: ${vTitle}</span></div><div class="noti-text"><b>${noti.user}</b>: "${noti.text}"</div></div>`;
                if(container) container.appendChild(el);
            });
        }
    } catch(err) {}
}

function clearNotifications() {
    fetch('/api/notifications').then(r=>r.json()).then(d => {
        if(d.success) { localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(d.notis.map(n=>n.id))); loadNotifications(); }
    });
}

socket.on('global_chat_notification', () => loadNotifications());

let viewsChartInstance = null; let commentsChartInstance = null; window.allRankedVideos = []; 
async function loadStatistics() {
    try {
        const res = await fetch('/api/statistics'); const data = await res.json();
        if (data.success) {
            document.getElementById('statUsers').innerText = data.overview.users; document.getElementById('statVideos').innerText = data.overview.videos;
            document.getElementById('statChats').innerText = data.overview.chats; document.getElementById('statLikes').innerText = data.overview.likes;
            window.allRankedVideos = data.allRanked; 
            const ctxViews = document.getElementById('viewsChart').getContext('2d');
            if (viewsChartInstance) viewsChartInstance.destroy();
            viewsChartInstance = new Chart(ctxViews, { type: 'bar', data: { labels: data.topViews.map(v => v.title), datasets: [{ label: 'Lượt xem', data: data.topViews.map(v => v.viewsCount), backgroundColor: '#3b82f6', borderRadius: 6 }] }, options: { responsive: true } });
            const ctxComments = document.getElementById('commentsChart').getContext('2d');
            if (commentsChartInstance) commentsChartInstance.destroy();
            commentsChartInstance = new Chart(ctxComments, { type: 'doughnut', data: { labels: data.topChats.map(c => c.title), datasets: [{ data: data.topChats.map(c => c.commentCount), backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'], borderWidth: 0 }] }, options: { responsive: true } });
            renderRankedGrid('views');
        }
    } catch(e) {}
}

function renderRankedGrid(sortBy) {
    const grid = document.getElementById('rankedVideoGrid'); if (!grid) return; grid.innerHTML = '';
    ['btnSortViews', 'btnSortChats', 'btnSortLikes'].forEach(id => { document.getElementById(id).style.background = 'rgba(255,255,255,0.1)'; document.getElementById(id).style.color = '#cbd5e1'; });
    if(sortBy === 'views') { document.getElementById('btnSortViews').style.background = '#3b82f6'; document.getElementById('btnSortViews').style.color = '#fff'; }
    else if(sortBy === 'comments') { document.getElementById('btnSortChats').style.background = '#ef4444'; document.getElementById('btnSortChats').style.color = '#fff'; }
    else if(sortBy === 'likes') { document.getElementById('btnSortLikes').style.background = '#f43f5e'; document.getElementById('btnSortLikes').style.color = '#fff'; }

    let sortedList = [...window.allRankedVideos];
    if (sortBy === 'views') sortedList.sort((a, b) => b.viewsCount - a.viewsCount);
    else if (sortBy === 'comments') sortedList.sort((a, b) => b.commentCount - a.commentCount);
    else if (sortBy === 'likes') sortedList.sort((a, b) => b.likesCount - a.likesCount);

    sortedList.forEach((video, index) => {
        const card = createVideoCard(video, activeUser, getUserRole(activeUser), false, true);
        const rankBadge = document.createElement('div'); rankBadge.style = `position:absolute; top:-10px; left:-10px; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; z-index:20; background:${index===0?'#fbbf24':(index===1?'#94a3b8':(index===2?'#b45309':'#000'))}; color:#fff; border:1px solid rgba(255,255,255,0.2);`;
        rankBadge.innerHTML = index === 0 ? '<i class="fa-solid fa-crown"></i>' : (index + 1); card.appendChild(rankBadge);
        grid.appendChild(card);
    });
}

function loginAccount() {
    const username = document.getElementById('usernameInput').value.trim(); const password = document.getElementById('passwordInput').value;
    fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
    .then(r => r.json()).then(d => { if(d.success) { localStorage.setItem('streamVibeActiveUser', d.username); localStorage.setItem('streamVibeActiveRole', d.role); window.location.reload(); } else { document.getElementById('loginError').innerText = d.message; document.getElementById('loginError').style.display = 'block'; } });
}

function registerAccount() {
    const username = document.getElementById('usernameInput').value.trim(); const password = document.getElementById('passwordInput').value;
    fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
    .then(r => r.json()).then(d => { if(d.success) { localStorage.setItem('streamVibeActiveUser', username); localStorage.setItem('streamVibeActiveRole', d.role); window.location.reload(); } else { document.getElementById('loginError').innerText = d.message; document.getElementById('loginError').style.display = 'block'; } });
}

function updateProfileUI(username) {
    document.getElementById('displayUsername').innerText = username; document.getElementById('displayAvatar').src = getAvatarUrl(username);
    const role = getUserRole(username); document.getElementById('displayRole').innerText = role === 'superadmin' ? 'Tổng Tư Lệnh' : (role === 'admin' ? 'Quản trị viên' : (role==='statadmin'?'Thống kê':'Khách'));
    if(role === 'superadmin' || role === 'admin') { if(document.getElementById('adminMenuTab')) document.getElementById('adminMenuTab').style.display = 'block'; if(document.getElementById('technicalSectionTitle')) document.getElementById('technicalSectionTitle').style.display = 'flex'; if(document.getElementById('technicalMenuList')) document.getElementById('technicalMenuList').style.display = 'flex'; }
    if(role === 'superadmin' || role === 'statadmin') { if(document.getElementById('statisticsMenuTab')) document.getElementById('statisticsMenuTab').style.display = 'block'; }
}

function openSettingPanel(panelId) { document.getElementById('settingsMainMenu').style.display = 'none'; document.querySelectorAll('.setting-detail-panel').forEach(p => p.style.display = 'none'); document.getElementById(panelId).style.display = 'block'; }
function closeSettingPanel() { document.querySelectorAll('.setting-detail-panel').forEach(p => p.style.display = 'none'); document.getElementById('settingsMainMenu').style.display = 'block'; }

function loadSettingsInfo() {
    if (!activeUser) return;
    document.getElementById('settingUsername').innerText = activeUser; document.getElementById('profileEditName').innerText = activeUser.toUpperCase();
    document.getElementById('profileEditAvatar').src = getAvatarUrl(activeUser);
    let phones = JSON.parse(localStorage.getItem('streamVibePhones')) || {}; document.getElementById('phoneInput').value = phones[activeUser] || "";
}

function handleChangePassword(e) { e.preventDefault(); openAlert("Tính năng bảo trì", "Chức năng đổi mật khẩu đang bảo trì.", "success"); }
function handleSavePhone(e) { e.preventDefault(); let phones = JSON.parse(localStorage.getItem('streamVibePhones')) || {}; phones[activeUser] = document.getElementById('phoneInput').value; localStorage.setItem('streamVibePhones', JSON.stringify(phones)); closeSettingPanel(); openAlert("Lưu thành công", "Số điện thoại đã được lưu.", "success"); }
function requestLogout() { openConfirm('logout', null, 'Đăng xuất', 'Bạn muốn đăng xuất khỏi phiên làm việc?'); }

window.onload = () => {
    if(activeUser) {
        document.getElementById('loginModal').style.display = 'none';
        fetch('/api/users').then(r => r.json()).then(d => { 
            if(d.success) window.allUsersDB = d.users; 
            updateProfileUI(activeUser); 
            loadUsersList(); 
            loadVideoLists(); 
            loadSettingsInfo(); 
            loadNotifications();
            // CHẠY NGAY HÀM NÀY ĐỂ HIỆN THỊ TẤT CẢ SỐ ĐỎ KHI TRANG VỪA TẢI XONG
            loadContacts(); 
        });
        
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'privateMessages' && urlParams.get('chatUser')) {
            const chatMenuBtn = document.querySelector(`.menu-item[data-tab="privateMessages"]`);
            if (chatMenuBtn) chatMenuBtn.click();
            setTimeout(() => { openChatWithUser(urlParams.get('chatUser')); }, 500);
            window.history.replaceState({}, document.title, "/");
        } else {
            const savedTab = localStorage.getItem('streamVibeActiveTab');
            if (savedTab) { const targetTab = document.querySelector(`.menu-item[data-tab="${savedTab}"]`); if (targetTab) targetTab.click(); }
        }
    } else document.getElementById('loginModal').style.display = 'flex';
};