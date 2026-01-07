const service = require("./subscription.service");

function normalizeRepeatUnit(v) {
  const s = String(v || "").trim().toUpperCase();
  return s === "WEEK" || s === "MONTH" || s === "YEAR" ? s : undefined;
}

function normalizeRepeatInterval(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 120) return undefined;
  return n;
}

function normalizeStringOrNull(v) {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function normalizeCurrencyOrNull(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s ? s : null;
}

// ✅ Prisma Decimal için string bekliyoruz: "12.50"
function normalizeDecimalStringOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const s0 = String(v).trim();
  if (!s0) return null;

  // kullanıcı "12,50" yazarsa tolere et
  const s = s0.replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;

  return n.toFixed(2);
}

function normalizeValuesOrThrow(values) {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    const e = new Error("VALUES_ARRAY_REQUIRED");
    e.code = "VALUES_ARRAY_REQUIRED";
    throw e;
  }
  return values;
}

async function create(req, res) {
  try {
    const userId = req.user.id;

    const {
      platformId,
      values,

      status,
      repeatUnit,
      repeatInterval,
      startDate,
      endDate,

      amount,
      currency,

      // ✅ yeni standart alanlar
      planId,
      accountEmail,
      accountPhone,
      notes,
    } = req.body;

    if (!platformId) {
      return res.status(400).json({ message: "platformId zorunludur." });
    }

    const safeValues = normalizeValuesOrThrow(values);

    if (!startDate) {
      return res.status(400).json({ message: "startDate zorunludur." });
    }

    const unit = normalizeRepeatUnit(repeatUnit);
    const interval = normalizeRepeatInterval(repeatInterval);
    if (repeatUnit !== undefined && !unit) {
      return res.status(400).json({ message: "repeatUnit geçersiz. WEEK | MONTH | YEAR olmalıdır." });
    }
    if (repeatInterval !== undefined && interval === undefined) {
      return res.status(400).json({ message: "repeatInterval geçersiz. En az 1 olmalıdır." });
    }

    const created = await service.createSubscription({
      userId,
      platformId: String(platformId).trim(),
      values: safeValues,
      tracking: {
        status,
        repeatUnit: unit,
        repeatInterval: interval,
        startDate,
        endDate,

        // ✅ Decimal string
        amount: normalizeDecimalStringOrNull(amount),
        currency: normalizeCurrencyOrNull(currency),

        planId: normalizeStringOrNull(planId),
        accountEmail: normalizeStringOrNull(accountEmail),
        accountPhone: normalizeStringOrNull(accountPhone),
        notes: normalizeStringOrNull(notes),
      },
    });

    return res.status(201).json({ subscription: created });
  } catch (err) {
    console.error("Create subscription error:", err);

    if (err.code === "VALUES_ARRAY_REQUIRED") {
      return res.status(400).json({ message: "values bir dizi olmalıdır." });
    }

    if (err.code === "P2002") {
      return res.status(409).json({ message: "Benzersiz alan çakışması oluştu." });
    }

    if (err.code === "PLATFORM_NOT_FOUND") {
      return res.status(404).json({ message: "Platform bulunamadı." });
    }

    if (err.code === "PLATFORM_INACTIVE") {
      return res.status(400).json({ message: "Platform aktif değil." });
    }

    if (err.code === "START_DATE_REQUIRED") {
      return res.status(400).json({ message: "startDate zorunludur." });
    }

    if (err.code === "PLAN_REQUIRED") {
      return res.status(400).json({ message: "Bu platformda plan seçimi zorunludur." });
    }

    if (err.code === "INVALID_PLAN") {
      return res.status(400).json({ message: "Geçersiz plan seçimi." });
    }

    // ✅ hem meta hem message formatı
    if (String(err.code || "").startsWith("REQUIRED_FIELD_MISSING")) {
      const keyFromMessage = String(err.message || "").includes(":")
        ? String(err.message).split(":")[1]
        : "";
      const key = err.meta?.label || err.meta?.key || keyFromMessage || "";
      return res.status(400).json({ message: `Zorunlu alan eksik: ${key}`.trim() });
    }

    return res.status(500).json({ message: "Subscription oluşturulurken hata oluştu." });
  }
}

async function listMine(req, res) {
  try {
    const userId = req.user.id;
    const items = await service.listMySubscriptions(userId);
    return res.status(200).json({ items });
  } catch (err) {
    console.error("List subscriptions error:", err);
    return res.status(500).json({ message: "Abonelikler alınırken hata oluştu." });
  }
}

async function getMineById(req, res) {
  try {
    const userId = req.user.id;
    const id = String(req.params.id || "").trim();

    const data = await service.getMySubscriptionById({ userId, subscriptionId: id });
    if (!data) return res.status(404).json({ message: "Subscription bulunamadı." });

    return res.status(200).json(data);
  } catch (err) {
    console.error("Get subscription error:", err);
    return res.status(500).json({ message: "Subscription alınırken hata oluştu." });
  }
}

async function updateMineById(req, res) {
  try {
    const userId = req.user.id;
    const id = String(req.params.id || "").trim();

    const {
      values,

      status,
      repeatUnit,
      repeatInterval,
      startDate,
      endDate,

      amount,
      currency,

      // ✅ yeni standart alanlar
      planId,
      accountEmail,
      accountPhone,
      notes,
    } = req.body;

    const safeValues = normalizeValuesOrThrow(values);

    if (!startDate) {
      return res.status(400).json({ message: "startDate zorunludur." });
    }

    const unit = normalizeRepeatUnit(repeatUnit);
    const interval = normalizeRepeatInterval(repeatInterval);
    if (repeatUnit !== undefined && !unit) {
      return res.status(400).json({ message: "repeatUnit geçersiz. WEEK | MONTH | YEAR olmalıdır." });
    }
    if (repeatInterval !== undefined && interval === undefined) {
      return res.status(400).json({ message: "repeatInterval geçersiz. En az 1 olmalıdır." });
    }

    const updated = await service.updateMySubscription({
      userId,
      subscriptionId: id,
      values: safeValues,
      tracking: {
        status,
        repeatUnit: unit,
        repeatInterval: interval,
        startDate,
        endDate,

        amount: normalizeDecimalStringOrNull(amount),
        currency: normalizeCurrencyOrNull(currency),

        planId: normalizeStringOrNull(planId),
        accountEmail: normalizeStringOrNull(accountEmail),
        accountPhone: normalizeStringOrNull(accountPhone),
        notes: normalizeStringOrNull(notes),
      },
    });

    return res.status(200).json({ subscription: updated });
  } catch (err) {
    console.error("Update subscription error:", err);

    if (err.code === "VALUES_ARRAY_REQUIRED") {
      return res.status(400).json({ message: "values bir dizi olmalıdır." });
    }

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Subscription bulunamadı." });
    }

    if (err.code === "START_DATE_REQUIRED") {
      return res.status(400).json({ message: "startDate zorunludur." });
    }

    if (err.code === "PLAN_REQUIRED") {
      return res.status(400).json({ message: "Bu platformda plan seçimi zorunludur." });
    }

    if (err.code === "INVALID_PLAN") {
      return res.status(400).json({ message: "Geçersiz plan seçimi." });
    }

    if (String(err.code || "").startsWith("REQUIRED_FIELD_MISSING")) {
      const keyFromMessage = String(err.message || "").includes(":")
        ? String(err.message).split(":")[1]
        : "";
      const key = err.meta?.label || err.meta?.key || keyFromMessage || "";
      return res.status(400).json({ message: `Zorunlu alan eksik: ${key}`.trim() });
    }

    return res.status(500).json({ message: "Subscription güncellenirken hata oluştu." });
  }
}

async function deleteMineById(req, res) {
  try {
    const userId = req.user.id;
    const subscriptionId = String(req.params.id || "").trim();

    await service.deleteMySubscription({ userId, subscriptionId });

    return res.status(204).end();
  } catch (err) {
    console.error("Delete subscription error:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ message: "Subscription bulunamadı." });
    }

    return res.status(500).json({ message: "Subscription silinirken hata oluştu." });
  }
}

module.exports = {
  create,
  listMine,
  getMineById,
  updateMineById,
  deleteMineById,
};
