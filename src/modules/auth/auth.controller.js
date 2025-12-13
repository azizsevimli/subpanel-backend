const authService = require("./auth.service");
const jwt = require("jsonwebtoken");

const REFRESH_COOKIE_NAME = "refreshToken";

const refreshCookieOptions = {
    httpOnly: true,
    secure: false, // PROD'da true (https) yap
    sameSite: "lax",
    path: "/",
};

async function register(req, res) {
    try {
        const { email, password, name, surname } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email ve şifre zorunludur." });
        }

        const result = await authService.register({ email, password, name, surname });

        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
            ...refreshCookieOptions,
        });

        return res.status(201).json({
            token: result.accessToken,
            user: result.user,
        });
    } catch (err) {
        if (err.code === "P2002") {
            return res
                .status(409)
                .json({ message: "Bu email adresi zaten kayıtlı." });
        }

        console.error("Register error:", err);
        return res.status(500).json({ message: "Sunucu hatası." });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email ve şifre zorunludur." });
        }

        const result = await authService.login({ email, password });

        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
            ...refreshCookieOptions,
        });

        return res.status(200).json({
            token: result.accessToken,
            user: result.user,
        });
    } catch (err) {
        if (err.code === "INVALID_CREDENTIALS") {
            return res
                .status(401)
                .json({ message: "Email veya şifre hatalı." });
        }

        console.error("Login error:", err);
        return res.status(500).json({ message: "Sunucu hatası." });
    }
}

async function refresh(req, res) {
    try {
        const token = req.cookies[REFRESH_COOKIE_NAME];

        if (!token) {
            return res.status(401).json({ message: "Refresh token bulunamadı." });
        }

        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

        const user = await authService.getUserById(payload.userId);
        if (!user) {
            return res.status(404).json({ message: "Kullanıcı bulunamadı." });
        }

        const newAccessToken = authService.generateAccessToken(user.id);
        const newRefreshToken = authService.generateRefreshToken(user.id);

        res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, {
            ...refreshCookieOptions,
        });

        return res.status(200).json({
            token: newAccessToken,
            user,
        });
    } catch (err) {
        console.error("Refresh error:", err);
        return res.status(401).json({ message: "Geçersiz veya süresi dolmuş refresh token." });
    }
}

async function logout(req, res) {
    try {
        res.clearCookie(REFRESH_COOKIE_NAME, {
            ...refreshCookieOptions,
        });

        return res.status(200).json({ message: "Çıkış yapıldı." });
    } catch (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Sunucu hatası." });
    }
}

module.exports = {
    register,
    login,
    refresh,
    logout,
};
