function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Bu işlem için admin yetkisi gerekir." });
    }

    next();
}

module.exports = adminMiddleware;
