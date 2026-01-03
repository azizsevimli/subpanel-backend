const service = require("./adminSettings.service");

async function updateProfile(req, res) {
    try {
        const userId = req.user.id;
        const { name, surname, email, currentPassword } = req.body;

        const user = await service.updateProfile({ userId, name, surname, email, currentPassword });
        return res.status(200).json({ user });
    } catch (err) {
        console.error("Admin settings profile error:", err);

        if (err.code === "EMAIL_REQUIRED") return res.status(400).json({ message: "Email zorunludur." });
        if (err.code === "PASSWORD_CONFIRM_REQUIRED") {
            return res.status(400).json({ message: "Email değiştirmek için mevcut şifre zorunludur." });
        }
        if (err.code === "INVALID_CURRENT_PASSWORD") {
            return res.status(400).json({ message: "Mevcut şifre yanlış." });
        }
        if (err.code === "EMAIL_TAKEN") return res.status(409).json({ message: "Bu email zaten kullanılıyor." });
        if (err.code === "NOT_FOUND") return res.status(404).json({ message: "Kullanıcı bulunamadı." });

        return res.status(500).json({ message: "Profil güncellenirken hata oluştu." });
    }
}

async function changePassword(req, res) {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        await service.changePassword({ userId, currentPassword, newPassword });
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Admin settings password error:", err);

        if (err.code === "PASSWORD_REQUIRED") {
            return res.status(400).json({ message: "Mevcut şifre ve yeni şifre zorunludur." });
        }
        if (err.code === "PASSWORD_TOO_SHORT") {
            return res.status(400).json({ message: "Yeni şifre en az 6 karakter olmalıdır." });
        }
        if (err.code === "INVALID_CURRENT_PASSWORD") {
            return res.status(400).json({ message: "Mevcut şifre yanlış." });
        }
        if (err.code === "NOT_FOUND") {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        return res.status(500).json({ message: "Şifre güncellenirken hata oluştu." });
    }
}

module.exports = {
    updateProfile,
    changePassword,
};
