const platformService = require("./platform.admin.service");

async function list(req, res) {
    try {
        const { search, status, page, limit } = req.query;

        const result = await platformService.listPlatforms({
            search,
            status,
            page,
            limit,
        });

        return res.status(200).json(result);
    } catch (err) {
        console.error("Admin platform list error:", err);
        return res.status(500).json({ message: "Platformlar alınırken bir hata oluştu." });
    }
}

async function getById(req, res) {
    try {
        const { id } = req.params;

        const platform = await platformService.getPlatformById(id);
        if (!platform) {
            return res.status(404).json({ message: "Platform bulunamadı." });
        }

        return res.status(200).json({ platform });
    } catch (err) {
        console.error("Admin platform getById error:", err);
        return res.status(500).json({ message: "Platform alınırken bir hata oluştu." });
    }
}

async function create(req, res) {
    try {
        const { name, slug, description, websiteUrl, logoUrl, status } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Platform adı zorunludur." });
        }

        const platform = await platformService.createPlatform({
            name,
            slug,
            description,
            websiteUrl,
            logoUrl,
            status,
            createdById: req.user.id, // authMiddleware set ediyor
        });

        return res.status(201).json({ platform });
    } catch (err) {
        console.error("Admin platform create error:", err);

        // Prisma unique slug hatası
        if (err.code === "P2002") {
            return res.status(409).json({ message: "Bu slug zaten kullanımda." });
        }

        return res.status(500).json({ message: "Platform oluşturulurken bir hata oluştu." });
    }
}

async function update(req, res) {
    try {
        const { id } = req.params;
        const { name, slug, description, websiteUrl, logoUrl, status } = req.body;

        const platform = await platformService.updatePlatform(id, {
            name,
            slug,
            description,
            websiteUrl,
            logoUrl,
            status,
        });

        return res.status(200).json({ platform });
    } catch (err) {
        console.error("Admin platform update error:", err);

        if (err.code === "P2002") {
            return res.status(409).json({ message: "Bu slug zaten kullanımda." });
        }

        // Prisma kaydı bulamadıysa genelde P2025 olur
        if (err.code === "P2025") {
            return res.status(404).json({ message: "Platform bulunamadı." });
        }

        return res.status(500).json({ message: "Platform güncellenirken bir hata oluştu." });
    }
}

async function remove(req, res) {
    try {
        const { id } = req.params;

        await platformService.deletePlatform(id);
        return res.status(200).json({ message: "Platform silindi." });
    } catch (err) {
        console.error("Admin platform delete error:", err);

        if (err.code === "P2025") {
            return res.status(404).json({ message: "Platform bulunamadı." });
        }

        return res.status(500).json({ message: "Platform silinirken bir hata oluştu." });
    }
}

module.exports = {
    list,
    getById,
    create,
    update,
    remove,
};
