const prisma = require("../../config/prisma");

function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

// Yeni sistem: repeatUnit/repeatInterval ile aylık normalize
function normalizeMonthlyAmount(sub) {
    if (sub.amount == null || !sub.currency) return null;

    const amount = Number(sub.amount);
    if (!Number.isFinite(amount) || amount < 0) return null;

    const interval = Number(sub.repeatInterval ?? 1);
    if (!Number.isInteger(interval) || interval < 1) return null;

    const unit = sub.repeatUnit; // "MONTH" | "YEAR"
    if (unit === "MONTH") return amount / interval;
    if (unit === "YEAR") return amount / (12 * interval);

    return null;
}

async function getMyDashboardSummary(userId) {
    // ✅ count+distinct yerine güvenli yöntem
    const [totalSubscriptions, activeSubscriptions, uniquePlatformRows] = await Promise.all([
        prisma.subscription.count({ where: { userId } }),
        prisma.subscription.count({ where: { userId, status: "ACTIVE" } }),
        prisma.subscription.findMany({
            where: { userId },
            distinct: ["platformId"],
            select: { platformId: true },
        }),
    ]);

    const uniquePlatforms = uniquePlatformRows.length;

    const recent = await prisma.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
            id: true,
            status: true,
            createdAt: true,
            startDate: true,
            endDate: true,
            repeatUnit: true,
            repeatInterval: true,
            amount: true,
            currency: true,
            platform: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                },
            },
            values: { select: { id: true } }, // count için
        },
    });

    let monthlySpend = null;

    const allActiveWithAmount = await prisma.subscription.findMany({
        where: {
            userId,
            status: "ACTIVE",
            amount: { not: null },
            currency: { not: null },
        },
        select: {
            amount: true,
            currency: true,
            repeatUnit: true,
            repeatInterval: true,
        },
    });

    const currencySet = new Set(allActiveWithAmount.map((x) => x.currency).filter(Boolean));

    if (currencySet.size <= 1) {
        const currency = currencySet.size === 1 ? [...currencySet][0] : "";
        const sumMonthly = allActiveWithAmount.reduce((acc, s) => {
            const m = normalizeMonthlyAmount(s);
            return acc + (m == null ? 0 : safeNumber(m));
        }, 0);

        monthlySpend = { amount: sumMonthly, currency };
    }

    return {
        stats: {
            totalSubscriptions,
            activeSubscriptions,
            uniquePlatforms,
            monthlySpend,
        },
        recentSubscriptions: recent.map((s) => ({
            id: s.id,
            status: s.status,
            createdAt: s.createdAt,
            startDate: s.startDate,
            endDate: s.endDate,
            repeatUnit: s.repeatUnit,
            repeatInterval: s.repeatInterval,
            amount: s.amount,
            currency: s.currency,
            platform: s.platform,
            fieldsCount: Array.isArray(s.values) ? s.values.length : 0,
        })),
    };
}

module.exports = { getMyDashboardSummary };
