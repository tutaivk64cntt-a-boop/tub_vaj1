import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import http from 'http';
import { Server, Socket } from 'socket.io';
import mysql, { Connection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import nodemailer from 'nodemailer';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const app = express();
const port: number = 3000;
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static('public'));
app.use('/videos', express.static('output'));

// CẤU HÌNH GỬI EMAIL
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'kuvyog7v7@gmail.com', 
        pass: 'agsehjzbwfpjydbq'  // ĐIỀN MẬT KHẨU ỨNG DỤNG VÀO ĐÂY
    }
});
// =========================================================================
// PHẦN 1: KẾT NỐI CƠ SỞ DỮ LIỆU MYSQL (XAMPP)
// =========================================================================
let db: Connection | null = null;
async function initMySQL(): Promise<void> {
    try {
        db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'streamvibe'
        });
        console.log('✅ ĐÃ KẾT NỐI THÀNH CÔNG VỚI CƠ SỞ DỮ LIỆU MYSQL (XAMPP)!');
        await db.execute(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'user'
        )`);
        try { await db.execute('ALTER TABLE users ADD COLUMN followers LONGTEXT'); } catch (e) { }
        try { await db.execute('ALTER TABLE users ADD COLUMN following LONGTEXT'); } catch (e) { }
        try { await db.execute('ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT ""'); } catch (e) { }
        try { await db.execute('ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT ""'); } catch (e) { }
        try { await db.execute('ALTER TABLE users ADD COLUMN privacy_mode VARCHAR(20) DEFAULT "public"'); } catch(e) {}
        try { await db.execute('ALTER TABLE users ADD COLUMN allow_download VARCHAR(20) DEFAULT "allow"'); } catch(e) {}
        try { await db.execute('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL'); } catch(e) {}
        try { await db.execute('ALTER TABLE users ADD COLUMN last_name_change DATETIME DEFAULT NULL'); } catch(e) {}
        await db.execute(`CREATE TABLE IF NOT EXISTS videos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            videoId VARCHAR(255) UNIQUE NOT NULL,
            title VARCHAR(255) DEFAULT 'Video không tên',
            duration VARCHAR(50) DEFAULT '0:00',
            uploader VARCHAR(255) NOT NULL,
            views LONGTEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        try { await db.execute('ALTER TABLE videos ADD COLUMN createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP'); } catch (e) { }
        try { await db.execute('ALTER TABLE videos ADD COLUMN likes LONGTEXT'); } catch (e) { }

        await db.execute(`CREATE TABLE IF NOT EXISTS chats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            videoId VARCHAR(255) NOT NULL,
            user VARCHAR(255) NOT NULL,
            text TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS global_notis (
            id INT AUTO_INCREMENT PRIMARY KEY,
            videoId VARCHAR(255) NOT NULL,
            user VARCHAR(255) NOT NULL,
            text TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS private_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender VARCHAR(255) NOT NULL,
            receiver VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        console.log('✅ Đã cấu trúc xong các Bảng dữ liệu!');
    } catch (error: any) {
        console.error('❌ LỖI KẾT NỐI MYSQL. Hãy chắc chắn bạn đã bật MySQL trong XAMPP:', error.message);
    }
}
initMySQL();
// =========================================================================
// PHẦN 2: SOCKET.IO - TÍNH NĂNG REAL-TIME
// =========================================================================
io.on('connection', (socket: Socket) => {
    socket.on('join_video', (videoId: string) => { socket.join(videoId); });
    socket.on('send_chat_realtime', (data: any) => {
        io.to(data.videoId).emit('receive_chat_realtime', data);
        socket.broadcast.emit('global_chat_notification', data);
    });
    socket.on('delete_chat_realtime', (data: any) => { io.to(data.videoId).emit('remove_chat_ui', data.chatId); });
    socket.on('join_user_channel', (username: string) => {
        socket.join('channel_' + username);
    });
    socket.on('send_private_message', (data: any) => {
        io.to('channel_' + data.receiver).emit('receive_private_message', data);
        io.to('channel_' + data.sender).emit('receive_private_message', data);
    });

    socket.on('join_sync_room', (roomCode: string) => {
        socket.join(roomCode);
        socket.to(roomCode).emit('room_notification', 'Một Giám Khảo/Thành viên vừa tham gia phòng chiếu chung!');
    });

    socket.on('leave_sync_room', (roomCode: string) => { socket.leave(roomCode); });
    socket.on('video_action', (data: any) => { socket.to(data.roomCode).emit('sync_video_action', data); });
});

// API ĐỔI TÊN (GIỚI HẠN 30 NGÀY)
app.post('/api/settings/change-name', async (req: Request, res: Response): Promise<any> => {
    try {
        if(!db) return res.json({success:false});
        const { username, newName } = req.body;
        
        // 1. Kiểm tra ngày đổi tên gần nhất
        const [rows]: any = await db.execute('SELECT last_name_change FROM users WHERE username = ?', [username]);
        if(rows.length === 0) return res.json({success:false, message: 'Tài khoản không tồn tại.'});
        
        const lastChange = rows[0].last_name_change;
        if (lastChange) {
            const daysDiff = (new Date().getTime() - new Date(lastChange).getTime()) / (1000 * 3600 * 24);
            if (daysDiff < 30) {
                const daysLeft = Math.ceil(30 - daysDiff);
                return res.json({success: false, message: `Hệ thống chỉ cho phép đổi tên 30 ngày 1 lần. Bạn cần đợi thêm ${daysLeft} ngày nữa!`});
            }
        }
        
        // 2. Cập nhật tên mới và lưu lại thời gian đổi
        await db.execute('UPDATE users SET display_name = ?, last_name_change = NOW() WHERE username = ?', [newName, username]);
        res.json({success: true});
    } catch(e) { res.json({success: false, message: 'Lỗi máy chủ!'}); }
});

// API Cập nhật cài đặt Quyền riêng tư & Tải về
app.post('/api/settings/update', async (req: Request, res: Response): Promise<any> => {
    try {
        if(!db) return res.json({success:false});
        const { username, field, value } = req.body;
        if(field === 'privacy') await db.execute('UPDATE users SET privacy_mode = ? WHERE username = ?', [value, username]);
        if(field === 'download') await db.execute('UPDATE users SET allow_download = ? WHERE username = ?', [value, username]);
        res.json({success: true});
    } catch(e) { res.json({success: false}); }
});

// API Lấy danh sách quyền của toàn bộ User (để Frontend kiểm tra)
app.get('/api/user-permissions', async (req: Request, res: Response): Promise<any> => {
    try {
        if(!db) return res.json({});
        const [rows] = await db.execute<RowDataPacket[]>('SELECT username, privacy_mode, allow_download FROM users');
        const perms: any = {};
        rows.forEach(r => { perms[r.username] = { privacy: r.privacy_mode, download: r.allow_download }; });
        res.json(perms);
    } catch(e) { res.json({}); }
});

// =========================================================================
// PHẦN 3: CÁC API THÔNG THƯỜNG & QUẢN TRỊ VIÊN
// =========================================================================

app.post('/api/users/:username/follow', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false });
        const targetUser = req.params.username;
        const { currentUser } = req.body;

        if (!currentUser) return res.json({ success: false, message: "Bạn cần đăng nhập để theo dõi." });
        if (targetUser === currentUser) return res.json({ success: false, message: "Không thể tự theo dõi chính mình." });

        const [rows] = await db.execute<RowDataPacket[]>('SELECT followers FROM users WHERE username = ?', [targetUser]);

        if (rows.length > 0) {
            let followersArr: string[] = [];
            try {
                // Đã gia cố: Xử lý an toàn khi Dữ liệu bị rỗng
                const parsed = JSON.parse(rows[0].followers);
                if (Array.isArray(parsed)) followersArr = parsed;
            } catch (e) { }

            let isFollowing = false;
            if (followersArr.includes(currentUser)) {
                // Nếu đang theo dõi rồi bấm lại -> Hủy theo dõi
                followersArr = followersArr.filter((u: string) => u !== currentUser);
            } else {
                // Nếu chưa theo dõi -> Bấm để theo dõi
                followersArr.push(currentUser);
                isFollowing = true;
            }

            await db.execute('UPDATE users SET followers = ? WHERE username = ?', [JSON.stringify(followersArr), targetUser]);
            res.json({ success: true, isFollowing, followerCount: followersArr.length });
        } else { 
            res.json({ success: false, message: "Không tìm thấy người dùng." }); 
        }

    } catch (error) { 
        console.error("Lỗi follow:", error);
        res.status(500).json({ success: false, message: "Lỗi máy chủ!" }); 
    }
});

app.get('/api/users/:username/profile', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false })
        const targetUsername = req.params.username;
        const currentViewer = req.query.viewer as string;
        const [userRows] = await db.execute<RowDataPacket[]>('SELECT followers FROM users WHERE username = ?', [targetUsername]);
        let followersArr: string[] = [];
        if (userRows.length > 0) {
            try { followersArr = JSON.parse(userRows[0].followers || '[]'); } catch (e) { }
        }
        const [videos] = await db.execute<RowDataPacket[]>('SELECT * FROM videos WHERE uploader = ? ORDER BY createdAt DESC', [targetUsername]);
        const parsedVideos = videos.map((v: any) => ({
            ...v,
            views: JSON.parse(v.views || '[]'),
            likes: JSON.parse(v.likes || '[]')
        }));
        res.json({
            success: true,
            videos: parsedVideos,
            followerCount: followersArr.length,
            isFollowing: followersArr.includes(currentViewer)
        });
    } catch (error) {
        console.error("Lỗi lấy thông tin cá nhân:", error);
        res.status(500).json({ success: false });
    }
});

// LOGIC ĐƯỢC LÀM MỚI Ở ĐÂY: Sắp xếp người liên hệ đẩy lên top khi có tin nhắn mới
app.get('/api/messages/contacts/:username', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false });
        const user = req.params.username;
        const [rows] = await db.execute<RowDataPacket[]>(`
            SELECT IF(sender = ?, receiver, sender) as contactUser, MAX(createdAt) as lastMsgTime
            FROM private_messages
            WHERE sender = ? OR receiver = ?
            GROUP BY IF(sender = ?, receiver, sender)
            ORDER BY lastMsgTime DESC
        `, [user, user, user, user]);
        res.json({ success: true, contacts: rows.map(r => r.contactUser) });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/messages/:user1/:user2', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false });
        const { user1, user2 } = req.params;
        const [rows] = await db.execute<RowDataPacket[]>(`
            SELECT * FROM private_messages
            WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
            ORDER BY createdAt ASC
        `, [user1, user2, user2, user1]);
        res.json({ success: true, messages: rows });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/messages', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false });
        const { sender, receiver, message } = req.body;
        const [result] = await db.execute<ResultSetHeader>('INSERT INTO private_messages (sender, receiver, message) VALUES (?, ?, ?)', [sender, receiver, message]);
        const [rows] = await db.execute<RowDataPacket[]>('SELECT createdAt FROM private_messages WHERE id = ?', [result.insertId]);
        res.json({ success: true, msgId: result.insertId, createdAt: rows[0].createdAt });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/users/create', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.status(500).json({ success: false, message: 'Chưa kết nối CSDL.' });
        const { username, password, role, requester } = req.body;
        let reqRole = 'user';
        const name = (requester || '').toLowerCase();
        if (name === 'lam' || name === 'boss') {
            reqRole = 'superadmin';
        } else {
            const [reqRows] = await db.execute<RowDataPacket[]>('SELECT role FROM users WHERE username = ?', [requester || '']);
            if (reqRows.length > 0) reqRole = reqRows[0].role;
        }
        if ((role === 'admin' || role === 'statadmin') && reqRole !== 'superadmin') {

            return res.status(403).json({ success: false, message: 'Từ chối truy cập! Chỉ Tổng Tư Lệnh (Super Admin) mới được cấp quyền quản lý.' });
        }
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) return res.status(400).json({ success: false, message: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
        await db.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role]);
        res.json({ success: true, message: 'Tạo tài khoản thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tạo tài khoản.' });
    }
});

app.get('/api/statistics', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false });
        const [usersRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) as c FROM users');
        const [videosRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) as c FROM videos');
        const [chatsRows] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) as c FROM chats');
        const [videos] = await db.execute<RowDataPacket[]>('SELECT * FROM videos');
        const [chatCounts] = await db.execute<RowDataPacket[]>('SELECT videoId, COUNT(id) as c FROM chats GROUP BY videoId');
        let totalLikes = 0;
        let detailedVideos = videos.map((v: any) => {
            let viewArr = []; try { viewArr = JSON.parse(v.views || '[]'); } catch (e) { }
            let likeArr = []; try { likeArr = JSON.parse(v.likes || '[]'); } catch (e) { }
            totalLikes += likeArr.length;
            let cCount = 0;
            const match = chatCounts.find((c: any) => c.videoId === v.videoId);
            if (match) cCount = match.c;
            return {
                videoId: v.videoId,
                title: v.title,
                duration: v.duration,
                uploader: v.uploader,
                createdAt: v.createdAt,
                views: v.views,
                likes: v.likes,
                viewsCount: viewArr.length,
                likesCount: likeArr.length,
                commentCount: cCount
            };
        });

        let topViews = [...detailedVideos].sort((a, b) => b.viewsCount - a.viewsCount).slice(0, 5);
        let topChats = [...detailedVideos].sort((a, b) => b.commentCount - a.commentCount).slice(0, 5);
        res.json({
            success: true,
            overview: {
                users: usersRows[0].c,
                videos: videosRows[0].c,
                chats: chatsRows[0].c,
                likes: totalLikes
            },
            topViews,
            topChats,
            allRanked: detailedVideos
        });
    } catch (error) {
        console.error("Lỗi tải thống kê: ", error);
        res.status(500).json({ success: false });
    }
});

app.put('/api/videos/:id', async (req: Request, res: Response): Promise<any> => {
    try {

        if (!db) return res.json({ success: false });
        const { title } = req.body;
        await db.execute('UPDATE videos SET title = ? WHERE videoId = ?', [title, req.params.id]);
        res.json({ success: true, message: 'Đã cập nhật tên video!' });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/videos/:id/like', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.json({ success: false });
        const { username } = req.body;
        const [rows] = await db.execute<RowDataPacket[]>('SELECT likes FROM videos WHERE videoId = ?', [req.params.id]);
        if (rows.length > 0 && username) {
            let likesArr: string[] = [];
            try { likesArr = JSON.parse(rows[0].likes || '[]'); } catch (e) { }
            if (likesArr.includes(username)) {
                likesArr = likesArr.filter(u => u !== username);
            } else {
                likesArr.push(username);
            }

            await db.execute('UPDATE videos SET likes = ? WHERE videoId = ?', [JSON.stringify(likesArr), req.params.id]);
            res.json({ success: true, isLiked: likesArr.includes(username), likesCount: likesArr.length });
        } else {
            res.json({ success: false });
        }
    } catch (error) { res.status(500).json({ success: false }); }
});
//Đăng ký
app.post('/api/register', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.status(500).json({ success: false, message: 'Chưa kết nối MySQL.' });
        const { username, password, email, phone } = req.body; 
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) return res.status(400).json({ success: false, message: 'Tên tài khoản này đã có người sử dụng!' });

        let role = 'user';
        const lowerName = username.toLowerCase();
        if (lowerName === 'lam' || lowerName === 'boss') role = 'superadmin';
        else if (lowerName.includes('admin') || lowerName.includes('quanly')) role = 'admin';
        
        await db.execute('INSERT INTO users (username, password, email, phone, role) VALUES (?, ?, ?, ?, ?)', [username, password, email || '', phone || '', role]);
        res.json({ success: true, message: 'Đăng ký thành công!', role: role });
    } catch (error) { res.status(500).json({ success: false, message: 'Lỗi máy chủ.' }); }
});

// API QUÊN MẬT KHẨU HOÀN TOÀN MỚI
app.post('/api/forgot-password', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.status(500).json({ success: false, message: 'Chưa kết nối MySQL.' });
        const { username, email, phone } = req.body;
        
        let query = '';
        let params: any[] = [];
        
        // CHỈ check Email HOẶC Phone dựa trên thông tin gửi lên
        if (email) {
            query = 'SELECT * FROM users WHERE username = ? AND email = ? AND email != ""';
            params = [username, email];
        } else if (phone) {
            query = 'SELECT * FROM users WHERE username = ? AND phone = ? AND phone != ""';
            params = [username, phone];
        } else {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin khôi phục!' });
        }
        
        const [rows] = await db.execute<RowDataPacket[]>(query, params);
        
        if (rows.length > 0) {
            // 1. Tạo ngẫu nhiên một mật khẩu mới (8 ký tự)
            const newPassword = Math.random().toString(36).slice(-8);
            
            // 2. Cập nhật mật khẩu mới đè lên mật khẩu cũ trong Database
            await db.execute('UPDATE users SET password = ? WHERE username = ?', [newPassword, username]);

            // 3. Gửi mật khẩu mới qua Email
            if (email) {
                const mailOptions = {
                    from: '"StreamVibe Support" <kuvyog7v7@gmail.com>',
                    to: email,
                    subject: 'Khôi phục mật khẩu tài khoản StreamVibe',
                    text: `Xin chào ${username}\nMật khẩu mới của bạn là: ${newPassword}\nVui lòng đăng nhập hệ thống và tiến hành đổi mật khẩu ngay nhé!`
                };
                
                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) console.log("❌ Lỗi gửi email: ", error);
                    else console.log("✅ Email đã được gửi thành công: " + info.response);
                });
            } else if (phone) {
                // Lưu ý: Để gửi SMS thật, bạn cần mua API của Twilio hoặc SpeedSMS (tốn phí).
                // Ở đây mình mô phỏng gửi SMS bằng cách in ra Terminal của Server.
                console.log(`[MÔ PHỎNG SMS] Đã gửi SMS tới SĐT ${phone}: Mật khẩu mới của ${username} là ${newPassword}`);
            }

            // 4. Báo cho Frontend biết là đã xong (TUYỆT ĐỐI KHÔNG GỬI KÈM MẬT KHẨU XUỐNG DƯỚI)
            res.json({ success: true, message: 'Mật khẩu mới đã được gửi!' });
        } else {
            res.status(400).json({ success: false, message: 'Thông tin xác nhận không đúng! Vui lòng thử lại.' });
        }
    } catch (error) { res.status(500).json({ success: false, message: 'Lỗi máy chủ.' }); }
});

app.post('/api/login', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.status(500).json({ success: false, message: 'Chưa kết nối MySQL.' });
        const { username, password } = req.body;
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (rows.length > 0) res.json({ success: true, username: rows[0].username, role: rows[0].role });
        else res.status(400).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/users', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false });
        const [rows] = await db.execute<RowDataPacket[]>('SELECT username, role FROM users');
        res.json({ success: true, users: rows });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.delete('/api/users/:username', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.json({ success: false });
        await db.execute('DELETE FROM users WHERE username = ?', [req.params.username]);
        res.json({ success: true, message: 'Đã xóa tài khoản.' });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/videos', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.json({ success: false, videos: [] });
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM videos');
        const videos = rows.map((v: any) => ({
            ...v,
            views: JSON.parse(v.views || '[]'),
            likes: JSON.parse(v.likes || '[]')
        }));
        res.json({ success: true, videos });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/videos/:id/view', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.json({ success: false });
        const { username } = req.body;
        const [rows] = await db.execute<RowDataPacket[]>('SELECT views FROM videos WHERE videoId = ?', [req.params.id]);
        if (rows.length > 0 && username) {
            let viewsArr: string[] = JSON.parse(rows[0].views || '[]');
            if (!viewsArr.includes(username)) {
                viewsArr.push(username);
                await db.execute('UPDATE videos SET views = ? WHERE videoId = ?', [JSON.stringify(viewsArr), req.params.id])
            }
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/notifications', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false, notis: [] });
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM global_notis ORDER BY createdAt DESC LIMIT 50');
        res.json({ success: true, notis: rows });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/chat/:videoId', async (req: Request, res: Response): Promise<any> => {
    try {
        if (!db) return res.json({ success: false, chats: [] });
        const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM chats WHERE videoId = ? ORDER BY createdAt ASC', [req.params.videoId]);
        res.json({ success: true, chats: rows.map((r: any) => ({ ...r, _id: r.id })) });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/chat/:videoId', async (req: Request, res: Response): Promise<any> => {
    try {

        if (!db) return res.json({ success: false });
        const { user, text } = req.body;
        const [result] = await db.execute<ResultSetHeader>('INSERT INTO chats (videoId, user, text) VALUES (?, ?, ?)', [req.params.videoId, user, text]);
        await db.execute('INSERT INTO global_notis (videoId, user, text) VALUES (?, ?, ?)', [req.params.videoId, user, text]);
        res.json({ success: true, chat: { _id: result.insertId, user, text } });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.delete('/api/chat/:chatId', async (req: Request, res: Response): Promise<any> => {

    try {
        if (!db) return res.json({ success: false });
        await db.execute('DELETE FROM chats WHERE id = ?', [req.params.chatId]);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.delete('/delete-video/:id', async (req: Request, res: Response): Promise<any> => {
    const videoId = req.params.id as string;
    const videoDir = path.join(__dirname, 'output', videoId);
    try {

        if (!db) return res.status(500).json({ success: false, message: 'Chưa kết nối CSDL.' });
        if (fs.existsSync(videoDir)) { fs.rmSync(videoDir, { recursive: true, force: true }); }
        await db.execute('DELETE FROM videos WHERE videoId = ?', [videoId]);
        await db.execute('DELETE FROM chats WHERE videoId = ?', [videoId]);
        res.json({ success: true, message: 'Đã xóa toàn bộ phân đoạn và dữ liệu video!' });
    } catch (error) { res.status(500).json({ success: false, message: 'Lỗi server khi tiến hành xóa.' }); }
});

// =========================================================================
// PHẦN 4: UPLOAD & XỬ LÝ FFMPEG
// =========================================================================
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('videoFile'), (req: Request, res: Response): any => {
    if (!req.file) return res.status(400).send('Vui lòng chọn một file video!');
    const videoPath = req.file.path;
    const videoName = req.file.filename;
    const outputDir = path.join(__dirname, 'output', videoName);
    const title = req.body.title || 'Video HLS Mới';
    const uploader = req.body.uploader || 'Khách Vô Danh';

    if (!fs.existsSync(outputDir)) { fs.mkdirSync(outputDir, { recursive: true }); }
    const outputPlaylist = path.join(outputDir, 'main.m3u8');

    ffmpeg.ffprobe(videoPath, function (err: any, metadata: any) {
        let durationStr = "0:00";
        if (!err && metadata) {
            let seconds = Math.floor(metadata.format.duration || 0);
            let m = Math.floor(seconds / 60);
            let s = seconds % 60;
            durationStr = m + ":" + (s < 10 ? "0" : "") + s;
        }
        ffmpeg(videoPath)
            .screenshots({ timestamps: ['1'], filename: 'thumbnail.jpg', folder: outputDir })
            .on('end', () => {
                ffmpeg(videoPath)
                    .addOption('-profile:v', 'baseline')
                    .addOption('-level', '3.0')
                    .addOption('-start_number', '0')
                    .addOption('-hls_time', '10')
                    .addOption('-hls_list_size', '0')
                    .addOption('-f', 'hls')
                    .output(outputPlaylist)
                    .on('end', async () => {
                        fs.unlinkSync(videoPath);
                        try {
                            if (db) {
                                await db.execute(
                                    'INSERT INTO videos (videoId, title, duration, uploader, views, likes) VALUES (?, ?, ?, ?, ?, ?)',
                                    [videoName, title, durationStr, uploader, '[]', '[]']
                                );
                            }
                        } catch (dbError) { console.error("Lỗi khi lưu video vào DB:", dbError); }
                        res.send(`

                <div style="text-align:center; font-family:Arial; padding:50px; background:#060814; color:white; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <h1 style="color: #28a745; margin-bottom:20px;">Đã tải lên video thành công!</h1>
                    <p style="color:#94a3b8;">Mã ID video của bạn: <b>${videoName}</b></p>
                    <br>
                    <a href="/player.html?id=${videoName}" style="display:inline-block; padding:15px 30px; background:#3b82f6; color:#fff; text-decoration:none; border-radius:12px; font-weight:bold; font-size:18px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">XEM VIDEO STREAMING NGAY</a>
                    <br><br>
                    <a href="/" style="background-color: #3b82f6; color: #ffffff; text-decoration: none; font-weight: 600; padding: 10px 20px; border-radius: 8px; display: inline-block; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#2563eb'" onmouseout="this.style.backgroundColor='#3b82f6'">Quay lại Dashboard</a>
                </div>
            `);
                    })
                    .on('error', (err: any) => {
                        console.error('Lỗi khi xử lý luồng HLS: ', err);
                        res.status(500).send('Có lỗi xảy ra trong quá trình xử lý luồng HLS.');
                    })
                    .run();
            })
            .on('error', (err: any) => {
                console.error('Lỗi khi tạo ảnh bìa: ', err);
                res.status(500).send('Có lỗi xảy ra khi tạo ảnh bìa cho video.');
            });
    });
});
server.listen(port, () => {
    console.log(`🚀 Máy chủ StreamVibe (TypeScript) và Socket.io đang chạy tại: http://localhost:${port}`);
});