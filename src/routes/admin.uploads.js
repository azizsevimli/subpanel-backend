const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");
const upload = require("../config/multer");

const router = express.Router();

// POST /api/admin/uploads/logo
router.post(
    "/logo",
    authMiddleware,
    adminMiddleware,
    upload.single("logo"),
    (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "Dosya bulunamadı." });
            }

            const logoUrl = `/uploads/logos/${req.file.filename}`;

            return res.status(201).json({
                logoUrl,
            });
        } catch (err) {
            console.error("Logo upload error:", err);
            return res.status(500).json({ message: "Dosya yüklenemedi." });
        }
    }
);

module.exports = router;
