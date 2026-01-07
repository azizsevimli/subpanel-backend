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

function normalizeOrder(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function validatePlans(plans) {
    if (plans === undefined) return ""; // optional
    if (!Array.isArray(plans)) return "plans bir dizi olmalıdır.";

    const nameSet = new Set();
    for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        const row = i + 1;

        if (!p || typeof p !== "object") return `Plan #${row}: geçersiz.`;
        if (!p.name || !String(p.name).trim()) return `Plan #${row}: name zorunludur.`;

        const name = String(p.name).trim();
        const lower = name.toLowerCase();
        if (nameSet.has(lower)) return `Plan #${row}: plan adı benzersiz olmalıdır.`;
        nameSet.add(lower);

        if (p.isActive !== undefined && typeof p.isActive !== "boolean") {
            return `Plan #${row}: isActive boolean olmalıdır.`;
        }
        if (p.order !== undefined && !Number.isFinite(Number(p.order))) {
            return `Plan #${row}: order sayı olmalıdır.`;
        }
    }

    return "";
}

function validateCreateBody(body) {
    if (!body || typeof body !== "object") return "Geçersiz istek gövdesi.";

    const platform = body.platform;
    const fields = body.fields;
    const plans = body.plans;

    if (!platform || typeof platform !== "object") return "platform alanı zorunludur.";
    if (!platform.name || !String(platform.name).trim()) return "Platform name zorunludur.";

    if (fields !== undefined && !Array.isArray(fields)) return "fields bir dizi olmalıdır.";

    const plansErr = validatePlans(plans);
    if (plansErr) return plansErr;

    // fields opsiyonel
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
    return validateCreateBody(body);
}

// ------- helpers: payload clean -------
function cleanPlans(plans = []) {
    if (!Array.isArray(plans)) return [];
    const out = [];
    for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        const name = String(p?.name || "").trim();
        if (!name) continue;

        out.push({
            name,
            isActive: typeof p.isActive === "boolean" ? p.isActive : false, // default false
            order: normalizeOrder(p.order, i + 1),
        });
    }
    return out;
}

function cleanFields(fields = []) {
    if (!Array.isArray(fields)) return [];

    // boş/yarım satırları at
    const filtered = fields.filter((f) => {
        if (!f || typeof f !== "object") return false;
        const key = normalizeKey(f.key);
        const label = String(f.label || "").trim();
        const type = String(f.type || "").trim();
        const hasOptions = Array.isArray(f.optionsJson) && f.optionsJson.length > 0;
        const required = !!f.required;

        const hasAny = !!key || !!label || !!type || hasOptions || required;
        return hasAny;
    });

    return filtered.map((f, idx) => ({
        key: normalizeKey(f.key),
        label: String(f.label || "").trim(),
        type: f.type,
        required: !!f.required,
        order: normalizeOrder(f.order, idx + 1),
        optionsJson: f.optionsJson ?? null,
    }));
}

// ------- controllers -------
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

async function create(req, res) {
    try {
        const body = req.body;

        const validationError = validateCreateBody(body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const p = body.platform;
        const fields = cleanFields(body.fields || []);
        const plans = cleanPlans(body.plans || []);

        const created = await platformService.createPlatformWithPlansAndFields({
            platform: {
                name: String(p.name).trim(),
                slug: p.slug ? String(p.slug).trim() : "",
                description: p.description ? String(p.description).trim() : "",
                websiteUrl: p.websiteUrl ? String(p.websiteUrl).trim() : "",
                logoUrl: p.logoUrl ? String(p.logoUrl).trim() : "",
                status: p.status || "ACTIVE",
            },
            plans,
            fields,
            createdById: req.user.id,
        });

        return res.status(201).json({ platform: created });
    } catch (err) {
        console.error("Admin platform create error:", err);

        if (err.code === "P2002") {
            return res.status(409).json({ message: "Benzersiz alan çakışması (slug veya plan/field name) oluştu." });
        }

        return res.status(500).json({ message: "Platform oluşturulurken bir hata oluştu." });
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
        const fields = cleanFields(req.body.fields || []);
        const plans = cleanPlans(req.body.plans || []);

        const updated = await platformService.updatePlatformWithPlansAndFieldsById({
            id,
            platform: {
                name: String(p.name).trim(),
                slug: p.slug ? String(p.slug).trim() : "",
                description: p.description ? String(p.description).trim() : "",
                websiteUrl: p.websiteUrl ? String(p.websiteUrl).trim() : "",
                logoUrl: p.logoUrl ? String(p.logoUrl).trim() : "",
                status: p.status || "ACTIVE",
            },
            plans,
            fields,
        });

        return res.status(200).json({ platform: updated });
    } catch (err) {
        console.error("Admin platform updateById error:", err);

        if (err.code === "P2002") {
            return res.status(409).json({ message: "Benzersiz alan çakışması (slug veya plan/field name) oluştu." });
        }

        return res.status(500).json({ message: "Platform güncellenirken hata oluştu." });
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
    remove,
};
