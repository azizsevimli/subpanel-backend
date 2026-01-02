const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const controller = require("../modules/calendar/calendar.controller");

const router = express.Router();

router.get("/events", authMiddleware, controller.getEvents);

module.exports = router;
