// /modules/platform/platform.public.controller.js
const prisma = require("../../config/prisma");

async function listActive(req, res) {
    try {
        const items = await prisma.platform.findMany({
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,

                // ✅ UI isterse "bu platformda aktif plan var mı?" gösterebilir
                plans: {
                    where: { isActive: true },
                    select: { id: true }, // sadece saymak için
                },
            },
        });

        return res.status(200).json({
            items: items.map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                logoUrl: p.logoUrl,
                activePlansCount: Array.isArray(p.plans) ? p.plans.length : 0,
            })),
        });
    } catch (err) {
        console.error("listActive error:", err);
        return res.status(500).json({ message: "Platformlar alınırken hata oluştu." });
    }
}

async function getFieldsByPlatformId(req, res) {
    try {
        const platformId = String(req.params.id || "").trim();

        const platform = await prisma.platform.findUnique({
            where: { id: platformId },
            select: {
                id: true,
                name: true,

                // ✅ AKTİF PLANLAR
                plans: {
                    where: { isActive: true },
                    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        order: true,
                    },
                },

                // ✅ EKSTRA FIELDS (sen şimdilik tutuyorsun)
                fields: {
                    orderBy: { order: "asc" },
                    select: {
                        id: true,
                        key: true,
                        label: true,
                        type: true,
                        required: true,
                        optionsJson: true,
                        order: true,
                    },
                },
            },
        });

        if (!platform) {
            return res.status(404).json({ message: "Platform bulunamadı." });
        }

        return res.status(200).json({
            platform: { id: platform.id, name: platform.name },
            plans: platform.plans || [], // ✅ yeni
            fields: platform.fields || [],
        });
    } catch (err) {
        console.error("getFieldsByPlatformId error:", err);
        return res.status(500).json({ message: "Platform alanları alınırken hata oluştu." });
    }
}

module.exports = {
    listActive,
    getFieldsByPlatformId,
};
