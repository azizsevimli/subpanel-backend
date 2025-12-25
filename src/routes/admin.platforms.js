const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");
const platformAdminController = require("../modules/platform/platform.admin.controller");

const router = express.Router();

// /api/admin/platforms
router.get("/", authMiddleware, adminMiddleware, platformAdminController.list);
router.get("/:id", authMiddleware, adminMiddleware, platformAdminController.getById);
router.post("/", authMiddleware, adminMiddleware, platformAdminController.create);
router.patch("/:id", authMiddleware, adminMiddleware, platformAdminController.updateById);
router.delete("/:id", authMiddleware, adminMiddleware, platformAdminController.remove);

module.exports = router;
