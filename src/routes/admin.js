const express = require("express");
const adminController = require("../modules/admin/admin.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");
const adminStatsController = require("../modules/admin/adminStats.controller");

const router = express.Router();

router.get("/users", authMiddleware, adminMiddleware, adminController.listUsers);
router.get("/stats", authMiddleware, adminMiddleware, adminStatsController.getStats);
router.post("/users", authMiddleware, adminMiddleware, adminController.createAdmin);

module.exports = router;
