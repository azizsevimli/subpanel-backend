const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const controller = require("../modules/dashboard/dashboard.controller");

const router = express.Router();

router.get("/", authMiddleware, controller.getMyDashboard);

module.exports = router;
