const platformService = require("./platform.admin.service");
const isUuid = require("../../utils/isUuid");

function normalizeKey(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_ ]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_");
}

function isOptionType(type) {
    return type === "SELECT" || type === "MULTISELECT";
}

const allowedTypes = new Set([
    "TEXT",
    "NUMBER",
    "EMAIL",
    "PASSWORD",
    "TEXTAREA",
    "DATE",
    "CHECKBOX",
    "SELECT",
    "MULTISELECT",
]);

function validateCreateBody(body) {
    // body: { platform: {...}, fields: [...] }
    if (!body || typeof body !== "object") return "Geçersiz istek gövdesi.";

    const platform = body.platform;
    const fields = body.fields;

    if (!platform || typeof platform !== "object") return "platform alanı zorunludur.";
    if (!platform.name || !String(platform.name).trim()) return "Platform name zorunludur.";

    if (fields !== undefined && !Array.isArray(fields)) return "fields bir dizi olmalıdır.";

    if (!fields || fields.length === 0) return ""; // field zorunlu değilse problem yok

    const keySet = new Set();

    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const row = i + 1;

        if (!f || typeof f !== "object") return `Field #${row}: geçersiz.`;

        const key = normalizeKey(f.key);
        if (!key) return `Field #${row}: key zorunludur.`;
        if (keySet.has(key)) return `Field #${row}: key benzersiz olmalıdır.`;
        keySet.add(key);

        if (!f.label || !String(f.label).trim()) return `Field #${row}: label zorunludur.`;
        if (!f.type || !String(f.type).trim()) return `Field #${row}: type zorunludur.`;

        if (isOptionType(f.type)) {
            const opts = f.optionsJson;
            if (!Array.isArray(opts) || opts.length === 0) {
                return `Field #${row}: optionsJson (options) zorunludur.`;
            }
            const valueSet = new Set();
            for (let j = 0; j < opts.length; j++) {
                const opt = opts[j];
                const optRow = j + 1;
                if (!opt || typeof opt !== "object") return `Field #${row} Option #${optRow}: geçersiz.`;
                if (!opt.label || !String(opt.label).trim()) return `Field #${row} Option #${optRow}: label zorunludur.`;
                if (!opt.value || !String(opt.value).trim()) return `Field #${row} Option #${optRow}: value zorunludur.`;
                const v = String(opt.value).trim();
                if (valueSet.has(v)) return `Field #${row}: option value benzersiz olmalıdır.`;
                valueSet.add(v);
            }
        }
    }

    return "";
}

function validateUpsertBody(body) {
    if (!body || typeof body !== "object") return "Geçersiz istek gövdesi.";
    const platform = body.platform;
    const fields = body.fields;

    if (!platform || typeof platform !== "object") return "platform alanı zorunludur.";
    if (!platform.name || !String(platform.name).trim()) return "Platform name zorunludur.";
    if (fields !== undefined && !Array.isArray(fields)) return "fields bir dizi olmalıdır.";

    if (!fields || fields.length === 0) return "";

    const keySet = new Set();

    for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const row = i + 1;

        if (!f || typeof f !== "object") return `Field #${row}: geçersiz.`;

        const key = normalizeKey(f.key);
        if (!key) return `Field #${row}: key zorunludur.`;
        if (keySet.has(key)) return `Field #${row}: key benzersiz olmalıdır.`;
        keySet.add(key);

        if (!f.label || !String(f.label).trim()) return `Field #${row}: label zorunludur.`;
        if (!f.type || !String(f.type).trim()) return `Field #${row}: type zorunludur.`;
        if (!allowedTypes.has(f.type)) return `Field #${row}: geçersiz type.`;

        if (isOptionType(f.type)) {
            const opts = f.optionsJson;
            if (!Array.isArray(opts) || opts.length === 0) {
                return `Field #${row}: options zorunludur.`;
            }
            const valueSet = new Set();
            for (let j = 0; j < opts.length; j++) {
                const opt = opts[j];
                const optRow = j + 1;

                if (!opt || typeof opt !== "object") return `Field #${row} Option #${optRow}: geçersiz.`;
                if (!opt.label || !String(opt.label).trim()) return `Field #${row} Option #${optRow}: label zorunludur.`;
                if (!opt.value || !String(opt.value).trim()) return `Field #${row} Option #${optRow}: value zorunludur.`;

                const v = String(opt.value).trim();
                if (valueSet.has(v)) return `Field #${row}: option value benzersiz olmalıdır.`;
                valueSet.add(v);
            }
        }
    }

    return "";
}

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
        const id = req.params.id;
        if (!isUuid(id)) {
            return res.status(400).json({ message: "Geçersiz platform ID." });
        }

        const platform = await platformService.getPlatformById(id);
        if (!platform) {
            return res.status(404).json({ message: "Platform bulunamadı." });
        }

        return res.status(200).json({ platform });
    } catch (err) {
        console.error("Admin platform getById error:", err);
        return res.status(500).json({ message: "Platform alınırken hata oluştu." });
    }
}

async function updateById(req, res) {
    try {
        const id = req.params.id;
        if (!isUuid(id)) {
            return res.status(400).json({ message: "Geçersiz platform ID." });
        }

        const existing = await platformService.getPlatformById(id);
        if (!existing) {
            return res.status(404).json({ message: "Platform bulunamadı." });
        }

        const validationError = validateUpsertBody(req.body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const p = req.body.platform;
        const fields = req.body.fields || [];

        const updated = await platformService.updatePlatformWithFieldsById({
            id,
            platform: {
                name: String(p.name).trim(),
                slug: p.slug ? String(p.slug).trim() : "",
                description: p.description ? String(p.description).trim() : "",
                websiteUrl: p.websiteUrl ? String(p.websiteUrl).trim() : "",
                logoUrl: p.logoUrl ? String(p.logoUrl).trim() : "",
                status: p.status || "ACTIVE",
            },
            fields: fields.map((f, idx) => ({
                key: f.key,
                label: String(f.label).trim(),
                type: f.type,
                required: !!f.required,
                order: typeof f.order === "number" ? f.order : idx + 1,
                optionsJson: f.optionsJson ?? null,
            })),
        });

        return res.status(200).json({ platform: updated });
    } catch (err) {
        console.error("Admin platform updateById error:", err);

        if (err.code === "P2002") {
            // slug unique veya (platformId,key) unique çakışması
            return res.status(409).json({ message: "Benzersiz alan çakışması (slug veya field key) oluştu." });
        }

        return res.status(500).json({ message: "Platform güncellenirken hata oluştu." });
    }
}

async function create(req, res) {
    try {
        // Yeni format: { platform: {...}, fields: [...] }
        const body = req.body;

        const validationError = validateCreateBody(body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const platform = body.platform;
        const fields = body.fields || [];

        const created = await platformService.createPlatformWithFields({
            platform: {
                name: String(platform.name).trim(),
                slug: platform.slug ? String(platform.slug).trim() : "",
                description: platform.description ? String(platform.description).trim() : "",
                websiteUrl: platform.websiteUrl ? String(platform.websiteUrl).trim() : "",
                logoUrl: platform.logoUrl ? String(platform.logoUrl).trim() : "",
                status: platform.status || "ACTIVE",
            },
            fields: fields.map((f, idx) => ({
                key: f.key,
                label: String(f.label).trim(),
                type: f.type,
                required: !!f.required,
                order: typeof f.order === "number" ? f.order : idx + 1,
                optionsJson: f.optionsJson ?? null,
            })),
            createdById: req.user.id,
        });

        return res.status(201).json({ platform: created });
    } catch (err) {
        console.error("Admin platform create (with fields) error:", err);

        // Prisma unique slug
        if (err.code === "P2002") {
            // platform.slug veya field unique (platformId,key) olabilir
            return res.status(409).json({ message: "Benzersiz alan çakışması (slug veya field key) oluştu." });
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

        if (!isUuid(id)) {
            return res.status(400).json({ message: "Geçersiz platform ID." });
        }

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
    updateById,
    create,
    update,
    remove,
};
