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

async function getMyDashboardCharts(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Yetkisiz erişim." });

    const months = Number(req.query.months ?? 6);
    const safeMonths = Number.isInteger(months) && months >= 3 && months <= 24 ? months : 6;

    const data = await service.getMyDashboardCharts({ userId, months: safeMonths });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Dashboard charts error:", err?.message);
    console.error(err?.stack);
    console.error("Dashboard charts error:", err);
    return res.status(500).json({ message: "Dashboard chart verileri alınırken hata oluştu." });
  }
}

module.exports = {
  getMyDashboard,
  getMyDashboardCharts
};
