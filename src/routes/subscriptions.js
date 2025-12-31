const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const controller = require("../modules/subscription/subscription.controller");

const router = express.Router();

router.post("/", authMiddleware, controller.create);
router.get("/", authMiddleware, controller.listMine);

module.exports = router;
