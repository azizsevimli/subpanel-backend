const service = require("./subscription.service");

async function create(req, res) {
  try {
    const userId = req.user.id;
    const { platformId, values } = req.body;

    if (!platformId) return res.status(400).json({ message: "platformId zorunludur." });
    if (!Array.isArray(values)) return res.status(400).json({ message: "values bir dizi olmalıdır." });

    const created = await service.createSubscription({
      userId,
      platformId: String(platformId).trim(),
      values,
    });

    return res.status(201).json({ subscription: created });
  } catch (err) {
    console.error("Create subscription error:", err);

    if (err.code === "P2002") {
      return res.status(409).json({ message: "Benzersiz alan çakışması oluştu." });
    }

    if (err.code === "PLATFORM_NOT_FOUND") {
      return res.status(404).json({ message: "Platform bulunamadı." });
    }

    if (err.code === "PLATFORM_INACTIVE") {
      return res.status(400).json({ message: "Platform aktif değil." });
    }

    if (err.code === "REQUIRED_FIELD_MISSING") {
      return res.status(400).json({ message: `Zorunlu alan eksik: ${err.meta?.key || ""}`.trim() });
    }

    return res.status(500).json({ message: "Subscription oluşturulurken hata oluştu." });
  }
}

async function listMine(req, res) {
  try {
    const userId = req.user.id;

    const items = await service.listMySubscriptions(userId);

    return res.status(200).json({ items });
  } catch (err) {
    console.error("List subscriptions error:", err);
    return res.status(500).json({ message: "Abonelikler alınırken hata oluştu." });
  }
}

module.exports = {
  create,
  listMine
};
