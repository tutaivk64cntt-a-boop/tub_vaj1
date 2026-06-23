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
                if (data.success) {
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
    if (event) event.stopPropagation();

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

    switch (platform) {
        case 'facebook': url = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`; break;
        case 'messenger':
            url = `fb-messenger://share/?link=${encodedLink}`;
            if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                url = `https://www.facebook.com/dialog/send?link=${encodedLink}&app_id=291667064273102&redirect_uri=${encodedLink}`;
            }
            break;
        case 'zalo': url = `https://chat.zalo.me/?url=${encodedLink}`; break;
        case 'telegram': url = `https://t.me/share/url?url=${encodedLink}&text=${text}`; break;
        case 'gmail': url = `https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent("Chia sẻ luồng Video StreamVibe")}&body=${encodedLink}`; break;
    }

    if (url) window.open(url, '_blank');
}

async function openUserProfile(username) {
    currentProfileView = username;

    const avatarEl = document.getElementById('viewProfileAvatar');
    if (avatarEl) avatarEl.src = getAvatarUrl(username);

    const nameEl = document.getElementById('viewProfileName');
    if (nameEl) nameEl.innerHTML = `${username} ${username.toLowerCase() === 'lam' ? '<i class="fa-solid fa-circle-check" style="color: #3b82f6; font-size: 14px;"></i>' : ''}`;

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
    if (roleEl) {
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
        if (btnFollow) btnFollow.style.display = 'none';
        if (btnMsg) btnMsg.style.display = 'none';
    } else {
        if (btnFollow) btnFollow.style.display = 'inline-block';
        if (btnMsg) btnMsg.style.display = 'inline-block';
    }

    const modalEl = document.getElementById('userProfileModal');
    if (modalEl) modalEl.style.display = 'flex';

    const videoGrid = document.getElementById('profileVideoGrid');
    if (videoGrid) videoGrid.innerHTML = '<p style="color:var(--text-secondary); font-size: 15px; padding: 10px;">Đang tải dữ liệu...</p>';

    const vCountEl = document.getElementById('profileVideoCount');
    if (vCountEl) vCountEl.innerText = '0';

    const fCountEl = document.getElementById('profileFollowerCount');
    if (fCountEl) fCountEl.innerText = '0';

    try {
        const res = await fetch(`/api/users/${username}/profile?viewer=${activeUser}`);
        const data = await res.json();

        if (data.success) {
            // 1. CHỐT SỐ LƯỢNG THEO DÕI
            const activeU = localStorage.getItem('streamVibeActiveUser');
            let follows = JSON.parse(localStorage.getItem('streamVibeFollows')) || {};
            let localFollowers = follows[username] || [];
            let isFollowingLocal = localFollowers.includes(activeU);

            let finalCount = Math.max(data.followerCount || 0, localFollowers.length);
            const fCountEl = document.getElementById('profileFollowerCount');
            if (fCountEl) fCountEl.innerText = finalCount;

            const btnFollow = document.getElementById('btnFollowUser');
            if (btnFollow) {
                if (isFollowingLocal || data.isFollowing) {
                    btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Đang theo dõi`;
                    btnFollow.style.background = 'rgba(255,255,255,0.1)';
                } else {
                    btnFollow.innerHTML = `<i class="fa-solid fa-user-plus"></i> Theo dõi`;
                    btnFollow.style.background = 'var(--accent-blue)';
                }
            }

            // 2. KHÔI PHỤC DANH SÁCH VIDEO (CÓ TÍNH NĂNG TỰ TÌM KIẾM TRONG KHO TỔNG)
            let videoList = data.videos || data.userVideos || [];

            // PHÉP THUẬT Ở ĐÂY: Nếu API cá nhân báo 0 video, ta tự quét từ Kho Server Tổng!
            if (videoList.length === 0) {
                try {
                    const allRes = await fetch('/api/videos');
                    const allData = await allRes.json(); // Lấy Object trả về từ API

                    // Trích xuất đúng mảng videos từ Object (Sửa lỗi Array.isArray)
                    const videoArray = Array.isArray(allData) ? allData : (allData.videos || []);

                    if (Array.isArray(videoArray)) {
                        videoList = videoArray.filter(v =>
                            (v.uploader && v.uploader.toLowerCase() === username.toLowerCase()) ||
                            (v.author && v.author.toLowerCase() === username.toLowerCase())
                        );
                    }
                } catch (e) {
                    console.log("Không thể quét kho tổng");
                }
            }

            // In số lượng video thực tế sau khi đã quét
            const vCountEl = document.getElementById('profileVideoCount');
            if (vCountEl) vCountEl.innerText = videoList.length;

            // 3. TẠO KHUNG CHỨA VIDEO VÀ IN RA MÀN HÌNH
            let videoGrid = document.getElementById('profileVideoGrid');
            if (!videoGrid) {
                videoGrid = document.createElement('div');
                videoGrid.id = 'profileVideoGrid';
                const modalBox = document.querySelector('#userProfileModal .modal-box');
                if (modalBox) modalBox.appendChild(videoGrid);
            }

            if (videoGrid) {
                videoGrid.style.display = 'grid';
                videoGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
                videoGrid.style.gap = '15px';
                videoGrid.style.marginTop = '25px';
                videoGrid.style.maxHeight = '400px';
                videoGrid.style.overflowY = 'auto';
                videoGrid.style.paddingRight = '5px';

                if (videoList.length === 0) {
                    videoGrid.innerHTML = '<p style="color:var(--text-secondary); font-size: 15px; grid-column: 1/-1; text-align: center; padding: 20px;">Người dùng này chưa tải lên video nào.</p>';
                } else {
                    videoGrid.innerHTML = '';
                    videoList.forEach(video => {
                        const id = video.videoId || video.id;
                        const title = video.title || 'Video không tên';
                        const views = Array.isArray(video.views) ? video.views.length : (video.views || 0);
                        const thumbBg = `url('/videos/${id}/thumbnail.jpg') center top / cover no-repeat`;

                        const card = document.createElement('div');
                        card.style.background = 'rgba(15, 23, 42, 0.5)';
                        card.style.border = '1px solid rgba(255,255,255,0.05)';
                        card.style.borderRadius = '12px';
                        card.style.padding = '10px';
                        card.style.cursor = 'pointer';
                        card.style.transition = '0.2s';
                        card.onmouseover = () => { card.style.borderColor = '#3b82f6'; card.style.transform = 'translateY(-4px)'; card.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)'; };
                        card.onmouseout = () => { card.style.borderColor = 'rgba(255,255,255,0.05)'; card.style.transform = 'translateY(0)'; card.style.boxShadow = 'none'; };
                        card.onclick = () => { window.location.href = '/player.html?id=' + id; };

                        card.innerHTML = `
                            <div style="width: 100%; aspect-ratio: 16/9; border-radius: 8px; background: ${thumbBg}; margin-bottom: 10px;"></div>
                            <div style="font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
                            <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;"><i class="fa-solid fa-eye"></i> ${views} lượt xem</div>
                        `;
                        videoGrid.appendChild(card);
                    });
                }
            }
        } else {
            const videoGrid = document.getElementById('profileVideoGrid');
            if (videoGrid) videoGrid.innerHTML = '<p style="color:#ef4444; font-size: 15px; text-align:center;">Lỗi lấy dữ liệu</p>';
        }
    } catch (err) {
        if (videoGrid) videoGrid.innerHTML = '<p style="color:#ef4444; font-size: 15px; text-align:center;">Lỗi kết nối</p>';
    }
}

function closeUserProfile() {
    const modalEl = document.getElementById('userProfileModal');
    if (modalEl) modalEl.style.display = 'none';
}

async function toggleFollow() {
    // 1. Lấy tài khoản đang xem phim
    const activeU = localStorage.getItem('streamVibeActiveUser');
    if (!activeU || activeU === 'Khách Vô Danh') {
        alert("Bạn cần đăng nhập để thả theo dõi nhé!");
        return;
    }

    const btnFollow = document.getElementById('btnFollowUser');
    const countEl = document.getElementById('profileFollowerCount');
    let currentCount = parseInt(countEl.innerText) || 0;

    // 2. Đọc trí nhớ web
    let follows = JSON.parse(localStorage.getItem('streamVibeFollows')) || {};
    if (!follows[currentProfileView]) follows[currentProfileView] = [];

    const isFollowing = follows[currentProfileView].includes(activeU);

    if (isFollowing) {
        // HỦY THEO DÕI (-1)
        follows[currentProfileView] = follows[currentProfileView].filter(u => u !== activeU);
        if (btnFollow) {
            btnFollow.innerHTML = `<i class="fa-solid fa-user-plus"></i> Theo dõi`;
            btnFollow.style.background = 'var(--accent-blue)'; // Trả về màu xanh dương
        }
        if (countEl) countEl.innerText = Math.max(0, currentCount - 1);
    } else {
        // THEO DÕI (+1)
        follows[currentProfileView].push(activeU);
        if (btnFollow) {
            btnFollow.innerHTML = `<i class="fa-solid fa-user-check"></i> Đang theo dõi`;
            btnFollow.style.background = 'rgba(255,255,255,0.1)'; // Nền xám
        }
        if (countEl) countEl.innerText = currentCount + 1;
    }

    // 3. Lưu vào bộ nhớ
    localStorage.setItem('streamVibeFollows', JSON.stringify(follows));

    // 4. Vẫn gọi ngầm API để đồng bộ Server
    try {
        await fetch(`/api/users/${currentProfileView}/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentUser: activeU })
        });
    } catch (e) { console.error(e); }
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
    if (type === 'error') { icon.style.color = '#ef4444'; icon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>'; }
    else { icon.style.color = '#10b981'; icon.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; }
    document.getElementById('universalAlertModal').style.display = 'flex';
}
function closeAlert() { document.getElementById('universalAlertModal').style.display = 'none'; }

async function initPlayer() {
    try {
        const res = await fetch('/api/videos');
        const data = await res.json();
        if (data.success) {
            const video = data.videos.find(v => v.videoId === videoId);
            if (video) {
                // Load thông tin cơ bản
                const titleEl = document.getElementById('videoTitle');
                if (titleEl) titleEl.innerText = video.title || 'Không có tiêu đề';
                const viewsEl = document.getElementById('videoViews');
                // Đếm số lượng người trong danh sách views
                const totalViews = Array.isArray(video.views) ? video.views.length : 0;
                if (viewsEl) viewsEl.innerText = totalViews + ' lượt xem';
                const dateEl = document.getElementById('videoDate');
                if (dateEl) dateEl.innerText = timeAgo(video.uploadDate);

                const isLiked = Array.isArray(video.likes) && video.likes.includes(activeUser);

                // --- TÍNH TỔNG SỐ TIM HIỂN THỊ ---
                const totalLikes = Array.isArray(video.likes) ? video.likes.length : 0;
                const totalLikeCountEl = document.getElementById('totalLikeCount');
                if (totalLikeCountEl) totalLikeCountEl.innerText = `${totalLikes} lượt thích`;

                const btn = document.getElementById('likeButton');
                const icon = document.getElementById('likeIcon');
                const textEl = document.getElementById('likeText');

                if (isLiked) {
                    if (btn) btn.classList.add('liked');
                    if (icon) {
                        icon.classList.remove('fa-regular');
                        icon.classList.add('fa-solid');
                        icon.style.color = '#ef4444';
                    }
                    if (textEl) textEl.innerText = 'Đã thích';
                } else {
                    if (btn) btn.classList.remove('liked');
                    if (icon) {
                        icon.classList.remove('fa-solid');
                        icon.classList.add('fa-regular');
                        icon.style.color = '#f43f5e';
                    }
                    if (textEl) textEl.innerText = 'Thích';
                }

                // Load thông tin uploader
                // Load thông tin uploader
                const uploaderNameEl = document.getElementById('uploaderName');
                if (uploaderNameEl) {
                    uploaderNameEl.innerText = video.uploader;
                    // Thêm dòng này để truyền đúng tên người đăng khi bấm vào Tên
                    uploaderNameEl.onclick = () => openUserProfile(video.uploader);
                }

                const avatarEl = document.getElementById('uploaderAvatar');
                if (avatarEl) {
                    avatarEl.src = getAvatarUrl(video.uploader);
                    // Thêm dòng này để truyền đúng tên người đăng khi bấm vào Ảnh
                    avatarEl.onclick = () => openUserProfile(video.uploader);
                }

                window.roomOwner = video.uploader;

                if (video.uploader === activeUser || window.globalPermissions?.role === 'superadmin' || window.globalPermissions?.role === 'admin') {
                    const dlBtn = document.getElementById('downloadBtn');
                    if (dlBtn) dlBtn.style.display = 'inline-block';
                }

            } else {
                alert("Video không tồn tại hoặc đã bị xóa!");
                window.location.href = '/';
            }
        }
    } catch (err) {
        console.error("Lỗi khi lấy thông tin video:", err);
    }
}

async function toggleLike() {
    const btn = document.getElementById('likeButton');
    const icon = document.getElementById('likeIcon');
    const textEl = document.getElementById('likeText');
    const totalEl = document.getElementById('totalLikeCount');

    try {
        const res = await fetch(`/api/videos/${videoId}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: activeUser })
        });
        const data = await res.json();

        if (data.success) {
            let currentTotal = 0;
            if (totalEl) {
                currentTotal = parseInt(totalEl.innerText) || 0;
            }

            if (data.isLiked) {
                if (btn) btn.classList.add('liked');
                if (icon) {
                    icon.classList.remove('fa-regular');
                    icon.classList.add('fa-solid');
                    icon.style.color = '#ef4444';
                }
                if (textEl) textEl.innerText = 'Đã thích';

                // + CỘNG TIM
                if (totalEl) totalEl.innerText = (currentTotal + 1) + ' lượt thích';

                for (let i = 0; i < 4; i++) {
                    setTimeout(() => spawnDanmakuText(`❤️ ${activeUser} thả tim! ❤️`, '#ef4444'), i * 400);
                }

                // GỬI THÔNG BÁO TÀNG HÌNH
                fetch('/api/chat/' + videoId, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: activeUser, text: '❤️ Đã thả tim video của bạn' })
                });

            } else {
                if (btn) btn.classList.remove('liked');
                if (icon) {
                    icon.classList.remove('fa-solid');
                    icon.classList.add('fa-regular');
                    icon.style.color = '#f43f5e';
                }
                if (textEl) textEl.innerText = 'Thích';

                // - TRỪ TIM
                if (totalEl) totalEl.innerText = Math.max(0, currentTotal - 1) + ' lượt thích';
            }
        }
    } catch (e) { console.error("Lỗi khi tương tác nút Like", e); }
}

const chunksGrid = document.getElementById('chunksGrid');
if (chunksGrid) {
    for (let i = 0; i < 30; i++) {
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

        hls.on(Hls.Events.MANIFEST_PARSED, function () {
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

        if (data.success && data.chats) {
            data.chats.forEach(chat => {
                appendChatMessageToDOM(chat.user, chat.text, chat._id);
            });
        }
    } catch (error) { console.error("Lỗi lấy dữ liệu chat:", error); }
}

function appendChatMessageToDOM(user, text, chatId = null, isSystem = false, isError = false) {
    if (!chatBox) return;
    if (text === '❤️ Đã thả tim video của bạn') return;

    // BỔ SUNG: Kiểm tra nếu tin nhắn này đã tồn tại trên màn hình thì bỏ qua, chống trùng lặp
    if (chatId && document.getElementById('chat-' + chatId)) return;

    const msgEl = document.createElement('div');
    // Tạo ID ngẫu nhiên nếu chưa có
    if (!chatId) chatId = 'temp-' + Math.random().toString(36).substr(2, 9);
    msgEl.id = 'chat-' + chatId;

    if (isSystem) {
        msgEl.className = `sys-message ${isError ? 'err' : ''}`;
        msgEl.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-bell'}"></i> ${text}`;
        chatBox.appendChild(msgEl);
    } else {
        msgEl.className = 'chat-message';
        // Gắn thẻ tên ẩn để hệ thống biết tin nhắn này của ai
        msgEl.setAttribute('data-username', user);
        const avatar = getAvatarUrl(user);

        let deleteHtml = '';
        if (user === activeUser || role === 'superadmin' || role === 'admin') {
            deleteHtml = `<button class="chat-delete-btn" onclick="deleteMessage('${chatId}')" title="Xóa bình luận"><i class="fa-solid fa-trash-can"></i></button>`;
        }

        let replyHtml = '';
        if (user !== activeUser) {
            replyHtml = `<button class="chat-action-btn" onclick="replyLiveComment('${user}')">
                            <i class="fa-solid fa-reply"></i> Trả lời
                         </button>`;
        }

        let actualText = text;
        let isReply = false;
        let parentReplyBox = null;
        // 🚨 THUẬT TOÁN AUTO-THREAD: Tự động móc nối câu trả lời vào bình luận gốc
        if (text.startsWith('@')) {
            const match = text.match(/^@([^\s:]+)[\s:]+(.*)/);
            // Quét xem có tag tên không
            if (match) {
                const targetUser = match[1];
                // Tô xanh cái tên được tag cho đẹp
                actualText = `<span style="color: var(--accent-blue); font-weight: 700;">@${targetUser}</span> ` + match[2];
                // Chạy ngược lên trên để tìm tin nhắn gần nhất của người bị tag
                const allMsgs = document.querySelectorAll('.chat-message');
                for (let i = allMsgs.length - 1; i >= 0; i--) {
                    if (allMsgs[i].getAttribute('data-username') === targetUser) {
                        const parentId = allMsgs[i].id;
                        parentReplyBox = document.getElementById('replies-' + parentId);
                        if (parentReplyBox) {
                            isReply = true;
                        }
                        break;
                    }
                }
            }
        }

        // ========================================================
        // (GIỮ NGUYÊN ĐOẠN msgEl.innerHTML = `...` CŨ CỦA BẠN Ở DƯỚI)
        // ========================================================
        msgEl.innerHTML = `
            <img src="${avatar}" class="chat-avatar" alt="Avatar" onclick="openUserProfile('${user}')" onerror="this.src='https://ui-avatars.com/api/?name=User&background=1e293b&color=fff'">
            <div class="chat-content-bubble" style="flex-grow: 1;">
                <div class="chat-header-row">
                    <div class="chat-username" onclick="openUserProfile('${user}')">${user}</div>
                    ${deleteHtml}
                </div>
                <div class="chat-text">${actualText}</div>
                
                <div class="chat-actions">
                    <button class="chat-action-btn" onclick="likeLiveComment(this)">
                        <i class="fa-regular fa-heart"></i> <span class="like-count">0</span>
                    </button>
                    ${replyHtml}
                </div>
                
                <div id="replies-chat-${chatId}" style="margin-top: 10px; display: flex; flex-direction: column; gap: 10px; border-left: 2px solid rgba(255,255,255,0.1); padding-left: 10px;"></div>
            </div>
        `;

        // Lệnh quyết định vị trí tin nhắn
        if (isReply && parentReplyBox) {
            // NẾU LÀ TRẢ LỜI: Thu nhỏ avatar, nhét vào "bụng" của tin nhắn gốc
            msgEl.querySelector('.chat-avatar').style.width = '24px';
            msgEl.querySelector('.chat-avatar').style.height = '24px';
            msgEl.querySelector('.chat-content-bubble').style.padding = '8px 12px';
            msgEl.style.marginTop = '5px';

            parentReplyBox.appendChild(msgEl);
        } else {
            // NẾU LÀ BÌNH LUẬN THƯỜNG: Xuất hiện ở dưới cùng như bình thường
            chatBox.appendChild(msgEl);
        }
    }

    // Tự động cuộn xuống cuối chat
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendChatMessage(username, message, time) {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return;

    const msgHtml = `
        <div style="display: flex; gap: 15px; margin-bottom: 20px; animation: slideIn 0.3s ease;">
            <img src="${getAvatarUrl(username)}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <div style="background: rgba(255,255,255,0.05); padding: 12px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); flex-grow: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span style="font-weight: 700; color: #3b82f6; font-size: 14px;">${username}</span>
                    <span style="font-size: 11px; color: #94a3b8;">${time}</span>
                </div>
                <div style="color: #f1f5f9; font-size: 14px; line-height: 1.5; word-break: break-word;">${message}</div>
                
                <div style="display: flex; gap: 15px; margin-top: 10px;">
                    <button class="chat-action-btn" onclick="likeLiveComment(this)">
                        <i class="fa-regular fa-heart"></i> <span class="like-count">0</span>
                    </button>
                    <button class="chat-action-btn" onclick="replyLiveComment('${username}')">
                        <i class="fa-solid fa-reply"></i> Trả lời
                    </button>
                </div>
            </div>
        </div>
    `;
    chatBox.innerHTML += msgHtml;
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

        if (data.success) {
            // BỔ SUNG: Hiển thị tin nhắn ngay lập tức cho chính người vừa gửi
            appendChatMessageToDOM(user, text, data.chat._id);

            socket.emit('send_chat_realtime', {
                videoId: videoId,
                user: user,
                text: text,
                chatId: data.chat._id
            });
        }
    } catch (error) { 
        console.error("Lỗi gửi tin nhắn:", error); 
    }
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
    if (!text) return;

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

    // Tìm ô nhập mã mà chúng ta vừa tạo ở HTML
    const joinInput = document.getElementById('joinRoomCodeInput');

    if (!inCinemaRoom) {
        // Đọc mã từ ô nhập (nếu có)
        let userCode = joinInput ? joinInput.value.trim() : "";

        inCinemaRoom = true;
        btn.innerHTML = `<i class="fa-solid fa-rectangle-xmark"></i> Thoát phòng`;
        btn.style.background = 'var(--accent-danger)';
        badge.innerText = "Đang đồng bộ WebSockets";
        badge.style.background = 'var(--accent-green)';

        if (userCode !== "") {
            // NẾU CÓ NHẬP MÃ -> Tham gia phòng của bạn bè
            currentRoomCode = userCode.toUpperCase();
            appendChatMessageToDOM('Hệ Thống', `Đã tham gia phòng chiếu chung ${currentRoomCode}.`, null, true);
        } else {
            // NẾU ĐỂ TRỐNG Ô NHẬP -> Tự động tạo phòng mới chứa luôn mã Video
            currentRoomCode = `ROOM-${Math.floor(Math.random() * 8999) + 1000}_${videoId}`;
            appendChatMessageToDOM('Hệ Thống', `Đã tạo phòng ${currentRoomCode}. Hãy copy mã này gửi cho bạn bè!`, null, true);
        }

        display.innerText = `MÃ PHÒNG: ${currentRoomCode}`;
        socket.emit('join_sync_room', currentRoomCode);

        localStorage.setItem('streamVibeSyncRoom', currentRoomCode);
        socket.emit('video_action', { roomCode: currentRoomCode, action: 'change_video', videoId: videoId });

        // Khóa ô nhập lại không cho gõ nữa khi đang trong phòng
        if (joinInput) joinInput.disabled = true;

    } else {
        // TẮT PHÒNG
        inCinemaRoom = false;
        btn.innerHTML = `<i class="fa-solid fa-users-viewfinder"></i> Vào Phòng`;
        btn.style.background = 'var(--accent-purple)';
        badge.innerText = "Chế độ đơn lẻ";
        badge.style.background = 'var(--accent-purple)';
        display.innerText = "";

        socket.emit('leave_sync_room', currentRoomCode);
        currentRoomCode = '';
        appendChatMessageToDOM('Hệ Thống', `Đã giải tán phòng chiếu. Trở về chế độ xem cá nhân.`, null, true, true);

        localStorage.removeItem('streamVibeSyncRoom');

        // Mở khóa ô nhập và xóa trắng chữ cũ
        if (joinInput) {
            joinInput.disabled = false;
            joinInput.value = "";
        }
    }
}
//thêm để xem cùng nhau
// ==========================================
// THUẬT TOÁN AUTO-REJOIN: GIỮ KẾT NỐI KHI ĐỔI VIDEO
// ==========================================
setTimeout(() => {
    const savedRoom = localStorage.getItem('streamVibeSyncRoom');
    if (savedRoom) {
        inCinemaRoom = true;
        currentRoomCode = savedRoom;

        // Bật xanh các nút
        const btn = document.getElementById('btnCreateRoom');
        const badge = document.getElementById('syncStatusBadge');
        const display = document.getElementById('roomCodeDisplay');
        if (btn) { btn.innerHTML = `<i class="fa-solid fa-rectangle-xmark"></i> Đang trong phòng`; btn.style.background = 'var(--accent-danger)'; }
        if (badge) { badge.innerText = "Đang đồng bộ WebSockets"; badge.style.background = 'var(--accent-green)'; }
        if (display) display.innerText = `MÃ PHÒNG: ${currentRoomCode}`;

        // Tự động vào lại phòng ở server
        socket.emit('join_sync_room', currentRoomCode);

        // Quan trọng nhất: Gào lên cho các bạn khác biết "Tôi vừa sang video này rồi, sang đây đi!"
        socket.emit('video_action', { roomCode: currentRoomCode, action: 'change_video', videoId: videoId });
    }
}, 800); // Chờ 0.8s để web load xong rồi mới giật lệnh

socket.on('room_notification', (msg) => {
    if (inCinemaRoom) {
        appendChatMessageToDOM('Hệ Thống', msg, null, true);
        addTerminalLog(`[Sync Room] ${msg}`);
    }
});

// Biến chặn spam trong cùng 1 lần mở tab (tránh việc Pause/Play liên tục bị gọi API nhiều lần)
let hasCountedViewThisSession = false;

if (videoElement) {
    videoElement.addEventListener('play', () => {
        // [BỔ SUNG] 1. GỌI API TĂNG VIEW KHI VIDEO THỰC SỰ BẮT ĐẦU CHẠY
        if (!hasCountedViewThisSession) {
            hasCountedViewThisSession = true; // Khóa lại, lần Play sau không gọi nữa
            
            const activeU = localStorage.getItem('streamVibeActiveUser') || ''; 
            
            fetch(`/api/videos/${videoId}/view`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: activeU })
            })
            .then(res => res.json())
            .then(data => {
                if (data.viewAdded) {
                    // Nếu server trả về viewAdded = true (view hợp lệ) -> Tự động +1 view ngay trên giao diện
                    const viewsEl = document.getElementById('videoViews');
                    if (viewsEl) {
                        let currentViews = parseInt(viewsEl.innerText) || 0;
                        viewsEl.innerText = (currentViews + 1) + ' lượt xem';
                    }
                }
            })
            .catch(e => console.error('Lỗi hệ thống đếm view:', e));
        }

        // [GIỮ NGUYÊN] 2. MÃ CŨ CỦA BẠN: ĐỒNG BỘ PHÒNG XEM CHUNG
        if (inCinemaRoom && !isRemoteAction) {
            socket.emit('video_action', { roomCode: currentRoomCode, action: 'play', time: videoElement.currentTime });
            if (typeof addTerminalLog === 'function') {
                addTerminalLog(`[Sync Room] TRUYỀN: Gửi lệnh Phát Video`);
            }
        }
        isRemoteAction = false;
    });

    videoElement.addEventListener('pause', () => {
        // [GIỮ NGUYÊN] MÃ CŨ CỦA BẠN: XỬ LÝ TẠM DỪNG PHÒNG XEM CHUNG
        if (inCinemaRoom && !isRemoteAction) {
            socket.emit('video_action', { roomCode: currentRoomCode, action: 'pause', time: videoElement.currentTime });
            if (typeof addTerminalLog === 'function') {
                addTerminalLog(`[Sync Room] TRUYỀN: Gửi lệnh Tạm Dừng`);
            }
        }
        isRemoteAction = false;
    });
}

socket.on('sync_video_action', (data) => {
    if (inCinemaRoom) {
        // BẢN PRO: NẾU NHẬN ĐƯỢC LỆNH CHUYỂN VIDEO TỪ NGƯỜI KHÁC
        if (data.action === 'change_video' && data.videoId !== videoId) {
            spawnDanmakuText(`[Socket] Nhóm trưởng đã đổi phim! Đang đồng bộ...`, '#3b82f6');
            openAlert('Chuyển phim', 'Ai đó trong nhóm đã chuyển sang video khác. Đang tự động chuyển theo...', 'success');

            // Tự động load sang video mới sau 1.5 giây
            setTimeout(() => {
                window.location.href = '/player.html?id=' + data.videoId;
            }, 1500);
            return; // Dừng xử lý các lệnh khác
        }

        // CÁC LỆNH PLAY/PAUSE NHƯ CŨ
        if (videoElement) {
            isRemoteAction = true;
            if (data.time !== undefined && Math.abs(videoElement.currentTime - data.time) > 1) {
                videoElement.currentTime = data.time;
            }
            if (data.action === 'play') {
                videoElement.play();
                spawnDanmakuText(`[Socket] Nhóm đã bấm Phát`, '#10b981');
            } else if (data.action === 'pause') {
                videoElement.pause();
                spawnDanmakuText(`[Socket] Nhóm đã bấm Dừng`, '#ef4444');
            }
        }
    }
});

const terminalLog = document.getElementById('terminalLog');
function addTerminalLog(message) {
    if (role === 'user' || !terminalLog) return;
    const time = new Date().toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.innerHTML = `<span style="color:#64748b;">[${time}]</span> ${message}`;
    terminalLog.appendChild(line);
    terminalLog.scrollTop = terminalLog.scrollHeight;
}

function startAdvancedSimulations() {
    if (role === 'user') return;
    let chunkCount = 0;

    setInterval(() => {
        if (chunkCount >= 30) return;

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

            document.getElementById('serverLoadText').innerText = `${Math.floor(Math.random() * 200) + 300} KB/s`;
            document.getElementById('p2pLoadText').innerText = "0 KB/s";
            document.getElementById('peerNode').classList.remove('active');
        } else if (randNet > 0.2) {
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
    if (!badge) return;
    let unread = parseInt(localStorage.getItem('streamVibeUnreadMsg_' + activeUser) || '0');
    if (unread > 0) {
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
    fetch('/api/users').then(res => res.json()).then(data => { if (data.success) window.allUsersDB = data.users; });
    addTerminalLog("Hệ thống StreamVibe đã sẵn sàng.");
    startAdvancedSimulations();

    initPlayer();
    updateMsgBadge(); // <--- ĐẢM BẢO CHẠY UPDATE LÚC MỞ TRANG XEM PHIM

    // BỔ SUNG: Gọi hàm này để tải toàn bộ bình luận từ CSDL khi vừa vào trang
    renderChatBox();

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

            if (unreadCount > 0) {
                if (badge) badge.style.display = 'block';
                if (badge) badge.innerText = unreadCount;
            } else {
                if (badge) badge.style.display = 'none';
            }

            if (validNotis.length === 0) {
                if (container) container.innerHTML = '<p style="color: var(--text-secondary); padding: 15px;">Chưa có thông báo nào trên các video của bạn.</p>';
                return;
            }

            if (container) container.innerHTML = '';

            validNotis.forEach((noti) => {
                const isRead = readNotis.includes(noti.id);
                const el = document.createElement('div');
                el.className = `noti-item ${isRead ? '' : 'unread'}`;
                el.onclick = () => {
                    if (!isRead) {
                        readNotis.push(noti.id);
                        localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(readNotis));
                    }
                    window.location.href = '/player.html?id=' + noti.videoId;
                };

                const videoTitle = dataVideos.videos.find(v => v.videoId === noti.videoId)?.title || 'Video của bạn';

                // TỰ ĐỘNG PHÂN LOẠI THÔNG BÁO CHO ĐẸP
                let actionText = `đã bình luận: "${noti.text}"`;
                if (noti.text === '❤️ Đã thả tim video của bạn') {
                    actionText = `<span style="color: #f43f5e; font-weight: 700;">đã thả tim video của bạn ❤️</span>`;
                }

                el.innerHTML = `
                    <img src="${getAvatarUrl(noti.user)}" class="noti-avatar" onerror="this.src='https://ui-avatars.com/api/?name=User&background=1e293b&color=fff'">
                    <div class="noti-info">
                        <div class="noti-time">${timeAgo(noti.createdAt)} <span style="color:#94a3b8; font-weight:500;">• Tại video: ${videoTitle}</span></div>
                        <div class="noti-text"><b>${noti.user}</b> ${actionText}</div>
                    </div>
                `;
                container.appendChild(el);
            });
        }
    } catch (err) {
        if (container) container.innerHTML = '<p style="color: #ef4444; padding:15px;">Lỗi tải thông báo.</p>';
    }
}

function clearNotifications() {
    const activeUser = localStorage.getItem('streamVibeActiveUser');
    fetch('/api/notifications').then(r => r.json()).then(d => {
        if (d.success) {
            const allIds = d.notis.map(n => n.id);
            localStorage.setItem('streamVibeReadNotis_' + activeUser, JSON.stringify(allIds));
            loadNotifications();
        }
    });
}
//Nút tải video
// HÀM XỬ LÝ KHI BẤM NÚT TẢI VỀ TRONG TRANG XEM PHIM
// --- HÀM TẢI TRONG PLAYER (ĐÃ GẮN KHÓA BẢO MẬT) ---
async function downloadVideoPlayer() {
    const title = document.getElementById('videoTitle').innerText;
    const activeUser = localStorage.getItem('streamVibeActiveUser');

    // Tìm video hiện tại trong CSDL để xem ai là tác giả
    const vidRes = await fetch('/api/videos');
    const videos = await vidRes.json();
    const currentVid = videos.find(v => v.videoId === videoId);

    if (currentVid) {
        // Hỏi server quyền của tác giả này
        const pRes = await fetch('/api/user-permissions');
        const perms = await pRes.json();
        const uploaderPerm = perms[currentVid.uploader] || { download: 'allow' };

        // CHẶN NGAY NẾU BỊ KHÓA
        if (uploaderPerm.download === 'block' && currentVid.uploader !== activeUser) {
            openAlert("Tác giả đã Khóa", "Xin lỗi, Tác giả đã khóa tính năng tải video này!", "error");
            return;
        }
    }

    openAlert("Đang xử lý tải về", "Hệ thống HLS đang truy xuất dữ liệu video. Xin vui lòng chờ...", "success");
    setTimeout(() => {
        const a = document.createElement('a');
        a.href = `/videos/${videoId}/main.m3u8`;
        a.download = `${title}.m3u8`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, 1500);
}
// ==========================================
// HÀM XỬ LÝ MENU CHẤT LƯỢNG VIDEO
// ==========================================
function toggleQualityMenu(event) {
    event.stopPropagation(); // Ngăn sự kiện click truyền ra ngoài
    const dropdown = document.getElementById('qualityDropdown');
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'flex';
    } else {
        dropdown.style.display = 'none';
    }
}

function changeQuality(quality) {
    document.getElementById('qualityText').innerText = quality;
    document.getElementById('qualityDropdown').style.display = 'none';

    openAlert("Thành công", `Đã yêu cầu máy chủ chuyển chất lượng video sang: ${quality}`, "success");

    if (typeof addTerminalLog === 'function') {
        addTerminalLog(`<span style="color:#f59e0b;">[HLS Engine] Yêu cầu chuyển luồng độ phân giải: ${quality}</span>`);
    }
}

// Bấm chuột ra ngoài khoảng trống thì tự động đóng menu chất lượng
window.addEventListener('click', function (e) {
    const dropdown = document.getElementById('qualityDropdown');
    const btn = document.getElementById('qualityButton');
    if (dropdown && btn && !btn.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});
// 1. Hàm xử lý thả tim (Like) bình luận
window.likeLiveComment = function (btn) {
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('.like-count');
    let count = parseInt(countSpan.innerText);

    if (btn.classList.contains('liked')) {
        // Nếu đã thả tim rồi -> Bấm lại sẽ thu hồi tim
        btn.classList.remove('liked');
        icon.classList.remove('fa-solid');     // Trở về tim rỗng
        icon.classList.add('fa-regular');
        countSpan.innerText = count - 1;       // Trừ số đếm
    } else {
        // Chưa thả tim -> Bấm vào để thả tim
        btn.classList.add('liked');
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');        // Đổi thành tim đặc
        countSpan.innerText = count + 1;       // Cộng số đếm
    }
};

// Hàm xử lý bấm nút Trả lời (Reply)
window.replyLiveComment = function (targetUsername) {
    // Đã trỏ đúng vào ô nhập chat (danmakuInput) của bạn
    const chatInputBox = document.getElementById('danmakuInput');

    if (chatInputBox) {
        // Gắn tên người đó vào trước nội dung
        chatInputBox.value = `@${targetUsername} ` + chatInputBox.value;
        // Tự động nhấp nháy chuột vào ô để bạn gõ tiếp
        chatInputBox.focus();
    }
};

//
// =========================================================
// XỬ LÝ KIỂM TRA ĐIỀU KIỆN KHI VÀO PHÒNG / TẠO PHÒNG CHIẾU
// =========================================================

// 1. Xử lý khi bấm nút "Vào Phòng"
// 1. Xử lý khi bấm nút "Vào Phòng"
window.joinCinemaRoom = function () {
    const roomInput = document.getElementById('joinRoomCodeInput');
    const roomCode = roomInput ? roomInput.value.trim() : "";

    // Báo lỗi trực tiếp ngay trong ô nhập liệu
    if (!roomCode) {
        if (roomInput) {
            // Đổi chữ mờ (placeholder) thành câu cảnh báo
            roomInput.placeholder = "⚠️ BẠN CHƯA NHẬP MÃ PHÒNG!";

            // Đổi viền và màu nền sang tông đỏ để gây chú ý
            roomInput.style.border = "2px solid #ef4444";
            roomInput.style.background = "rgba(239, 68, 68, 0.1)";

            // Tự động trả lại giao diện bình thường ngay khi người dùng click chuột vào để gõ
            roomInput.onfocus = function () {
                roomInput.placeholder = "Nhập MÃ PHÒNG (VD: ROOM-1234) vào đây...";
                roomInput.style.border = "1px solid rgba(255,255,255,0.2)";
                roomInput.style.background = "rgba(0,0,0,0.5)";
            };
        }
        return; // Dừng luồng xử lý, không cho vào phòng
    }

    // Nếu đã điền mã đầy đủ -> Tiến hành gọi hàm kích hoạt phòng gốc
    if (typeof toggleCinemaRoom === "function") {
        toggleCinemaRoom();
    }
};

// 2. Xử lý khi bấm nút "Tạo Phòng"
window.createCinemaRoom = function () {
    const roomInput = document.getElementById('joinRoomCodeInput');

    // Khi tạo phòng mới, người dùng không cần tự điền mã. 
    // Trường hợp người dùng vô tình nhập linh tinh vào ô, ta chủ động xóa sạch 
    // để hàm toggleCinemaRoom() hiểu là đang tạo phòng mới hoàn toàn (chứ không phải ghép vào phòng cũ).
    if (roomInput) {
        roomInput.value = "";
    }

    // Tiến hành gọi hàm kích hoạt phòng gốc để hệ thống tự sinh mã phòng mới
    if (typeof toggleCinemaRoom === "function") {
        toggleCinemaRoom();
    }
};




// HÀM TỰ ĐỘNG TẢI VÀ HIỂN THỊ VIDEO TRONG BẢNG PROFILE (Dùng chung cho cả Index và Player)
function fetchProfileVideos(username) {
    const countEl = document.getElementById('profileVideoCount');
    const gridEl = document.getElementById('profileVideoGrid');

    if (!gridEl) return;

    // Hiển thị trạng thái đang tải
    gridEl.innerHTML = '<p style="color: #94a3b8; font-size: 14px; grid-column: 1 / -1;">Đang tải danh sách video...</p>';

    // Gọi lên Backend yêu cầu danh sách video
    fetch(`/api/user-videos?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(videos => {
            // Điền số lượng video vào trong dấu ngoặc tròn (Ví dụ: Các video (5))
            if (countEl) countEl.innerText = videos.length;

            // Xóa chữ "Đang tải"
            gridEl.innerHTML = '';

            // Nếu không có video nào
            if (videos.length === 0) {
                gridEl.innerHTML = '<p style="color: #94a3b8; font-size: 14px; grid-column: 1 / -1; text-align: center;">Tài khoản này chưa đăng video nào.</p>';
                return;
            }

            // Có video thì hiển thị ra dạng lưới
            videos.forEach(video => {
                const card = `
                    <div class="video-card" onclick="window.location.href='/player.html?id=${video.id || video.video_id}'" style="cursor:pointer; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 12px; transition: 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        <img src="${video.thumbnail || 'thumb-default.jpg'}" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:8px; margin-bottom: 8px;">
                        <h4 style="color:#fff; font-size:14px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${video.title}</h4>
                        <p style="color:#94a3b8; font-size:12px; margin-top:4px; margin-bottom:0;">${video.views || 0} lượt xem</p>
                    </div>
                `;
                gridEl.insertAdjacentHTML('beforeend', card);
            });
        })
        .catch(err => {
            console.error("Lỗi lấy video profile: ", err);
            gridEl.innerHTML = '<p style="color: #ef4444; font-size: 14px; grid-column: 1 / -1;">Không thể tải danh sách video.</p>';
        });
}