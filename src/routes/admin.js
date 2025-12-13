const express = require("express");
const adminController = require("../modules/admin/admin.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");

const router = express.Router();

router.get("/users", authMiddleware, adminMiddleware, adminController.listUsers);
router.post("/users", authMiddleware, adminMiddleware, adminController.createAdmin);

module.exports = router;
