window.globalPermissions = {};
fetch('/api/user-permissions').then(r => r.json()).then(d => { window.globalPermissions = d; });

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
        reader.onload = function (e) {
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
        btnFollow.onclick = toggleFollow;
        btnMsg.onclick = openPrivateChatFromProfile;
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
                    card.onmouseover = () => { card.style.borderColor = 'var(--accent-primary)'; card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)'; };
                    card.onmouseout = () => { card.style.borderColor = 'rgba(255,255,255,0.05)'; card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none'; };
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
    } catch (err) { }
}

function closeUserProfile() {
    document.getElementById('userProfileModal').style.display = 'none';
}

window.toggleFollow = async function () {
    try {
        // Đã bọc encodeURIComponent để chống gãy Link khi tên có dấu cách
        const res = await fetch(`/api/users/${encodeURIComponent(currentProfileView)}/follow`, {
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
        } else {
            openAlert("Lỗi", data.message || "Không thể theo dõi", "error");
        }
    } catch (e) {
        openAlert("Lỗi mạng", "Không kết nối được tới máy chủ", "error");
    }
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

        // CHẠY HÀM THỐNG KÊ CÁ NHÂN KHI BẤM VÀO TAB MỚI
        if (targetId === 'personalStats') loadPersonalStatistics();

        localStorage.setItem('streamVibeActiveTab', targetId);
        if (window.innerWidth <= 768) closeMobileSidebar();
    });
});

// ==========================================
// TÍNH NĂNG THỐNG KÊ KÊNH CÁ NHÂN (YOUTUBE STUDIO)
// ==========================================
window.myRankedVideos = [];
async function loadPersonalStatistics() {
    try {
        const res = await fetch('/api/statistics');
        const data = await res.json();
        if (data.success) {
            // LỌC CHỈ LẤY CÁC VIDEO DO CHÍNH MÌNH ĐĂNG TẢI
            window.myRankedVideos = data.allRanked.filter(v => v.uploader === activeUser);

            let totalViews = 0, totalLikes = 0, totalComments = 0;

            // CỘNG DỒN SỐ LIỆU TẤT CẢ CÁC VIDEO CỦA MÌNH
            window.myRankedVideos.forEach(v => {
                totalViews += v.viewsCount;
                totalLikes += v.likesCount;
                totalComments += v.commentCount;
            });

            document.getElementById('myTotalViews').innerText = totalViews;
            document.getElementById('myTotalLikes').innerText = totalLikes;
            document.getElementById('myTotalComments').innerText = totalComments;

            // Render giao diện danh sách Top video của mình (Mặc định xếp theo Lượt xem)
            renderMyRankedGrid('views');
        }
    } catch (e) { }
}

function renderMyRankedGrid(sortBy) {
    const grid = document.getElementById('myRankedVideoGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // 1. Reset màu các nút lọc
    ['btnSortMyViews', 'btnSortMyChats', 'btnSortMyLikes'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.background = 'rgba(255,255,255,0.1)';
            btn.style.color = '#cbd5e1';
        }
    });

    // 2. Làm nổi bật nút đang được chọn
    if (sortBy === 'views') {
        const btn = document.getElementById('btnSortMyViews');
        if (btn) { btn.style.background = '#3b82f6'; btn.style.color = '#fff'; }
    }
    else if (sortBy === 'comments') {
        const btn = document.getElementById('btnSortMyChats');
        if (btn) { btn.style.background = '#ef4444'; btn.style.color = '#fff'; }
    }
    else if (sortBy === 'likes') {
        const btn = document.getElementById('btnSortMyLikes');
        if (btn) { btn.style.background = '#f43f5e'; btn.style.color = '#fff'; }
    }

    // 3. Tiến hành sắp xếp danh sách
    let sortedList = [...window.myRankedVideos];
    if (sortBy === 'views') sortedList.sort((a, b) => b.viewsCount - a.viewsCount);
    else if (sortBy === 'comments') sortedList.sort((a, b) => b.commentCount - a.commentCount);
    else if (sortBy === 'likes') sortedList.sort((a, b) => b.likesCount - a.likesCount);

    if (sortedList.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary); margin-top:20px;">Bạn chưa tải lên video nào để có thể thống kê.</p>';
        return;
    }

    // Giới hạn hiển thị tối đa 20 video
    sortedList = sortedList.slice(0, 20);

    // 4. In video kèm Huy hiệu Xếp Hạng
    sortedList.forEach((video, index) => {
        const canDel = true;
        const card = createVideoCard(video, activeUser, getUserRole(activeUser), canDel, true);

        // Đảm bảo card có vị trí tương đối để gắn nhãn tuyệt đối vào góc
        card.style.position = 'relative';

        // --- THIẾT KẾ HUY HIỆU THEO YÊU CẦU ---
        let badgeText = '';
        let badgeBg = '';

        if (index === 0) {
            badgeText = '🏆 #1';
            badgeBg = 'linear-gradient(135deg, #f59e0b, #fbbf24)'; // Màu Vàng (Gold)
        } else if (index === 1) {
            badgeText = '🥈 #2';
            badgeBg = 'linear-gradient(135deg, #94a3b8, #cbd5e1)'; // Màu Bạc (Silver)
        } else if (index === 2) {
            badgeText = '🥉 #3';
            badgeBg = 'linear-gradient(135deg, #b45309, #d97706)'; // Màu Đồng (Bronze)
        } else {
            badgeText = '#' + (index + 1);
            badgeBg = 'rgba(71, 85, 105, 0.9)'; // Màu Xám xanh mặc định cho các hạng còn lại
        }

        const rankBadge = document.createElement('div');
        // CSS Nội tuyến giúp huy hiệu ghim chặt ở góc trên bên trái, không che mất mặt video
        rankBadge.style.position = 'absolute';
        rankBadge.style.top = '10px';
        rankBadge.style.left = '10px';
        rankBadge.style.background = badgeBg;
        rankBadge.style.color = '#fff';
        rankBadge.style.padding = '4px 10px';
        rankBadge.style.borderRadius = '8px';
        rankBadge.style.fontWeight = '900';
        rankBadge.style.fontSize = '14px';
        rankBadge.style.zIndex = '20';
        rankBadge.style.boxShadow = '0 4px 10px rgba(0,0,0,0.6)';
        rankBadge.style.border = '1px solid rgba(255,255,255,0.4)';
        rankBadge.style.textShadow = '1px 1px 2px rgba(0,0,0,0.5)';

        // Gắn nội dung chữ vào nhãn
        rankBadge.innerHTML = badgeText;

        // Dán nhãn lên trên cùng của thẻ video
        card.appendChild(rankBadge);

        // In thẻ ra lưới
        grid.appendChild(card);
    });
}

// LOGIC HOÀN TOÀN MỚI: Quét từng người nhắn tin để hiển thị số đỏ chuẩn xác!
async function loadContacts() {
    const list = document.getElementById('contactList');
    const badge = document.getElementById('msgBadge');

    try {
        const res = await fetch(`/api/messages/contacts/${activeUser}`);
        const data = await res.json();
        if (data.success && data.contacts.length > 0) {
            list.innerHTML = '';

            let localReadData = JSON.parse(localStorage.getItem('sv_read_counts_' + activeUser)) || {};
            let totalUnread = 0;

            for (let contact of data.contacts) {
                const isActive = (contact === currentChatTarget) ? 'active' : '';
                let unreadBadgeHtml = '';

                // Fetch tin nhắn để so sánh xem có bao nhiêu tin chưa đọc
                const msgRes = await fetch(`/api/messages/${activeUser}/${contact}`);
                const msgData = await msgRes.json();
                if (msgData.success) {
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
            if (badge) {
                if (totalUnread > 0) {
                    badge.style.display = 'inline-block';
                    badge.innerText = totalUnread;
                } else {
                    badge.style.display = 'none';
                }
            }
        } else {
            if (badge) badge.style.display = 'none';
        }
    } catch (e) { }
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
        if (data.success) {
            historyBox.innerHTML = '';
            data.messages.forEach(msg => appendPrivateMessageUI(msg.sender, msg.message));

            // ĐÁNH DẤU LÀ ĐÃ ĐỌC TOÀN BỘ TIN NHẮN CỦA NGƯỜI NÀY
            let receivedMsgs = data.messages.filter(m => m.sender === username).length;
            let localReadData = JSON.parse(localStorage.getItem('sv_read_counts_' + activeUser)) || {};
            localReadData[username] = receivedMsgs;
            localStorage.setItem('sv_read_counts_' + activeUser, JSON.stringify(localReadData));

            loadContacts(); // Refresh lại danh sách để xóa số đỏ
        }
    } catch (e) { }
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
    if (!text || !currentChatTarget) return;

    appendPrivateMessageUI(activeUser, text);
    input.value = '';

    try {
        const res = await fetch('/api/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: activeUser, receiver: currentChatTarget, message: text })
        });
        const data = await res.json();
        if (data.success) {
            socket.emit('send_private_message', { sender: activeUser, receiver: currentChatTarget, message: text });
        }
    } catch (err) { }
}

socket.on('receive_private_message', (data) => {
    // Nếu đang mở đúng đoạn chat với người đó thì hiện tin nhắn ngay lập tức
    if ((data.sender === currentChatTarget && data.receiver === activeUser) || (data.sender === activeUser && data.receiver === currentChatTarget)) {
        if (data.sender !== activeUser) appendPrivateMessageUI(data.sender, data.message);
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
    if (type === 'error') { icon.style.color = '#ef4444'; icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>'; }
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

// 1. HÀM XỬ LÝ ĐĂNG XUẤT VÀ XÓA BÀI
function executeConfirmAction() {
    if (pendingAction === 'logout') {
        localStorage.removeItem('streamVibeActiveUser');
        localStorage.removeItem('streamVibeActiveRole');

        // Ép trở về trang "Video của tôi" sau khi Đăng xuất
        localStorage.setItem('streamVibeActiveTab', 'dashboard');

        window.location.reload();
    }
    else if (pendingAction === 'deleteUser') {
        fetch('/api/users/' + pendingData, { method: 'DELETE' }).then(res => res.json()).then(data => {
            if (data.success) {
                loadUsersList();
                document.getElementById('userSearchInput').value = '';
                if (localStorage.getItem('streamVibeActiveUser') === pendingData) {
                    localStorage.removeItem('streamVibeActiveUser');
                    localStorage.removeItem('streamVibeActiveRole');
                    localStorage.setItem('streamVibeActiveTab', 'dashboard'); // Ép về trang chủ
                    window.location.reload();
                } else { openAlert("Thành công", `Đã xóa tài khoản.`); }
            }
        });
    }
    else if (pendingAction === 'deleteVideo') {
        fetch(`/delete-video/${pendingData}`, { method: 'DELETE' }).then(res => res.json()).then(data => {
            if (data.success) { loadVideoLists(); openAlert("Đã xóa Video", "Phân đoạn HLS đã bị xóa."); }
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
    if (name === 'TuTai' || name === 'lâm' || name === 'VaXaiCha') return 'superadmin';
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
        if (data.success) { closeAddUserModal(); loadUsersList(); openAlert("Thành công", "Đã tạo tài khoản!"); }
        else { openAlert("Lỗi bảo mật", data.message, "error"); }
    } catch (err) { openAlert("Lỗi", "Lỗi kết nối", "error"); }
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
    if (!superAdminTbody) return;

    superAdminTbody.innerHTML = ''; adminTbody.innerHTML = ''; userTbody.innerHTML = '';
    fetch('/api/users').then(res => res.json()).then(data => {
        if (!data.success) return;
        window.allUsersDB = data.users;
        const activeRole = getUserRole(activeUser);

        if (activeRole === 'superadmin') {
            superAdminSection.style.display = 'block'; adminSection.style.display = 'block';
            if (document.getElementById('btnAddAdmin')) document.getElementById('btnAddAdmin').style.display = 'inline-flex';
        } else if (activeRole === 'admin') {
            superAdminSection.style.display = 'none'; adminSection.style.display = 'block';
            if (document.getElementById('btnAddAdmin')) document.getElementById('btnAddAdmin').style.display = 'none';
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
    if (event) event.stopPropagation();
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
    switch (platform) {
        case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encLink}`; break;
        case 'messenger': url = `fb-messenger://share/?link=${encLink}`; if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) url = `https://www.facebook.com/dialog/send?link=${encLink}&app_id=291667064273102&redirect_uri=${encLink}`; break;
        case 'zalo': url = `https://chat.zalo.me/?url=${encLink}`; break;
        case 'telegram': url = `https://t.me/share/url?url=${encLink}&text=${text}`; break;
        case 'gmail': url = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent("Chia sẻ Video")}&body=${encLink}`; break;
    }
    if (url) window.open(url, '_blank');
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
    if (el) el.innerHTML = `ffmpeg(videoPath)<br>&nbsp;&nbsp;.addOption('-profile:v', '${document.getElementById('paramProfile').value}')<br>&nbsp;&nbsp;.addOption('-hls_time', '${document.getElementById('paramTime').value}')<br>&nbsp;&nbsp;.output(outputPlaylist)`;
}
if (document.getElementById('ffmpegDynamicCode')) updateFfmpegCommand();

function runHlsInspector(id) {
    const r = document.getElementById('inspectResultArea');
    if (!id) return r.style.display = 'none';
    r.style.display = 'block'; document.getElementById('manifestOutput').innerHTML = `#EXTM3U<br>#EXT-X-VERSION:3<br>#EXTINF:10.000000,<br>/videos/${id}/main0.ts<br>#EXT-X-ENDLIST`;
}

function prepareUpload() { document.getElementById('uploaderInput').value = activeUser || 'Khách Vô Danh'; }
function updateFileName(input) {
    if (input.files.length > 0) {
        document.getElementById('fileNameText').innerText = input.files[0].name;
        document.getElementById('fileNameText').style.color = "#60a5fa";
        let titleInput = document.getElementById('videoTitleInput');
        if (titleInput.value.trim() === '') titleInput.value = input.files[0].name.replace(/\.[^/.]+$/, "");
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
    if (myGrid) myGrid.innerHTML = '<p style="color:var(--text-secondary);">Đang tải...</p>';
    if (publicGrid) publicGrid.innerHTML = '<p style="color:var(--text-secondary);">Đang tải...</p>';
    if (inspectSelector) inspectSelector.innerHTML = '<option value="">-- Chọn Node Video --</option>';
    try {
        const res = await fetch('/api/videos'); const data = await res.json();
        if (data.success) {
            if (myGrid) myGrid.innerHTML = ''; if (publicGrid) publicGrid.innerHTML = '';
            const activeRole = getUserRole(activeUser);
            const myVideos = data.videos.filter(v => v.uploader === activeUser);

            if (document.getElementById('workspaceMyVideoCount')) document.getElementById('workspaceMyVideoCount').innerText = myVideos.length;

            if (myVideos.length === 0 && myGrid) myGrid.innerHTML = "<p style='color:var(--text-secondary);'>Chưa có video.</p>";
            else if (myGrid) {
                myVideos.forEach((v, i) => {
                    myGrid.appendChild(createVideoCard(v, activeUser, activeRole, true, false));
                    if (inspectSelector) { const opt = document.createElement('option'); opt.value = v.videoId; opt.innerText = `Node #${i + 1}`; inspectSelector.appendChild(opt); }
                });
            }

            if (data.videos.length === 0 && publicGrid) publicGrid.innerHTML = "<p style='color:var(--text-secondary);'>Trống.</p>";
            else if (publicGrid) {
                data.videos.forEach(v => {
                    const canDel = (v.uploader === activeUser || activeRole === 'superadmin');
                    publicGrid.appendChild(createVideoCard(v, activeUser, activeRole, canDel, true));
                });
            }
        }
    } catch (err) { }
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

// --- HÀM TẠO THẺ VIDEO (ĐÃ GẮN BỘ LỌC RIÊNG TƯ) ---
function createVideoCard(video, activeUser, activeRole, canDelete, showBadge = false) {
    // 1. KIỂM TRA QUYỀN RIÊNG TƯ: Nếu tác giả đặt "Riêng tư", ẩn video trừ khi bạn là Tác giả
    if (window.globalPermissions && window.globalPermissions[video.uploader]) {
        const perm = window.globalPermissions[video.uploader];
        if (perm.privacy === 'private' && video.uploader !== activeUser && activeRole !== 'superadmin') {
            const emptyCard = document.createElement('div');
            emptyCard.style.display = 'none'; // Ẩn tàng hình
            return emptyCard;
        }
    }

    const id = video.videoId; const ownerName = video.uploader; const safeTitle = (video.title || '').replace(/'/g, "\\'");
    const viewCount = Array.isArray(video.views) ? video.views.length : 0;
    const likeCount = video.likesCount !== undefined ? video.likesCount : (Array.isArray(video.likes) ? video.likes.length : 0);
    const card = document.createElement('div'); card.className = 'video-card glass-card';

    // Gửi kèm ownerName vào nút tải về để hàm kiểm tra quyền tải
    let menuHtml = canDelete ? `
        <div class="dropdown-content" id="dropdown-${id}">
            <div class="dropdown-item" onclick="watchVideo('${id}')"><i class="fa-solid fa-play"></i> Xem video</div>
            <div class="dropdown-item" onclick="downloadVideo('${id}', '${safeTitle}', event, '${ownerName}')"><i class="fa-solid fa-download"></i> Tải về máy</div>
            <div class="dropdown-item" onclick="shareVideo('${id}', event)"><i class="fa-solid fa-share-nodes"></i> Chia sẻ Link</div>
            <div class="dropdown-item" onclick="openEditVideoModal('${id}', '${safeTitle}', event)"><i class="fa-solid fa-pen"></i> Đổi tên</div>
            <div class="dropdown-item delete" onclick="requestDeleteVideo('${id}', event)"><i class="fa-solid fa-trash-can"></i> Xóa</div>
        </div>` : `
        <div class="dropdown-content" id="dropdown-${id}">
            <div class="dropdown-item" onclick="watchVideo('${id}')"><i class="fa-solid fa-play"></i> Xem video</div>
            <div class="dropdown-item" onclick="downloadVideo('${id}', '${safeTitle}', event, '${ownerName}')"><i class="fa-solid fa-download"></i> Tải về máy</div>
            <div class="dropdown-item" onclick="shareVideo('${id}', event)"><i class="fa-solid fa-share-nodes"></i> Chia sẻ Link</div>
        </div>`;

    let badgeHtml = showBadge ? `<div class="v-uploader-yt">${ownerName} ${ownerName.toLowerCase() === 'lam' ? '<i class="fa-solid fa-crown" style="color:#fbbf24;"></i>' : ''}</div>` : `<div class="v-uploader-yt">Video của bạn</div>`;

    card.innerHTML = `
        <div class="thumb-area" style="background: url('/videos/${id}/thumbnail.jpg') center/cover;" onclick="watchVideo('${id}')">
            <div class="duration-badge">${video.duration}</div>
            <div class="play-btn-circle"><i class="fa-solid fa-play" style="margin-left:3px;"></i></div>
        </div>
        <div class="card-info-row">
            <div class="avatar-col"><img src="${getAvatarUrl(ownerName)}"></div>
            <div class="details-col" onclick="watchVideo('${id}')">
                <div class="v-title-yt">${video.title}</div>${badgeHtml}
                
                <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; margin-top: 4px; font-weight: 500;">
                    <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 5px; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-eye" style="font-size: 9px;"></i> ${viewCount}
                    </span>
                    <span style="background: rgba(244, 63, 94, 0.1); color: #f43f5e; padding: 2px 5px; border-radius: 4px; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-heart" style="font-size: 9px;"></i> ${likeCount}
                    </span>
                    <span style="color: #475569; font-size: 10px;">•</span>
                    <span style="color: #94a3b8; font-size: 11px;">${timeAgo(video.createdAt)}</span>
                </div>

            </div>
            <div class="action-col"><button class="dots-btn-yt" onclick="toggleDropdown('${id}', event)"><i class="fa-solid fa-ellipsis-vertical"></i></button>${menuHtml}</div>
        </div>`;
    return card;
}

// HÀM XỬ LÝ KHI BẤM NÚT TẢI VỀ NGOÀI TRANG CHỦ
// --- HÀM TẢI VIDEO (ĐÃ GẮN KHÓA TẢI) ---
async function downloadVideo(id, title, event, uploaderName) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown-content.show').forEach(m => m.classList.remove('show'));

    // 2. KIỂM TRA QUYỀN TẢI: Chặn nếu tác giả đặt "Khóa"
    const activeU = localStorage.getItem('streamVibeActiveUser');
    if (window.globalPermissions && window.globalPermissions[uploaderName]) {
        if (window.globalPermissions[uploaderName].download === 'block' && uploaderName !== activeU) {
            openAlert("Tác giả đã Khóa", "Xin lỗi, Tác giả đã khóa không cho phép tải video này!", "error");
            return; // Dừng, không cho tải
        }
    }

    openAlert("Đang xử lý tải về", "Hệ thống HLS đang truy xuất dữ liệu video. Xin vui lòng chờ...", "success");
    setTimeout(() => {
        const a = document.createElement('a');
        a.href = `/videos/${id}/main.m3u8`;
        a.download = `${title}.m3u8`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, 1500);
}

// --- HÀM MỞ BẢNG VÀ LƯU CÀI ĐẶT QUYỀN RIÊNG TƯ / TẢI VIDEO ---
function openPrivacySetting() {
    document.getElementById('privacySettingModal').style.display = 'flex';
}

function openDownloadSetting() {
    document.getElementById('downloadSettingModal').style.display = 'flex';
}

function saveAccountSetting(type) {
    const val = type === 'privacy'
        ? document.querySelector('input[name="videoPrivacy"]:checked').value
        : document.querySelector('input[name="videoDownload"]:checked').value;

    fetch('/api/settings/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: localStorage.getItem('streamVibeActiveUser'), field: type, value: val })
    }).then(r => r.json()).then(d => {
        // Đóng bảng sau khi lưu thành công
        document.getElementById(type === 'privacy' ? 'privacySettingModal' : 'downloadSettingModal').style.display = 'none';

        openAlert("Thành công", `Đã lưu cài đặt ${type === 'privacy' ? 'Riêng tư' : 'Tải video'}! Hệ thống sẽ cập nhật sau vài giây.`, "success");
        setTimeout(() => window.location.reload(), 2000);
    });
}
function requestDeleteVideo(id, event) {
    event.stopPropagation(); document.getElementById(`dropdown-${id}`).classList.remove('show'); openConfirm('deleteVideo', id, 'Xóa', 'Bạn chắc chắn muốn xóa?');
}

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
            if (badge) badge.style.display = unread > 0 ? 'block' : 'none';
            if (badge) badge.innerText = unread;
            if (valid.length === 0 && container) { container.innerHTML = '<p style="color:var(--text-secondary);">Chưa có bình luận nào.</p>'; return; }
            if (container) container.innerHTML = '';
            valid.forEach((noti) => {
                const isRead = readNotis.includes(noti.id);
                const el = document.createElement('div'); el.className = `noti-item ${isRead ? '' : 'unread'}`;
                el.onclick = () => { if (!isRead) { readNotis.push(noti.id); localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(readNotis)); } window.location.href = '/player.html?id=' + noti.videoId; };
                const vTitle = dV.videos.find(v => v.videoId === noti.videoId)?.title || 'Video';
                el.innerHTML = `<img src="${getAvatarUrl(noti.user)}" class="noti-avatar"><div class="noti-info"><div class="noti-time">${timeAgo(noti.createdAt)} <span style="color:#94a3b8;">• Tại: ${vTitle}</span></div><div class="noti-text"><b>${noti.user}</b>: "${noti.text}"</div></div>`;
                if (container) container.appendChild(el);
            });
        }
    } catch (err) { }
}

function clearNotifications() {
    fetch('/api/notifications').then(r => r.json()).then(d => {
        if (d.success) { localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(d.notis.map(n => n.id))); loadNotifications(); }
    });
}

socket.on('global_chat_notification', () => loadNotifications());

let viewsChartInstance = null;
let commentsChartInstance = null;
window.allRankedVideos = [];
// =======================================================
// HÀM 1: TẢI TỔNG QUAN VÀ BIỂU ĐỒ (Đã gỡ bỏ tải 1000 video)
// =======================================================
async function loadStatistics() {
    try {
        const res = await fetch('/api/statistics');
        const data = await res.json();
        if (data.success) {
            // 1. Gắn số liệu tổng quan hệ thống
            document.getElementById('statUsers').innerText = data.overview.users;
            document.getElementById('statVideos').innerText = data.overview.videos;
            document.getElementById('statChats').innerText = data.overview.chats;
            document.getElementById('statLikes').innerText = data.overview.likes;

            // 2. Vẽ biểu đồ bằng Top 5 (Giữ nguyên biểu đồ cũ rất đẹp của bạn)
            const ctxViews = document.getElementById('viewsChart').getContext('2d');
            if (viewsChartInstance) viewsChartInstance.destroy();
            viewsChartInstance = new Chart(ctxViews, { type: 'bar', data: { labels: data.topViews.map(v => v.title), datasets: [{ label: 'Lượt xem', data: data.topViews.map(v => v.viewsCount), backgroundColor: '#3b82f6', borderRadius: 6 }] }, options: { responsive: true } });

            const ctxComments = document.getElementById('commentsChart').getContext('2d');
            if (commentsChartInstance) commentsChartInstance.destroy();
            commentsChartInstance = new Chart(ctxComments, { type: 'doughnut', data: { labels: data.topChats.map(c => c.title), datasets: [{ data: data.topChats.map(c => c.commentCount), backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'], borderWidth: 0 }] }, options: { responsive: true } });

            // 3. GỌI HÀM LẤY TOP 100 VIDEO CHO BẢNG XẾP HẠNG BÊN DƯỚI
            renderRankedGrid('views');
        }
    } catch (e) { }
}

// =======================================================
// HÀM 2: LẤY VÀ HIỂN THỊ ĐÚNG 100 VIDEO (Gọi API mới)
// =======================================================
async function renderRankedGrid(sortBy) {
    const grid = document.getElementById('rankedVideoGrid');
    if (!grid) return;
    grid.innerHTML = '<p style="color:#94a3b8; text-align:center; padding: 20px;">Đang tải TOP 100 video từ hệ thống...</p>';

    // Đổi màu các nút bấm
    ['btnSortViews', 'btnSortChats', 'btnSortLikes'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.style.background = 'rgba(255,255,255,0.1)'; btn.style.color = '#cbd5e1'; }
    });

    if (sortBy === 'views' && document.getElementById('btnSortViews')) { document.getElementById('btnSortViews').style.background = '#3b82f6'; document.getElementById('btnSortViews').style.color = '#fff'; }
    else if (sortBy === 'comments' && document.getElementById('btnSortChats')) { document.getElementById('btnSortChats').style.background = '#ef4444'; document.getElementById('btnSortChats').style.color = '#fff'; }
    else if (sortBy === 'likes' && document.getElementById('btnSortLikes')) { document.getElementById('btnSortLikes').style.background = '#f43f5e'; document.getElementById('btnSortLikes').style.color = '#fff'; }

    try {
        // GỌI API MỚI CHỈ LẤY ĐÚNG 100 VIDEO BẠN VỪA LÀM Ở BƯỚC 1
        const res = await fetch(`/api/admin/top-videos?sortBy=${sortBy}`);
        const data = await res.json();

        if (data.success) {
            const top100Videos = data.videos;
            grid.innerHTML = '';

            if (top100Videos.length === 0) {
                grid.innerHTML = '<p style="color:#94a3b8; text-align:center;">Hệ thống chưa có video nào.</p>';
                return;
            }

            top100Videos.forEach((video, index) => {
                // Xử lý dữ liệu thô từ database để thẻ card hiển thị đúng số View/Like
                try { video.views = JSON.parse(video.views || '[]'); } catch (e) { video.views = []; }
                try { video.likes = JSON.parse(video.likes || '[]'); } catch (e) { video.likes = []; }

                const card = createVideoCard(video, activeUser, getUserRole(activeUser), false, true);

                // THÊM HUY HIỆU TOP GIỐNG HỆT NHƯ Ở TAB CÁ NHÂN
                card.style.position = 'relative';
                let badgeText = '';
                let badgeBg = '';

                if (index === 0) { badgeText = '🏆 #1'; badgeBg = 'linear-gradient(135deg, #f59e0b, #fbbf24)'; }
                else if (index === 1) { badgeText = '🥈 #2'; badgeBg = 'linear-gradient(135deg, #94a3b8, #cbd5e1)'; }
                else if (index === 2) { badgeText = '🥉 #3'; badgeBg = 'linear-gradient(135deg, #b45309, #d97706)'; }
                else { badgeText = '#' + (index + 1); badgeBg = 'rgba(71, 85, 105, 0.9)'; }

                const rankBadge = document.createElement('div');
                rankBadge.style = `position:absolute; top:10px; left:10px; background:${badgeBg}; color:#fff; padding:4px 10px; border-radius:8px; font-weight:900; font-size:14px; z-index:20; box-shadow:0 4px 10px rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.4);`;
                rankBadge.innerHTML = badgeText;

                card.appendChild(rankBadge);
                grid.appendChild(card);
            });
        }
    } catch (error) {
        console.error("Lỗi tải bảng xếp hạng:", error);
    }
}
// --- CÁC HÀM CHUYỂN ĐỔI GIAO DIỆN ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU ---
let currentRecoveryMode = 'email'; // Biến lưu trạng thái hiện tại (Email hay SĐT)

// --- CÁC HÀM CHUYỂN ĐỔI GIAO DIỆN ĐĂNG NHẬP / ĐĂNG KÝ / QUÊN MẬT KHẨU ---
function showRegister() {
    document.getElementById('authTitle').innerText = 'Đăng Ký Tài Khoản';
    document.getElementById('authDesc').innerText = 'Nhập Email hoặc Số điện thoại để khôi phục mật khẩu sau này.';

    document.getElementById('recoveryInputWrapper').style.display = 'block';
    document.getElementById('passwordInput').style.display = 'block';
    document.getElementById('forgotPasswordLink').style.display = 'none';

    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('forgotButtons').style.display = 'none';
    document.getElementById('registerButtons').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
}

function showLogin() {
    document.getElementById('authTitle').innerText = 'Cổng Quản Trị Hệ Thống';
    document.getElementById('authDesc').innerText = 'Nhập tên và mật khẩu để Đăng nhập hệ thống.';

    document.getElementById('recoveryInputWrapper').style.display = 'none';

    document.getElementById('passwordInput').style.display = 'block';
    document.getElementById('forgotPasswordLink').style.display = 'inline-block';

    document.getElementById('actionButtons').style.display = 'flex';
    document.getElementById('forgotButtons').style.display = 'none';
    document.getElementById('registerButtons').style.display = 'none';
    document.getElementById('loginError').style.display = 'none';
}

function showForgotPassword() {
    document.getElementById('authTitle').innerText = 'Khôi Phục Mật Khẩu';
    document.getElementById('authDesc').innerText = 'Nhập thông tin để hệ thống tìm lại tài khoản của bạn.';

    document.getElementById('recoveryInputWrapper').style.display = 'block';
    document.getElementById('passwordInput').style.display = 'none';
    document.getElementById('forgotPasswordLink').style.display = 'none';

    document.getElementById('actionButtons').style.display = 'none';
    document.getElementById('registerButtons').style.display = 'none';
    document.getElementById('forgotButtons').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
}

// HÀM ĐỔI LINH HOẠT GIỮA EMAIL VÀ SĐT KHI BẤM NÚT BÊN TRONG Ô
function toggleInputMethod() {
    const inputEl = document.getElementById('recoveryInput');
    const btnEl = document.getElementById('toggleRecoveryBtn');

    if (currentRecoveryMode === 'email') {
        currentRecoveryMode = 'phone';
        inputEl.placeholder = 'Nhập Số điện thoại của bạn...';
        inputEl.type = 'text';
        inputEl.value = '';
        btnEl.innerText = 'Dùng Email';
        btnEl.style.background = '#10b981'; // Đổi nút sang màu xanh lá
    } else {
        currentRecoveryMode = 'email';
        inputEl.placeholder = 'Nhập Email của bạn...';
        inputEl.type = 'email';
        inputEl.value = '';
        btnEl.innerText = 'Dùng SĐT';
        btnEl.style.background = '#3b82f6'; // Đổi nút về màu xanh dương
    }
}

// 2. HÀM XỬ LÝ ĐĂNG NHẬP
function loginAccount() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
        .then(r => r.json()).then(d => {
            if (d.success) {
                localStorage.setItem('streamVibeActiveUser', d.username);
                localStorage.setItem('streamVibeActiveRole', d.role);

                // CHÌA KHÓA Ở ĐÂY: Ép buộc mở trang "Video của tôi" khi Đăng nhập thành công
                localStorage.setItem('streamVibeActiveTab', 'dashboard');

                window.location.reload();
            } else {
                document.getElementById('loginError').innerText = d.message;
                document.getElementById('loginError').style.display = 'block';
            }
        });
}

// 3. HÀM XỬ LÝ ĐĂNG KÝ
function registerAccount() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const recoveryVal = document.getElementById('recoveryInput').value.trim();

    if (!username || !password) {
        document.getElementById('loginError').innerText = "Lỗi: Vui lòng nhập Tên đăng nhập và Mật khẩu!";
        document.getElementById('loginError').style.display = 'block';
        return;
    }

    if (!recoveryVal) {
        document.getElementById('loginError').innerText = `Lỗi: Vui lòng nhập ${currentRecoveryMode === 'email' ? 'Email' : 'Số điện thoại'} để đăng ký!`;
        document.getElementById('loginError').style.display = 'block';
        return;
    }

    let email = currentRecoveryMode === 'email' ? recoveryVal : '';
    let phone = currentRecoveryMode === 'phone' ? recoveryVal : '';

    fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email, phone })
    })
        .then(r => r.json()).then(d => {
            if (d.success) {
                localStorage.setItem('streamVibeActiveUser', username);
                localStorage.setItem('streamVibeActiveRole', d.role);

                // CHÌA KHÓA Ở ĐÂY: Ép buộc mở trang "Video của tôi" khi Đăng ký thành công
                localStorage.setItem('streamVibeActiveTab', 'dashboard');

                window.location.reload();
            } else {
                document.getElementById('loginError').innerText = d.message;
                document.getElementById('loginError').style.display = 'block';
            }
        });
}

function submitForgotPassword() {
    const username = document.getElementById('usernameInput').value.trim();
    const recoveryVal = document.getElementById('recoveryInput').value.trim();

    if (!username) {
        document.getElementById('loginError').innerText = "Vui lòng nhập Tên đăng nhập!";
        document.getElementById('loginError').style.display = 'block';
        return;
    }

    if (!recoveryVal) {
        document.getElementById('loginError').innerText = "Vui lòng nhập Email hoặc SĐT để khôi phục!";
        document.getElementById('loginError').style.display = 'block';
        return;
    }

    // TỰ ĐỘNG PHÂN LOẠI EMAIL HAY SỐ ĐIỆN THOẠI
    let email = '';
    let phone = '';
    if (recoveryVal.includes('@')) {
        email = recoveryVal; // Nếu có còng @ -> Chắc chắn là gửi Email
    } else {
        phone = recoveryVal; // Nếu không có @ -> Là Số điện thoại
    }

    fetch('/api/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, phone })
    })
        .then(r => r.json()).then(d => {
            if (d.success) {
                openAlert("Thành công!", "Hệ thống đã gửi mật khẩu mới cho bạn. Vui lòng kiểm tra hộp thư hoặc thư rác!", "success");
                showLogin();
            } else {
                document.getElementById('loginError').innerText = d.message;
                document.getElementById('loginError').style.display = 'block';
            }
        });
}

function updateProfileUI(username) {
    document.getElementById('displayUsername').innerText = username; document.getElementById('displayAvatar').src = getAvatarUrl(username);
    const role = getUserRole(username); document.getElementById('displayRole').innerText = role === 'superadmin' ? 'Tổng Tư Lệnh' : (role === 'admin' ? 'Quản trị viên' : (role === 'statadmin' ? 'Thống kê' : 'Khách'));
    if (role === 'superadmin' || role === 'admin') { if (document.getElementById('adminMenuTab')) document.getElementById('adminMenuTab').style.display = 'block'; if (document.getElementById('technicalSectionTitle')) document.getElementById('technicalSectionTitle').style.display = 'flex'; if (document.getElementById('technicalMenuList')) document.getElementById('technicalMenuList').style.display = 'flex'; }
    if (role === 'superadmin' || role === 'statadmin') { if (document.getElementById('statisticsMenuTab')) document.getElementById('statisticsMenuTab').style.display = 'block'; }
}

function openSettingPanel(panelId) { document.getElementById('settingsMainMenu').style.display = 'none'; document.querySelectorAll('.setting-detail-panel').forEach(p => p.style.display = 'none'); document.getElementById(panelId).style.display = 'block'; }
function closeSettingPanel() { document.querySelectorAll('.setting-detail-panel').forEach(p => p.style.display = 'none'); document.getElementById('settingsMainMenu').style.display = 'block'; }

// =========================================================================
// HÀM LOAD THÔNG TIN CÀI ĐẶT (ĐÃ GỘP LẠI VÀ CHỈNH SỬA ẢNH BÌA TO)
// =========================================================================
window.loadSettingsInfo = function () {
    if (!activeUser) return;

    // 1. Lấy thông tin Tên hiển thị
    document.getElementById('settingUsername').innerText = activeUser;
    let displayName = activeUser;
    if (window.allUsersDB && window.allUsersDB.length > 0) {
        const me = window.allUsersDB.find(u => u.username === activeUser);
        if (me && me.display_name) displayName = me.display_name;
        if (document.getElementById('tenHienThiMoi')) document.getElementById('tenHienThiMoi').innerText = displayName;
    }

    // 2. Cập nhật tên trong Cài Đặt
    if (document.getElementById('settingDisplayName')) document.getElementById('settingDisplayName').innerText = displayName;
    if (document.getElementById('profileEditName')) document.getElementById('profileEditName').innerText = displayName.toUpperCase();
    if (document.getElementById('displayUsername')) document.getElementById('displayUsername').innerText = displayName;

    // 3. Cập nhật Avatar trong Cài đặt và Trang chủ
    const myAvatar = getAvatarUrl(activeUser);
    if (document.getElementById('profileEditAvatar')) document.getElementById('profileEditAvatar').src = myAvatar;
    if (document.getElementById('dashboardBannerAvatar')) document.getElementById('dashboardBannerAvatar').src = myAvatar;

    // 4. Cập nhật Tên và Chức vụ ngoài Ảnh bìa trang chủ
    if (document.getElementById('dashboardBannerName')) document.getElementById('dashboardBannerName').innerText = displayName;

    const bannerRole = document.getElementById('dashboardBannerRole');
    if (bannerRole) {
        const roleCode = getUserRole(activeUser);
        bannerRole.innerText = roleCode === 'superadmin' ? '👑 Tổng Tư Lệnh' : (roleCode === 'admin' ? '🛡️ Quản trị viên' : (roleCode === 'statadmin' ? '📊 Quản lý Thống kê' : '👤 Thành viên'));
    }

    // 5. ĐỌC VÀ HIỂN THỊ ẢNH BÌA TỪ LOCALSTORAGE (KHÔNG CÓ LỚP PHỦ ĐEN)
    let banners = JSON.parse(localStorage.getItem('streamVibeBanners')) || {};
    let userBanner = banners[activeUser];
    if (userBanner) {
        // Hiện ở preview phần Cài Đặt
        if (document.getElementById('profileEditBannerPreview')) {
            document.getElementById('profileEditBannerPreview').style.backgroundImage = `url(${userBanner})`;
        }

        // Hiện tràn toàn bộ khung to ở Trang Chủ (bỏ linear-gradient để ảnh sáng nét)
        const mainBanner = document.querySelector('.hero-banner-new');
        if (mainBanner) {
            mainBanner.style.backgroundImage = `url(${userBanner})`;
            mainBanner.style.backgroundSize = 'cover';
            mainBanner.style.backgroundPosition = 'center';
            mainBanner.style.backgroundRepeat = 'no-repeat';
        }
    }

    // 6. Số điện thoại
    let phones = JSON.parse(localStorage.getItem('streamVibePhones')) || {};
    if (document.getElementById('phoneInput')) document.getElementById('phoneInput').value = phones[activeUser] || "";
}

function handleChangePassword(e) { e.preventDefault(); openAlert("Tính năng bảo trì", "Chức năng đổi mật khẩu đang bảo trì.", "success"); }
function handleSavePhone(e) { e.preventDefault(); let phones = JSON.parse(localStorage.getItem('streamVibePhones')) || {}; phones[activeUser] = document.getElementById('phoneInput').value; localStorage.setItem('streamVibePhones', JSON.stringify(phones)); closeSettingPanel(); openAlert("Lưu thành công", "Số điện thoại đã được lưu.", "success"); }
function requestLogout() { openConfirm('logout', null, 'Đăng xuất', 'Bạn muốn đăng xuất khỏi phiên làm việc?'); }

window.onload = () => {
    if (activeUser) {
        document.getElementById('loginModal').style.display = 'none';
        fetch('/api/users').then(r => r.json()).then(d => {
            if (d.success) window.allUsersDB = d.users;
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

// --- HÀM MỞ BẢNG VÀ LƯU CÀI ĐẶT QUYỀN RIÊNG TƯ / TẢI VIDEO ---
function openPrivacySetting() {
    document.getElementById('privacySettingModal').style.display = 'flex';
}

function openDownloadSetting() {
    document.getElementById('downloadSettingModal').style.display = 'flex';
}

function saveAccountSetting(type) {
    const val = type === 'privacy'
        ? document.querySelector('input[name="videoPrivacy"]:checked').value
        : document.querySelector('input[name="videoDownload"]:checked').value;

    fetch('/api/settings/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: localStorage.getItem('streamVibeActiveUser'), field: type, value: val })
    }).then(r => r.json()).then(d => {
        document.getElementById(type === 'privacy' ? 'privacySettingModal' : 'downloadSettingModal').style.display = 'none';
        openAlert("Thành công", `Đã lưu cài đặt ${type === 'privacy' ? 'Riêng tư' : 'Tải video'}! Hệ thống sẽ cập nhật sau vài giây.`, "success");
        setTimeout(() => window.location.reload(), 2000);
    });
}

// --- HÀM XEM ẢNH ĐẠI DIỆN PHÓNG TO ---
window.viewFullSizeAvatar = function () {
    const avatarSrc = document.getElementById('profileEditAvatar').src;
    if (avatarSrc && avatarSrc !== window.location.href) {
        document.getElementById('fullSizeViewerImage').src = avatarSrc;
        document.getElementById('imageViewerModal').style.display = 'flex';
    }
};

window.closeImageViewer = function (event) {
    if (event) {
        event.stopPropagation();
        // Bấm vào ảnh thì không tắt, chỉ tắt khi bấm ra ngoài viền đen hoặc bấm dấu X
        if (event.target.id === 'fullSizeViewerImage') return;
    }
    document.getElementById('imageViewerModal').style.display = 'none';
    setTimeout(() => { document.getElementById('fullSizeViewerImage').src = ''; }, 300);
};

// CẬP NHẬT GIAO DIỆN HIỂN THỊ TÊN MỚI
// --- CẬP NHẬT HÀM LOAD THÔNG TIN ĐỂ KÉO ẢNH BÌA + AVATAR RA TRANG CHỦ ---
window.loadSettingsInfo = function () {
    if (!activeUser) return;

    // 1. Lấy thông tin Tên hiển thị
    document.getElementById('settingUsername').innerText = activeUser;
    let displayName = activeUser;
    if (window.allUsersDB && window.allUsersDB.length > 0) {
        const me = window.allUsersDB.find(u => u.username === activeUser);
        if (me && me.display_name) displayName = me.display_name;
    }

    // Cập nhật tên trong Cài Đặt
    if (document.getElementById('settingDisplayName')) document.getElementById('settingDisplayName').innerText = displayName;
    if (document.getElementById('profileEditName')) document.getElementById('profileEditName').innerText = displayName.toUpperCase();
    if (document.getElementById('displayUsername')) document.getElementById('displayUsername').innerText = displayName;

    // 2. Cập nhật Avatar trong Cài đặt và Trang chủ
    const myAvatar = getAvatarUrl(activeUser);
    if (document.getElementById('profileEditAvatar')) document.getElementById('profileEditAvatar').src = myAvatar;
    if (document.getElementById('dashboardBannerAvatar')) document.getElementById('dashboardBannerAvatar').src = myAvatar;

    // 3. Cập nhật Tên và Chức vụ ngoài Ảnh bìa trang chủ
    if (document.getElementById('dashboardBannerName')) document.getElementById('dashboardBannerName').innerText = displayName;

    const bannerRole = document.getElementById('dashboardBannerRole');
    if (bannerRole) {
        const roleCode = getUserRole(activeUser);
        bannerRole.innerText = roleCode === 'superadmin' ? '👑 Tổng Tư Lệnh' : (roleCode === 'admin' ? '🛡️ Quản trị viên' : (roleCode === 'statadmin' ? '📊 Quản lý Thống kê' : '👤 Thành viên'));
    }

    // 4. ĐỌC VÀ HIỂN THỊ ẢNH BÌA TỪ LOCALSTORAGE
    let banners = JSON.parse(localStorage.getItem('streamVibeBanners')) || {};
    let userBanner = banners[activeUser];
    if (userBanner) {
        if (document.getElementById('profileEditBannerPreview')) document.getElementById('profileEditBannerPreview').style.backgroundImage = `url(${userBanner})`;

        const mainBanner = document.getElementById('mainDashboardBanner');
        if (mainBanner) {
            mainBanner.style.backgroundImage = `url(${userBanner})`;
            mainBanner.style.backgroundSize = 'cover';
            mainBanner.style.backgroundPosition = 'center';
        }
    }

    // 5. Số điện thoại
    let phones = JSON.parse(localStorage.getItem('streamVibePhones')) || {};
    if (document.getElementById('phoneInput')) document.getElementById('phoneInput').value = phones[activeUser] || "";
}

// HÀM XỬ LÝ NÚT BẤM ĐỔI TÊN
window.submitChangeName = function () {
    const newName = document.getElementById('newNameInput').value.trim();
    if (!newName) {
        openAlert("Lỗi", "Vui lòng nhập tên mới!", "error");
        return;
    }

    fetch('/api/settings/change-name', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: activeUser, newName: newName })
    }).then(r => r.json()).then(d => {
        if (d.success) {
            openAlert("Thành công", "Đã đổi tên hiển thị! Mọi người sẽ thấy tên mới của bạn.", "success");
            document.getElementById('newNameInput').value = '';
            setTimeout(() => window.location.reload(), 2000); // Tải lại trang để áp dụng
        } else {
            openAlert("Chưa thể đổi tên", d.message, "error");
        }
    });
}

// --- HÀM TẢI VÀ THAY ĐỔI ẢNH BÌA (ĐÃ NÂNG CẤP) ---
// =========================================================================
// HÀM TẢI VÀ THAY ĐỔI ẢNH BÌA (ĐÃ BỎ LỚP PHỦ MÀU)
// =========================================================================
window.changeBanner = function (input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const base64Image = e.target.result;

            // Lưu vào LocalStorage
            let banners = JSON.parse(localStorage.getItem('streamVibeBanners')) || {};
            banners[activeUser] = base64Image;
            localStorage.setItem('streamVibeBanners', JSON.stringify(banners));

            // Cập nhật giao diện bên trong Cài đặt
            if (document.getElementById('profileEditBannerPreview')) {
                document.getElementById('profileEditBannerPreview').style.backgroundImage = `url(${base64Image})`;
            }

            // CẬP NHẬT TRÀN TOÀN BỘ KHUNG Ở TRANG CHỦ (Chỉ dùng url, bỏ gradient)
            const mainBanner = document.querySelector('.hero-banner-new');
            if (mainBanner) {
                mainBanner.style.backgroundImage = `url(${base64Image})`;
                mainBanner.style.backgroundSize = 'cover';
                mainBanner.style.backgroundPosition = 'center';
                mainBanner.style.backgroundRepeat = 'no-repeat';
            }

            openAlert("Thành công", "Đã cập nhật ảnh bìa mới cho tài khoản của bạn!", "success");
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- CẬP NHẬT HÀM LOAD THÔNG TIN ĐỂ KÉO ẢNH BÌA RA (ĐÃ NÂNG CẤP) ---
window.loadSettingsInfo = function () {
    if (!activeUser) return;
    document.getElementById('settingUsername').innerText = activeUser;

    let displayName = activeUser;
    if (window.allUsersDB && window.allUsersDB.length > 0) {
        const me = window.allUsersDB.find(u => u.username === activeUser);
        if (me && me.display_name) displayName = me.display_name;
    }

    if (document.getElementById('settingDisplayName')) document.getElementById('settingDisplayName').innerText = displayName;
    if (document.getElementById('profileEditName')) document.getElementById('profileEditName').innerText = displayName.toUpperCase();
    if (document.getElementById('displayUsername')) document.getElementById('displayUsername').innerText = displayName;

    document.getElementById('profileEditAvatar').src = getAvatarUrl(activeUser);
    if (document.getElementById('dashboardBannerAvatar')) {
        document.getElementById('dashboardBannerAvatar').src = getAvatarUrl(activeUser);
    }

    // ĐỌC VÀ HIỂN THỊ ẢNH BÌA CỦA NGƯỜI NÀY
    let banners = JSON.parse(localStorage.getItem('streamVibeBanners')) || {};
    let userBanner = banners[activeUser];
    if (userBanner) {
        if (document.getElementById('profileEditBannerPreview')) document.getElementById('profileEditBannerPreview').style.backgroundImage = `url(${userBanner})`;

        const mainBanner = document.getElementById('mainDashboardBanner');
        if (mainBanner) {
            mainBanner.style.backgroundImage = `url(${userBanner})`;
            mainBanner.style.backgroundSize = 'cover';
            mainBanner.style.backgroundPosition = 'center';

            // Tự động ẩn chữ nếu có ảnh bìa
            const h2 = mainBanner.querySelector('h2');
            const p = mainBanner.querySelector('p');
            if (h2) h2.style.display = 'none';
            if (p) p.style.display = 'none';
        }
    }

    let phones = JSON.parse(localStorage.getItem('streamVibePhones')) || {};
    if (document.getElementById('phoneInput')) document.getElementById('phoneInput').value = phones[activeUser] || "";
}

// --- ĐỒNG BỘ TÊN RA BANNER TRANG CHỦ ---
setInterval(() => {
    // Tự động tìm cái tên đang hiển thị ở thanh Menu hoặc Cài đặt để copy sang
    const tenMenu = document.getElementById('settingUsername');
    const tenHienTai = tenMenu ? tenMenu.innerText : null;
    const tenMoi = document.getElementById('ten-sieu-cap-moi');

    // Nếu tìm thấy tên, ép hiển thị ngay lập tức
    if (tenHienTai && tenMoi && tenMoi.innerText !== tenHienTai && tenHienTai !== "Đang tải...") {
        tenMoi.innerText = tenHienTai;
    }
}, 500); // Quét 0.5 giây 1 lần, đổi tên trong Cài đặt là ngoài này tự đổi theo


// ==================================================
// XỬ LÝ NHẬP MÃ XEM CHUNG TỪ TRANG CHỦ
// ==================================================
window.joinRoomFromHome = function () {
    const inputCode = document.getElementById('homeRoomInput').value.trim();
    if (!inputCode) {
        alert("Vui lòng dán mã phòng vào ô trống!");
        return;
    }

    // Mã chuẩn sẽ có dấu gạch dưới để tách ID Video (Ví dụ: ROOM-1234_VideoID)
    if (inputCode.includes('_')) {
        const parts = inputCode.split('_');
        const videoId = parts.slice(1).join('_'); // Lấy phần đuôi làm ID Video

        // Lưu toàn bộ mã vào bộ nhớ để sang trang xem nó tự động kết nối
        localStorage.setItem('streamVibeSyncRoom', inputCode.toUpperCase());

        // Dùng đĩa bay, bay thẳng tới trang Video đó luôn!
        window.location.href = '/player.html?id=' + videoId;
    } else {
        alert("Mã phòng không hợp lệ! Mã xem chung chuẩn phải có dấu gạch dưới (Ví dụ: ROOM-1234_abc). Vui lòng copy chính xác mã bạn bè gửi.");
    }
};