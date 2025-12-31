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
            },
        });

        return res.status(200).json({ items });
    } catch (err) {
        console.error("listActive error:", err);
        return res.status(500).json({ message: "Platformlar alınırken hata oluştu." });
    }
}

async function getFieldsByPlatformId(req, res) {
    try {
        const platformId = String(req.params.id || "").trim();

        // UUID doğrulama yapmak istersen burada isUuid ile kontrol edebilirsin.
        const platform = await prisma.platform.findUnique({
            where: { id: platformId },
            select: {
                id: true,
                name: true,
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
            fields: platform.fields,
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
