const prisma = require("../../config/prisma");

function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function ym(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function startOfMonth(d) {
    return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d) {
    // ayın son günü 23:59:59.999
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Hedef ayda gün taşması olursa (31 -> 30 gibi) clamp
function addMonthsClamped(date, monthsToAdd) {
    const y = date.getFullYear();
    const m = date.getMonth();
    const day = date.getDate();

    // önce hedef ayın 1'ine git
    const target = new Date(y, m + monthsToAdd, 1, 0, 0, 0, 0);
    // hedef ayın son gününü bul
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    // clamp
    target.setDate(Math.min(day, lastDay));
    return target;
}

function addYearsClamped(date, yearsToAdd) {
    return addMonthsClamped(date, yearsToAdd * 12);
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

// Subscription belirli ay aralığında "aktif" mi?
function isActiveInMonth(sub, monthStart, monthEnd) {
    if (sub.status !== "ACTIVE") return false;

    const s = sub.startDate ? new Date(sub.startDate) : null;
    const e = sub.endDate ? new Date(sub.endDate) : null;

    // startDate yoksa: güvenli tarafta kal
    if (!s) return false;

    // startDate ay bitişinden sonra ise aktif değil
    if (s.getTime() > monthEnd.getTime()) return false;

    // endDate ay başlangıcından önce ise aktif değil
    if (e && e.getTime() < monthStart.getTime()) return false;

    return true;
}

// Range içinde renewal tarihlerini üret (MVP: loop)
function getRenewalDatesInRange(sub, rangeStart, rangeEnd) {
    const s = sub.startDate ? new Date(sub.startDate) : null;
    if (!s) return [];

    const hardEnd = sub.endDate ? new Date(sub.endDate) : null;

    const unit = sub.repeatUnit; // MONTH/YEAR
    const interval = Number(sub.repeatInterval ?? 1);
    if (!unit || !Number.isInteger(interval) || interval < 1) return [];

    // ✅ İlk ödeme günü = startDate (istenirse 1 period sonrası yapılabilir)
    let cur = new Date(s);

    // rangeStart'tan önceyse ileri sar
    let guard = 0;
    while (cur.getTime() < rangeStart.getTime() && guard < 2000) {
        guard++;
        if (unit === "MONTH") cur = addMonthsClamped(cur, interval);
        else if (unit === "YEAR") cur = addYearsClamped(cur, interval);
        else return [];
    }

    // range içinde kalanları topla
    const dates = [];
    guard = 0;
    while (cur.getTime() <= rangeEnd.getTime() && guard < 2000) {
        guard++;

        if (hardEnd && cur.getTime() > hardEnd.getTime()) break;

        if (cur.getTime() >= rangeStart.getTime()) {
            dates.push(new Date(cur));
        }

        if (unit === "MONTH") cur = addMonthsClamped(cur, interval);
        else if (unit === "YEAR") cur = addYearsClamped(cur, interval);
        else break;
    }

    return dates;
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

async function getMyDashboardCharts({ userId, months }) {
    // Son N ay aralığı
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const fromMonthStart = addMonthsClamped(currentMonthStart, -(months - 1));

    // Bu endpoint için gerekli alanları çek
    const subs = await prisma.subscription.findMany({
        where: { userId },
        select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            amount: true,
            currency: true,
            repeatUnit: true,
            repeatInterval: true,
            platform: {
                select: { id: true, name: true, logoUrl: true },
            },
        },
    });

    // 1) Monthly spend trend
    const monthsList = [];
    for (let i = 0; i < months; i++) {
        const mStart = addMonthsClamped(fromMonthStart, i);
        monthsList.push({
            key: ym(mStart),
            start: startOfMonth(mStart),
            end: endOfMonth(mStart),
        });
    }

    const currencySeriesMap = new Map(); // currency -> Map(monthKey -> amount)
    for (const sub of subs) {
        const monthly = normalizeMonthlyAmount(sub);
        if (monthly == null) continue;

        const cur = String(sub.currency || "").trim().toUpperCase();
        if (!cur) continue;

        if (!currencySeriesMap.has(cur)) currencySeriesMap.set(cur, new Map());

        for (const m of monthsList) {
            if (!isActiveInMonth(sub, m.start, m.end)) continue;
            const mm = currencySeriesMap.get(cur);
            mm.set(m.key, safeNumber(mm.get(m.key) || 0) + safeNumber(monthly));
        }
    }

    const monthlySpendSeries = Array.from(currencySeriesMap.entries()).map(([currency, mm]) => ({
        currency,
        points: monthsList.map((m) => ({
            month: m.key,
            amount: safeNumber(mm.get(m.key) || 0),
        })),
    }));

    // 2) This month spend by platform (currency bazlı)
    const thisMonthStart = currentMonthStart;
    const thisMonthEnd = endOfMonth(now);

    const byPlatformMap = new Map(); // platformId -> { platform, currencies: Map }
    for (const sub of subs) {
        const monthly = normalizeMonthlyAmount(sub);
        if (monthly == null) continue;
        if (!isActiveInMonth(sub, thisMonthStart, thisMonthEnd)) continue;

        const cur = String(sub.currency || "").trim().toUpperCase();
        if (!cur) continue;

        const pid = sub.platform?.id || "unknown";
        if (!byPlatformMap.has(pid)) {
            byPlatformMap.set(pid, {
                platform: sub.platform || { id: pid, name: "Unknown", logoUrl: null },
                currencies: new Map(),
            });
        }

        const row = byPlatformMap.get(pid);
        row.currencies.set(cur, safeNumber(row.currencies.get(cur) || 0) + safeNumber(monthly));
    }

    const allCurrencies = new Set();
    for (const row of byPlatformMap.values()) {
        for (const c of row.currencies.keys()) allCurrencies.add(c);
    }

    const spendByPlatform = Array.from(allCurrencies).map((currency) => {
        const rows = [];
        for (const row of byPlatformMap.values()) {
            const amount = safeNumber(row.currencies.get(currency) || 0);
            if (amount > 0) {
                rows.push({
                    platformId: row.platform.id,
                    name: row.platform.name,
                    logoUrl: row.platform.logoUrl,
                    amount,
                });
            }
        }

        rows.sort((a, b) => b.amount - a.amount);

        const top = rows.slice(0, 5);
        const rest = rows.slice(5);
        const othersSum = rest.reduce((acc, x) => acc + safeNumber(x.amount), 0);

        const items =
            othersSum > 0
                ? [...top, { platformId: "others", name: "Others", logoUrl: null, amount: othersSum }]
                : top;

        return { currency, items };
    });

    // 3) Renewals per week (this month)
    const renewalsByWeek = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const sub of subs) {
        if (sub.status !== "ACTIVE") continue;

        const dates = getRenewalDatesInRange(sub, thisMonthStart, thisMonthEnd);

        for (const d of dates) {
            const day = d.getDate();
            const week = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
            renewalsByWeek[week] += 1;
        }
    }

    const renewalsThisMonth = Object.keys(renewalsByWeek).map((k) => ({
        week: Number(k),
        count: renewalsByWeek[k],
    }));

    return {
        range: {
            fromMonth: ym(fromMonthStart),
            toMonth: ym(thisMonthStart),
            months,
            thisMonth: ym(thisMonthStart),
        },
        monthlySpendSeries,
        spendByPlatform,
        renewalsThisMonth,
    };
}

module.exports = {
    getMyDashboardSummary,
    getMyDashboardCharts,
};
