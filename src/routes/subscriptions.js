const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const controller = require("../modules/subscription/subscription.controller");

const router = express.Router();

router.post("/", authMiddleware, controller.create);
router.get("/", authMiddleware, controller.listMine);
router.get("/:id", authMiddleware, controller.getMineById);
router.patch("/:id", authMiddleware, controller.updateMineById);
router.delete("/:id", authMiddleware, controller.deleteMineById);

module.exports = router;
