const express = require("express");
const controller = require("../modules/password/password.controller");

const router = express.Router();

// public
router.post("/forgot", controller.forgotPassword);
router.post("/reset", controller.resetPassword);

module.exports = router;
