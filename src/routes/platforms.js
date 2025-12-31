const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const platformsController = require("../modules/platform/platform.public.controller");

const router = express.Router();

// user login zorunlu olsun istiyorsan authMiddleware kalsın
router.get("/", authMiddleware, platformsController.listActive);

router.get("/:id/fields", authMiddleware, platformsController.getFieldsByPlatformId);

module.exports = router;
