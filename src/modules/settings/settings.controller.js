const service = require("./settings.service");

async function getProfile(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Yetkisiz erişim." });

        const user = await service.getProfile(userId);
        if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

        return res.status(200).json({ user });
    } catch (err) {
        console.error("Get profile error:", err);
        return res.status(500).json({ message: "Profil alınırken hata oluştu." });
    }
}

async function updateProfile(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Yetkisiz erişim." });

        const { name, surname, email, currentPassword } = req.body;

        const user = await service.updateProfile(userId, {
            name,
            surname,
            email,
            currentPassword,
        });

        return res.status(200).json({ user });
    } catch (err) {
        console.error("Update profile error:", err);

        if (err.code === "INVALID_EMAIL") {
            return res.status(400).json({ message: "Email geçersiz." });
        }
        if (err.code === "PASSWORD_CONFIRM_REQUIRED") {
            return res.status(400).json({ message: "Email değiştirmek için mevcut şifre zorunludur." });
        }
        if (err.code === "INVALID_CURRENT_PASSWORD") {
            return res.status(400).json({ message: "Mevcut şifre hatalı." });
        }
        if (err.code === "EMAIL_TAKEN") {
            return res.status(409).json({ message: "Bu email zaten kullanılıyor." });
        }
        if (err.code === "NOT_FOUND") {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        return res.status(500).json({ message: "Profil güncellenirken hata oluştu." });
    }
}

async function changePassword(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Yetkisiz erişim." });

        const { currentPassword, newPassword } = req.body;

        await service.changePassword(userId, { currentPassword, newPassword });
        return res.status(200).json({ message: "Şifre güncellendi." });
    } catch (err) {
        console.error("Change password error:", err);

        if (err.code === "MISSING_FIELDS") {
            return res.status(400).json({ message: "Mevcut şifre ve yeni şifre zorunludur." });
        }
        if (err.code === "WEAK_PASSWORD") {
            return res.status(400).json({ message: "Yeni şifre en az 6 karakter olmalı." });
        }
        if (err.code === "INVALID_CURRENT_PASSWORD") {
            return res.status(400).json({ message: "Mevcut şifre hatalı." });
        }
        if (err.code === "NOT_FOUND") {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        return res.status(500).json({ message: "Şifre güncellenirken hata oluştu." });
    }
}

module.exports = { getProfile, updateProfile, changePassword };
