const prisma = require("../../config/prisma");

function slugify(input) {
    return String(input || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")   // özel karakterleri at
        .replace(/\s+/g, "-")          // boşluk -> -
        .replace(/-+/g, "-");          // çoklu - -> tek
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
        where: { id: Number(id) },
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

module.exports = {
    listPlatforms,
    getPlatformById,
    createPlatform,
    updatePlatform,
    deletePlatform,
};
