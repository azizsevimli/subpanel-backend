const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const controller = require("../modules/settings/settings.controller");

const router = express.Router();

router.get("/profile", authMiddleware, controller.getProfile);
router.patch("/profile", authMiddleware, controller.updateProfile);
router.patch("/password", authMiddleware, controller.changePassword);

module.exports = router;
