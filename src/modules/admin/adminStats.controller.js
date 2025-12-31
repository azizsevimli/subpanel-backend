const prisma = require("../../config/prisma");

async function getStats(req, res) {
    try {
        const [
            totalUsers,
            totalAdmins,
            totalPlatforms,
            totalSubscriptions,
            activePlatforms,
            inactivePlatforms,
        ] = await Promise.all([
            prisma.user.count({ where: { role: "USER" } }),
            prisma.user.count({ where: { role: "ADMIN" } }),
            prisma.platform.count(),
            prisma.subscription.count(),
            prisma.platform.count({ where: { status: "ACTIVE" } }),
            prisma.platform.count({ where: { status: "INACTIVE" } }),
        ]);

        return res.status(200).json({
            stats: {
                totalUsers,
                totalAdmins,
                totalPlatforms,
                totalSubscriptions,
                activePlatforms,
                inactivePlatforms,
            },
        });
    } catch (err) {
        console.error("Admin stats error:", err);
        return res.status(500).json({ message: "Stats alınırken hata oluştu." });
    }
}

module.exports = { getStats };
