const prisma = require("../../config/prisma");

function slugify(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

// PlatformField için (extra alanlar)
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

function normalizePlanName(input) {
    return String(input || "").trim();
}

function normalizeOrderOrDefault(v, def) {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
}

/**
 * ✅ Admin list: platform + basic info + plansCount
 */
async function listPlatforms({ search, status, page = 1, limit = 20 }) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Number(page) - 1) * take;

    const where = {};
    if (status) where.status = status;

    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
        ];
    }

    const [items, total] = await Promise.all([
        prisma.platform.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take,
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                websiteUrl: true,
                logoUrl: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                createdById: true,
                createdBy: {
                    select: { id: true, email: true, name: true, surname: true, role: true },
                },
                _count: { select: { plans: true } },
            },
        }),
        prisma.platform.count({ where }),
    ]);

    return {
        items: items.map((p) => ({
            ...p,
            plansCount: p._count?.plans ?? 0,
            _count: undefined,
        })),
        meta: {
            total,
            page: Number(page),
            limit: take,
            totalPages: Math.ceil(total / take),
        },
    };
}

/**
 * ✅ Admin detail: platform + plans + fields
 */
async function getPlatformById(id) {
    return prisma.platform.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            plans: {
                orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                select: {
                    id: true,
                    platformId: true,
                    name: true,
                    isActive: true,
                    order: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            fields: {
                orderBy: { order: "asc" },
                select: {
                    id: true,
                    platformId: true,
                    key: true,
                    label: true,
                    type: true,
                    required: true,
                    optionsJson: true,
                    order: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
        },
    });
}

async function createPlatform({ name, slug, description, websiteUrl, logoUrl, status, createdById }) {
    const finalSlug = slugify(slug || name);

    return prisma.platform.create({
        data: {
            name,
            slug: finalSlug,
            description: description || null,
            websiteUrl: websiteUrl || null,
            logoUrl: logoUrl || null,
            status: status || "ACTIVE",
            createdById: createdById || null,
        },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

/**
 * ✅ Platform + Plans + (opsiyonel) Fields create (tek transaction)
 * - plans default isActive: false
 */
async function createPlatformWithPlansAndFields({ platform, plans = [], fields = [], createdById }) {
    const finalSlug = slugify(platform.slug || platform.name);

    return prisma.$transaction(async (tx) => {
        const created = await tx.platform.create({
            data: {
                name: platform.name,
                slug: finalSlug,
                description: platform.description || null,
                websiteUrl: platform.websiteUrl || null,
                logoUrl: platform.logoUrl || null,
                status: platform.status || "ACTIVE",
                createdById: createdById || null,
            },
            select: { id: true },
        });

        // ✅ Plans
        if (Array.isArray(plans) && plans.length > 0) {
            const planRows = plans
                .map((p, idx) => {
                    const name = normalizePlanName(p?.name);
                    if (!name) return null;

                    return {
                        platformId: created.id,
                        name,
                        // ✅ UI boş gönderirse false
                        isActive: typeof p.isActive === "boolean" ? p.isActive : false,
                        order: normalizeOrderOrDefault(p.order, idx + 1),
                    };
                })
                .filter(Boolean);

            if (planRows.length > 0) {
                await tx.platformPlan.createMany({ data: planRows });
            }
        }

        // ✅ Fields (opsiyonel)
        if (Array.isArray(fields) && fields.length > 0) {
            const fieldRows = fields
                .map((f, idx) => {
                    const key = normalizeKey(f.key);
                    const label = String(f.label || "").trim();
                    const type = String(f.type || "").trim();

                    // boş satırları DB’ye yazmayalım
                    if (!key || !label || !type) return null;

                    const base = {
                        platformId: created.id,
                        key,
                        label,
                        type,
                        required: !!f.required,
                        order: normalizeOrderOrDefault(f.order, idx + 1),
                    };

                    if (isOptionType(type)) {
                        return { ...base, optionsJson: Array.isArray(f.optionsJson) ? f.optionsJson : [] };
                    }
                    return { ...base, optionsJson: null };
                })
                .filter(Boolean);

            if (fieldRows.length > 0) {
                await tx.platformField.createMany({ data: fieldRows });
            }
        }

        return tx.platform.findUnique({
            where: { id: created.id },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                websiteUrl: true,
                logoUrl: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                plans: {
                    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                    select: { id: true, name: true, isActive: true, order: true, createdAt: true, updatedAt: true },
                },
                fields: {
                    orderBy: { order: "asc" },
                    select: { id: true, key: true, label: true, type: true, required: true, optionsJson: true, order: true, createdAt: true, updatedAt: true },
                },
            },
        });
    });
}

/**
 * ✅ Platform + Plans + (opsiyonel) Fields update (replace stratejisi)
 * - plans default isActive: false
 */
async function updatePlatformWithPlansAndFieldsById({ id, platform, plans = [], fields = [] }) {
    const finalSlug =
        platform.slug && String(platform.slug).trim() ? slugify(platform.slug) : slugify(platform.name);

    return prisma.$transaction(async (tx) => {
        await tx.platform.update({
            where: { id },
            data: {
                name: platform.name,
                slug: finalSlug,
                description: platform.description || null,
                websiteUrl: platform.websiteUrl || null,
                logoUrl: platform.logoUrl || null,
                status: platform.status || "ACTIVE",
            },
        });

        // ✅ Plans replace
        await tx.platformPlan.deleteMany({ where: { platformId: id } });

        if (Array.isArray(plans) && plans.length > 0) {
            const planRows = plans
                .map((p, idx) => {
                    const name = normalizePlanName(p?.name);
                    if (!name) return null;

                    return {
                        platformId: id,
                        name,
                        isActive: typeof p.isActive === "boolean" ? p.isActive : false,
                        order: normalizeOrderOrDefault(p.order, idx + 1),
                    };
                })
                .filter(Boolean);

            if (planRows.length > 0) {
                await tx.platformPlan.createMany({ data: planRows });
            }
        }

        // ✅ Fields replace (opsiyonel)
        await tx.platformField.deleteMany({ where: { platformId: id } });

        if (Array.isArray(fields) && fields.length > 0) {
            const fieldRows = fields
                .map((f, idx) => {
                    const key = normalizeKey(f.key);
                    const label = String(f.label || "").trim();
                    const type = String(f.type || "").trim();

                    if (!key || !label || !type) return null;

                    const base = {
                        platformId: id,
                        key,
                        label,
                        type,
                        required: !!f.required,
                        order: normalizeOrderOrDefault(f.order, idx + 1),
                    };

                    if (isOptionType(type)) {
                        return { ...base, optionsJson: Array.isArray(f.optionsJson) ? f.optionsJson : [] };
                    }
                    return { ...base, optionsJson: null };
                })
                .filter(Boolean);

            if (fieldRows.length > 0) {
                await tx.platformField.createMany({ data: fieldRows });
            }
        }

        return tx.platform.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                websiteUrl: true,
                logoUrl: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                plans: {
                    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
                    select: { id: true, name: true, isActive: true, order: true, createdAt: true, updatedAt: true },
                },
                fields: {
                    orderBy: { order: "asc" },
                    select: { id: true, key: true, label: true, type: true, required: true, optionsJson: true, order: true, createdAt: true, updatedAt: true },
                },
            },
        });
    });
}

async function updatePlatform(id, { name, slug, description, websiteUrl, logoUrl, status }) {
    const data = {};

    if (typeof name === "string") data.name = name;
    if (typeof slug === "string") data.slug = slugify(slug);
    if (description !== undefined) data.description = description || null;
    if (websiteUrl !== undefined) data.websiteUrl = websiteUrl || null;
    if (logoUrl !== undefined) data.logoUrl = logoUrl || null;
    if (typeof status === "string") data.status = status;

    return prisma.platform.update({
        where: { id },
        data,
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
        },
    });
}

async function deletePlatform(id) {
    return prisma.platform.delete({
        where: { id },
        select: { id: true },
    });
}

module.exports = {
    listPlatforms,
    getPlatformById,
    createPlatform,
    updatePlatform,
    deletePlatform,
    createPlatformWithPlansAndFields,
    updatePlatformWithPlansAndFieldsById,
};
