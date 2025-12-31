const prisma = require("../../config/prisma");

function isOptionType(type) {
    return type === "SELECT" || type === "MULTISELECT";
}

async function createSubscription({ userId, platformId, values }) {
    // platform + fields çek (validasyon için)
    const platform = await prisma.platform.findUnique({
        where: { id: platformId },
        select: {
            id: true,
            status: true,
            fields: {
                orderBy: { order: "asc" },
                select: { id: true, key: true, type: true, required: true, optionsJson: true },
            },
        },
    });

    if (!platform) {
        const e = new Error("PLATFORM_NOT_FOUND");
        e.code = "PLATFORM_NOT_FOUND";
        throw e;
    }

    if (platform.status !== "ACTIVE") {
        const e = new Error("PLATFORM_INACTIVE");
        e.code = "PLATFORM_INACTIVE";
        throw e;
    }

    // values: [{ platformFieldId, value }]
    // field id -> field map
    const fieldMap = new Map(platform.fields.map((f) => [f.id, f]));

    // required kontrolü: required field’ların value’su gelmiş mi?
    for (const f of platform.fields) {
        if (!f.required) continue;
        const found = values.find((v) => v.platformFieldId === f.id);
        if (!found || found.value === undefined || found.value === null || found.value === "") {
            const e = new Error(`REQUIRED_FIELD_MISSING:${f.key}`);
            e.code = "REQUIRED_FIELD_MISSING";
            e.meta = { key: f.key };
            throw e;
        }
    }

    // payload normalize
    const normalized = values
        .filter((v) => fieldMap.has(v.platformFieldId))
        .map((v) => {
            const f = fieldMap.get(v.platformFieldId);

            // valueJson tipi: her şeyi JSON olarak saklıyoruz (string/number/bool/array)
            let valueJson = v.value;

            // MULTISELECT için array bekleyelim
            if (f.type === "MULTISELECT") {
                if (!Array.isArray(valueJson)) valueJson = [];
            }

            // CHECKBOX bool
            if (f.type === "CHECKBOX") {
                valueJson = !!valueJson;
            }

            // NUMBER number
            if (f.type === "NUMBER") {
                const n = Number(valueJson);
                valueJson = Number.isFinite(n) ? n : null;
            }

            // DATE string (YYYY-MM-DD) sakla
            if (f.type === "DATE") {
                valueJson = valueJson ? String(valueJson) : null;
            }

            // SELECT/MULTISELECT option doğrulaması (basic)
            if (isOptionType(f.type)) {
                const opts = Array.isArray(f.optionsJson) ? f.optionsJson : [];
                const allowed = new Set(opts.map((o) => String(o.value)));
                if (f.type === "SELECT") {
                    if (valueJson != null && valueJson !== "" && !allowed.has(String(valueJson))) {
                        valueJson = null;
                    }
                } else {
                    valueJson = (Array.isArray(valueJson) ? valueJson : [])
                        .map(String)
                        .filter((x) => allowed.has(x));
                }
            }

            return { platformFieldId: v.platformFieldId, valueJson };
        });

    // Transaction: subscription + field values
    return prisma.$transaction(async (tx) => {
        const sub = await tx.subscription.create({
            data: {
                userId,
                platformId,
            },
            select: { id: true, userId: true, platformId: true, createdAt: true },
        });

        if (normalized.length > 0) {
            await tx.subscriptionFieldValue.createMany({
                data: normalized.map((n) => ({
                    subscriptionId: sub.id,
                    platformFieldId: n.platformFieldId,
                    valueJson: n.valueJson,
                })),
            });
        }

        return sub;
    });
}

async function listMySubscriptions(userId) {
    const subs = await prisma.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            platform: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    status: true,
                },
            },
            values: {
                select: {
                    id: true,
                    valueJson: true,
                    platformField: {
                        select: {
                            id: true,
                            key: true,
                            label: true,
                            type: true,
                            required: true,
                            order: true,
                        },
                    },
                },
                orderBy: {
                    platformField: { order: "asc" },
                },
            },
        },
    });

    // UI için daha rahat shape (isteğe bağlı)
    return subs.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        platform: s.platform,
        fields: s.values.map((v) => ({
            fieldId: v.platformField.id,
            key: v.platformField.key,
            label: v.platformField.label,
            type: v.platformField.type,
            required: v.platformField.required,
            order: v.platformField.order,
            value: v.valueJson,
        })),
    }));
}

module.exports = {
    createSubscription,
    listMySubscriptions,
};