const prisma = require("../../config/prisma");

function isOptionType(type) {
  return type === "SELECT" || type === "MULTISELECT";
}

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmountOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRepeatUnitOrUndefined(v) {
  // Prisma enum: MONTH | YEAR
  if (v === "MONTH" || v === "YEAR") return v;
  return undefined;
}

function normalizeRepeatIntervalOrUndefined(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isInteger(n)) return undefined;
  if (n < 1 || n > 120) return undefined; // güvenlik limiti
  return n;
}

function normalizeTracking(tracking = {}) {
  const status =
    tracking.status === "ACTIVE" ||
    tracking.status === "PAUSED" ||
    tracking.status === "CANCELED"
      ? tracking.status
      : undefined;

  const repeatUnit = normalizeRepeatUnitOrUndefined(tracking.repeatUnit);
  const repeatInterval = normalizeRepeatIntervalOrUndefined(tracking.repeatInterval);

  const startDate = parseDateOrNull(tracking.startDate);
  const endDate = parseDateOrNull(tracking.endDate);

  // endDate < startDate olmasın
  const safeEndDate =
    startDate && endDate && endDate.getTime() < startDate.getTime() ? null : endDate;

  const amount = parseAmountOrNull(tracking.amount);
  const currency = tracking.currency ? String(tracking.currency).trim().toUpperCase() : null;

  return {
    status,
    repeatUnit,
    repeatInterval,
    startDate,
    endDate: safeEndDate,
    amount,
    currency,
  };
}

async function createSubscription({ userId, platformId, values, tracking }) {
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

  const t = normalizeTracking(tracking);

  // ✅ startDate artık temel; yoksa create etme
  if (!t.startDate) {
    const e = new Error("START_DATE_REQUIRED");
    e.code = "START_DATE_REQUIRED";
    throw e;
  }

  // repeat alanları verilmediyse default (Prisma defaultları da var ama burada netleştirelim)
  const finalRepeatUnit = t.repeatUnit || "MONTH";
  const finalRepeatInterval = t.repeatInterval || 1;

  const fieldMap = new Map(platform.fields.map((f) => [f.id, f]));

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

  const normalized = values
    .filter((v) => fieldMap.has(v.platformFieldId))
    .map((v) => {
      const f = fieldMap.get(v.platformFieldId);
      let valueJson = v.value;

      if (f.type === "MULTISELECT") {
        if (!Array.isArray(valueJson)) valueJson = [];
      }

      if (f.type === "CHECKBOX") {
        valueJson = !!valueJson;
      }

      if (f.type === "NUMBER") {
        const n = Number(valueJson);
        valueJson = Number.isFinite(n) ? n : null;
      }

      if (f.type === "DATE") {
        valueJson = valueJson ? String(valueJson) : null;
      }

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

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId,
        platformId,
        ...(t.status ? { status: t.status } : {}),
        repeatUnit: finalRepeatUnit,
        repeatInterval: finalRepeatInterval,
        startDate: t.startDate,
        endDate: t.endDate,
        amount: t.amount,
        currency: t.currency,
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
      status: true,
      repeatUnit: true,
      repeatInterval: true,
      startDate: true,
      endDate: true,
      amount: true,
      currency: true,
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

  return subs.map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    status: s.status,
    repeatUnit: s.repeatUnit,
    repeatInterval: s.repeatInterval,
    startDate: s.startDate,
    endDate: s.endDate,
    amount: s.amount,
    currency: s.currency,
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

function normalizeValuesForFields(platformFields, inputValues) {
  const fieldMap = new Map(platformFields.map((f) => [f.id, f]));

  for (const f of platformFields) {
    if (!f.required) continue;
    const found = inputValues.find((v) => v.platformFieldId === f.id);
    const val = found?.value;
    const empty =
      val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0);
    if (empty) {
      const e = new Error("REQUIRED_FIELD_MISSING");
      e.code = "REQUIRED_FIELD_MISSING";
      e.meta = { label: f.label, key: f.key };
      throw e;
    }
  }

  return inputValues
    .filter((v) => fieldMap.has(v.platformFieldId))
    .map((v) => {
      const f = fieldMap.get(v.platformFieldId);
      let valueJson = v.value;

      if (f.type === "MULTISELECT") valueJson = Array.isArray(valueJson) ? valueJson : [];
      if (f.type === "CHECKBOX") valueJson = !!valueJson;

      if (f.type === "NUMBER") {
        const n = Number(valueJson);
        valueJson = Number.isFinite(n) ? n : null;
      }

      if (f.type === "DATE") {
        valueJson = valueJson ? String(valueJson) : null;
      }

      return { platformFieldId: v.platformFieldId, valueJson };
    });
}

async function getMySubscriptionById({ userId, subscriptionId }) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      status: true,
      repeatUnit: true,
      repeatInterval: true,
      startDate: true,
      endDate: true,
      amount: true,
      currency: true,
      platform: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          status: true,
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
            },
          },
        },
      },
      values: {
        select: {
          platformFieldId: true,
          valueJson: true,
        },
      },
    },
  });

  if (!sub) return null;

  return {
    subscription: {
      id: sub.id,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      status: sub.status,
      repeatUnit: sub.repeatUnit,
      repeatInterval: sub.repeatInterval,
      startDate: sub.startDate,
      endDate: sub.endDate,
      amount: sub.amount,
      currency: sub.currency,
    },
    platform: sub.platform,
    values: sub.values.map((v) => ({
      platformFieldId: v.platformFieldId,
      value: v.valueJson,
    })),
  };
}

async function updateMySubscription({ userId, subscriptionId, values, tracking }) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    select: {
      id: true,
      platformId: true,
      platform: {
        select: {
          fields: {
            orderBy: { order: "asc" },
            select: { id: true, key: true, label: true, type: true, required: true, optionsJson: true },
          },
        },
      },
    },
  });

  if (!sub) {
    const e = new Error("NOT_FOUND");
    e.code = "NOT_FOUND";
    throw e;
  }

  const t = normalizeTracking(tracking);

  // update’te startDate boş gönderilirse eskiyi bozma demek istersen:
  // burada zorunlu yapmıyorum; ama sen takvim için istiyorsun.
  // Bu yüzden boşsa hata veriyoruz:
  if (!t.startDate) {
    const e = new Error("START_DATE_REQUIRED");
    e.code = "START_DATE_REQUIRED";
    throw e;
  }

  const finalRepeatUnit = t.repeatUnit || "MONTH";
  const finalRepeatInterval = t.repeatInterval || 1;

  const normalized = normalizeValuesForFields(sub.platform.fields, values);

  return prisma.$transaction(async (tx) => {
    await tx.subscriptionFieldValue.deleteMany({
      where: { subscriptionId: sub.id },
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

    const updated = await tx.subscription.update({
      where: { id: sub.id },
      data: {
        ...(t.status ? { status: t.status } : {}),
        repeatUnit: finalRepeatUnit,
        repeatInterval: finalRepeatInterval,
        startDate: t.startDate,
        endDate: t.endDate,
        amount: t.amount,
        currency: t.currency,
      },
      select: { id: true, updatedAt: true },
    });

    return updated;
  });
}

async function deleteMySubscription({ userId, subscriptionId }) {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    select: { id: true },
  });

  if (!sub) {
    const e = new Error("NOT_FOUND");
    e.code = "NOT_FOUND";
    throw e;
  }

  await prisma.subscription.delete({
    where: { id: sub.id },
  });
}

module.exports = {
  createSubscription,
  listMySubscriptions,
  getMySubscriptionById,
  updateMySubscription,
  deleteMySubscription,
};
