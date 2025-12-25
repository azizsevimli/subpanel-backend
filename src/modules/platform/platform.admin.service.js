const prisma = require("../../config/prisma");

function slugify(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

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

async function listPlatforms({ search, status, page = 1, limit = 20 }) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Number(page) - 1) * take;

    const where = {};

    if (status) {
        where.status = status; // "ACTIVE" | "INACTIVE"
    }

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
            },
        }),
        prisma.platform.count({ where }),
    ]);

    return {
        items,
        meta: {
            total,
            page: Number(page),
            limit: take,
            totalPages: Math.ceil(total / take),
        },
    };
}

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

async function updatePlatformWithFieldsById({ id, platform, fields }) {
    const finalSlug =
        platform.slug && String(platform.slug).trim()
            ? slugify(platform.slug)
            : slugify(platform.name);

    return prisma.$transaction(async (tx) => {
        // 1) platform update
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

        // 2) fields replace
        await tx.platformField.deleteMany({
            where: { platformId: id },
        });

        if (Array.isArray(fields) && fields.length > 0) {
            const rows = fields.map((f, idx) => {
                const key = normalizeKey(f.key);

                const base = {
                    platformId: id,
                    key,
                    label: f.label,
                    type: f.type,
                    required: !!f.required,
                    order: typeof f.order === "number" ? f.order : idx + 1,
                };

                if (isOptionType(f.type)) {
                    return {
                        ...base,
                        optionsJson: f.optionsJson || [],
                    };
                }

                return {
                    ...base,
                    optionsJson: null,
                };
            });

            await tx.platformField.createMany({
                data: rows,
            });
        }

        // 3) geri dön: platform + fields
        const updated = await tx.platform.findUnique({
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

        return updated;
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
        where: { id: Number(id) },
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
    // Şimdilik hard delete. İstersen soft delete'e çevirebiliriz.
    return prisma.platform.delete({
        where: { id: Number(id) },
        select: { id: true },
    });
}

async function createPlatformWithFields({ platform, fields, createdById }) {
    const finalSlug = slugify(platform.slug || platform.name);

    // Transaction: platform + fields birlikte
    return prisma.$transaction(async (tx) => {
        const createdPlatform = await tx.platform.create({
            data: {
                name: platform.name,
                slug: finalSlug,
                description: platform.description || null,
                websiteUrl: platform.websiteUrl || null,
                logoUrl: platform.logoUrl || null,
                status: platform.status || "ACTIVE",
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

        if (fields && fields.length > 0) {
            // order ve key normalize + optionsJson normalize
            const rows = fields.map((f, idx) => {
                const key = normalizeKey(f.key);
                const base = {
                    platformId: createdPlatform.id,
                    key,
                    label: f.label,
                    type: f.type,
                    required: !!f.required,
                    order: typeof f.order === "number" ? f.order : idx + 1,
                };

                if (isOptionType(f.type)) {
                    return {
                        ...base,
                        optionsJson: f.optionsJson || [],
                    };
                }

                return {
                    ...base,
                    optionsJson: null,
                };
            });

            await tx.platformField.createMany({
                data: rows,
            });
        }

        // Platform + fields birlikte dönmek istersen:
        const platformWithFields = await tx.platform.findUnique({
            where: { id: createdPlatform.id },
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
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        return platformWithFields;
    });
}

module.exports = {
    listPlatforms,
    getPlatformById,
    updatePlatformWithFieldsById,
    createPlatform,
    updatePlatform,
    deletePlatform,
    createPlatformWithFields,
};
