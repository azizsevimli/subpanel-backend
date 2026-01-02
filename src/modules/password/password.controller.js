const service = require("./password.service");

// 1) forgot -> email al, token üret, mail at (şimdilik console)
async function forgotPassword(req, res) {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        if (!email) return res.status(400).json({ message: "Email zorunludur." });

        const { resetUrl } = await service.createResetTokenForEmail(email);

        // ✅ DEV: mail yerine console'a yaz
        if (resetUrl) {
            console.log("RESET PASSWORD URL:", resetUrl);
        }

        // ✅ Güvenlik: her zaman aynı mesaj
        return res.status(200).json({
            message: "Eğer bu email kayıtlıysa şifre sıfırlama linki gönderildi.",
        });
    } catch (err) {
        console.error("Forgot password error:", err);
        return res.status(500).json({ message: "Şifre sıfırlama isteği sırasında hata oluştu." });
    }
}

// 2) reset -> token + newPassword
async function resetPassword(req, res) {
    try {
        const token = String(req.body.token || "").trim();
        const newPassword = String(req.body.newPassword || "");

        await service.resetPasswordWithToken({ token, newPassword });

        return res.status(200).json({ message: "Şifre güncellendi." });
    } catch (err) {
        console.error("Reset password error:", err);

        if (err.code === "TOKEN_REQUIRED") return res.status(400).json({ message: "Token zorunludur." });
        if (err.code === "WEAK_PASSWORD") return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });
        if (err.code === "INVALID_TOKEN") return res.status(400).json({ message: "Geçersiz token." });
        if (err.code === "TOKEN_USED") return res.status(400).json({ message: "Token daha önce kullanılmış." });
        if (err.code === "TOKEN_EXPIRED") return res.status(400).json({ message: "Token süresi dolmuş." });

        return res.status(500).json({ message: "Şifre sıfırlama sırasında hata oluştu." });
    }
}

module.exports = { forgotPassword, resetPassword };
