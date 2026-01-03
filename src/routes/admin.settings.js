const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");
const controller = require("../modules/adminSettings/adminSettings.controller");

const router = express.Router();

router.patch("/profile", authMiddleware, adminMiddleware, controller.updateProfile);
router.patch("/password", authMiddleware, adminMiddleware, controller.changePassword);

module.exports = router;
