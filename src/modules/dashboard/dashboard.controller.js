const service = require("./dashboard.service");

async function getMyDashboard(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Yetkisiz erişim." });
    }

    const data = await service.getMyDashboardSummary(userId);

    return res.status(200).json(data);
  } catch (err) {
    console.error("Dashboard error:", err);
    return res.status(500).json({ message: "Dashboard verisi alınırken hata oluştu." });
  }
}

module.exports = { getMyDashboard };
