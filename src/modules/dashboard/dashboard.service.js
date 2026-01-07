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
    return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonthsClamped(date, monthsToAdd) {
    const y = date.getFullYear();
    const m = date.getMonth();
    const day = date.getDate();

    const target = new Date(y, m + monthsToAdd, 1, 0, 0, 0, 0);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay));
    return target;
}

function addYearsClamped(date, yearsToAdd) {
    return addMonthsClamped(date, yearsToAdd * 12);
}

// ✅ Decimal -> number güvenli
function decimalToNumber(v) {
    if (v == null) return null;
    const s = typeof v === "string" ? v : String(v);
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

// ✅ Yeni sistem: repeatUnit/repeatInterval ile aylık normalize
function normalizeMonthlyAmount(sub) {
    if (sub.amount == null || !sub.currency) return null;

    const amount = decimalToNumber(sub.amount);
    if (amount == null || amount < 0) return null;

    const interval = Number(sub.repeatInterval ?? 1);
    if (!Number.isInteger(interval) || interval < 1) return null;

    const unit = sub.repeatUnit; // "MONTH" | "YEAR"
    if (unit === "MONTH") return amount / interval;
    if (unit === "YEAR") return amount / (12 * interval);

    return null;
}

// ✅ efektif end (endDate vs statusChangedAt)
function getEffectiveEndDate(sub) {
    const end = sub.endDate ? new Date(sub.endDate) : null;
    const sc = sub.statusChangedAt ? new Date(sub.statusChangedAt) : null;

    if (end && sc) return end.getTime() <= sc.getTime() ? end : sc;
    return end || sc || null;
}

// ✅ Subscription belirli ay aralığında aktif mi? (geçmişi de kapsar)
// - startDate..min(endDate, statusChangedAt)
function isActiveInMonthWindow(sub, monthStart, monthEnd) {
    const s = sub.startDate ? new Date(sub.startDate) : null;
    if (!s) return false;

    const effectiveEnd = getEffectiveEndDate(sub); // null olabilir

    if (s.getTime() > monthEnd.getTime()) return false;
    if (effectiveEnd && effectiveEnd.getTime() < monthStart.getTime()) return false;

    return true;
}

// Range içinde renewal tarihlerini üret (statusChangedAt/endDate’e göre durur)
function getRenewalDatesInRange(sub, rangeStart, rangeEnd) {
    const s = sub.startDate ? new Date(sub.startDate) : null;
    if (!s) return [];

    const effectiveEnd = getEffectiveEndDate(sub); // null olabilir

    const unit = sub.repeatUnit;
    const interval = Number(sub.repeatInterval ?? 1);
    if (!unit || !Number.isInteger(interval) || interval < 1) return [];

    // ✅ ödeme günü = startDate + interval, +interval...
    let cur = new Date(s);

    // rangeStart'tan önceyse ileri sar
    let guard = 0;
    while (cur.getTime() < rangeStart.getTime() && guard < 2000) {
        guard++;
        if (unit === "MONTH") cur = addMonthsClamped(cur, interval);
        else if (unit === "YEAR") cur = addYearsClamped(cur, interval);
        else return [];
    }

    const dates = [];
    guard = 0;

    while (cur.getTime() <= rangeEnd.getTime() && guard < 2000) {
        guard++;

        // ✅ efektif end’i aşma
        if (effectiveEnd && cur.getTime() > effectiveEnd.getTime()) break;

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
            statusChangedAt: true,

            createdAt: true,
            startDate: true,
            endDate: true,

            repeatUnit: true,
            repeatInterval: true,

            amount: true,
            currency: true,

            platform: {
                select: { id: true, name: true, slug: true, logoUrl: true },
            },
            values: { select: { id: true } },
        },
    });

    // ✅ Monthly spend estimate: sadece şu an ACTIVE olanlar için (özet KPI)
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
            startDate: true,
            endDate: true,
            statusChangedAt: true,
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
            statusChangedAt: s.statusChangedAt,

            createdAt: s.createdAt,
            startDate: s.startDate,
            endDate: s.endDate,

            repeatUnit: s.repeatUnit,
            repeatInterval: s.repeatInterval,

            // ✅ Decimal -> string (frontend’de Number() ile kullanılabilir)
            amount: s.amount != null ? String(s.amount) : null,
            currency: s.currency,

            platform: s.platform,
            fieldsCount: Array.isArray(s.values) ? s.values.length : 0,
        })),
    };
}

async function getMyDashboardCharts({ userId, months }) {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const fromMonthStart = addMonthsClamped(currentMonthStart, -(months - 1));

    const subs = await prisma.subscription.findMany({
        where: { userId },
        select: {
            id: true,
            status: true,
            statusChangedAt: true,

            startDate: true,
            endDate: true,

            amount: true,
            currency: true,
            repeatUnit: true,
            repeatInterval: true,

            platform: { select: { id: true, name: true, logoUrl: true } },
        },
    });

    // 1) Monthly spend trend (geçmiş aylar dahil, statusChangedAt sonrası hariç)
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
            if (!isActiveInMonthWindow(sub, m.start, m.end)) continue;
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

    // 2) This month spend by platform (bu ay penceresi + statusChangedAt sonrası hariç)
    const thisMonthStart = currentMonthStart;
    const thisMonthEnd = endOfMonth(now);

    const byPlatformMap = new Map(); // platformId -> { platform, currencies: Map }

    for (const sub of subs) {
        const monthly = normalizeMonthlyAmount(sub);
        if (monthly == null) continue;
        if (!isActiveInMonthWindow(sub, thisMonthStart, thisMonthEnd)) continue;

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

    // 3) Renewals per week (this month) - bu ay penceresi içindeki renewal sayısı
    const renewalsByWeek = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const sub of subs) {
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
