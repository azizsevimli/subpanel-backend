const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");

function normalizeEmail(v) {
    return String(v || "").trim().toLowerCase();
}

async function getProfile(userId) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, surname: true, role: true, createdAt: true },
    });
}

async function updateProfile(userId, { name, surname, email, currentPassword }) {
    const data = {};

    if (name !== undefined) data.name = String(name || "").trim() || null;
    if (surname !== undefined) data.surname = String(surname || "").trim() || null;

    // Email değişikliği varsa güvenlik kontrolü:
    if (email !== undefined) {
        const nextEmail = normalizeEmail(email);
        if (!nextEmail) {
            const err = new Error("INVALID_EMAIL");
            err.code = "INVALID_EMAIL";
            throw err;
        }

        // Mevcut kullanıcıyı çek (mevcut email + şifre doğrulama için)
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, password: true },
        });

        if (!user) {
            const e = new Error("NOT_FOUND");
            e.code = "NOT_FOUND";
            throw e;
        }

        // Aynı email'e güncellenmeye çalışılıyorsa şifre istemeden geçebiliriz
        // ama istersen yine de isteyebilirsin. MVP: aynıysa set etmiyoruz.
        if (user.email !== nextEmail) {
            if (!currentPassword) {
                const e = new Error("PASSWORD_CONFIRM_REQUIRED");
                e.code = "PASSWORD_CONFIRM_REQUIRED";
                throw e;
            }

            const ok = await bcrypt.compare(String(currentPassword), user.password);
            if (!ok) {
                const e = new Error("INVALID_CURRENT_PASSWORD");
                e.code = "INVALID_CURRENT_PASSWORD";
                throw e;
            }

            data.email = nextEmail;
        }
    }

    try {
        return await prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, email: true, name: true, surname: true, role: true, updatedAt: true },
        });
    } catch (err) {
        // Prisma unique error
        if (err.code === "P2002") {
            const e = new Error("EMAIL_TAKEN");
            e.code = "EMAIL_TAKEN";
            throw e;
        }
        throw err;
    }
}

async function changePassword(userId, { currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
        const e = new Error("MISSING_FIELDS");
        e.code = "MISSING_FIELDS";
        throw e;
    }

    if (String(newPassword).length < 6) {
        const e = new Error("WEAK_PASSWORD");
        e.code = "WEAK_PASSWORD";
        throw e;
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
    });

    if (!user) {
        const e = new Error("NOT_FOUND");
        e.code = "NOT_FOUND";
        throw e;
    }

    const ok = await bcrypt.compare(String(currentPassword), user.password);
    if (!ok) {
        const e = new Error("INVALID_CURRENT_PASSWORD");
        e.code = "INVALID_CURRENT_PASSWORD";
        throw e;
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
    });

    return { ok: true };
}

module.exports = { getProfile, updateProfile, changePassword };
