const prisma = require("../../config/prisma");
const bcrypt = require("bcrypt");

async function updateProfile({ userId, name, surname, email, currentPassword }) {
    const data = {};

    if (name !== undefined) data.name = String(name || "").trim() || null;
    if (surname !== undefined) data.surname = String(surname || "").trim() || null;

    let wantsEmailChange = false;
    let nextEmail = null;

    if (email !== undefined) {
        nextEmail = String(email || "").trim().toLowerCase();
        if (!nextEmail) {
            const err = new Error("EMAIL_REQUIRED");
            err.code = "EMAIL_REQUIRED";
            throw err;
        }
        wantsEmailChange = true;
    }

    // Email değişikliği güvenliği: mevcut şifre doğrulaması
    if (wantsEmailChange) {
        if (!currentPassword) {
            const err = new Error("PASSWORD_CONFIRM_REQUIRED");
            err.code = "PASSWORD_CONFIRM_REQUIRED";
            throw err;
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, password: true },
        });

        if (!user) {
            const err = new Error("NOT_FOUND");
            err.code = "NOT_FOUND";
            throw err;
        }

        // Aynı email’e set etmeye çalışıyorsa şifre istemeyebiliriz ama güvenlik için yine de isteyebiliriz.
        // MVP: email aynıysa değişiklik yapma.
        if (user.email !== nextEmail) {
            const ok = await bcrypt.compare(String(currentPassword), user.password);
            if (!ok) {
                const err = new Error("INVALID_CURRENT_PASSWORD");
                err.code = "INVALID_CURRENT_PASSWORD";
                throw err;
            }
            data.email = nextEmail;
        }
    }

    try {
        const updated = await prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                surname: true,
                role: true,
                updatedAt: true,
            },
        });

        return updated;
    } catch (err) {
        if (err.code === "P2002") {
            const e = new Error("EMAIL_TAKEN");
            e.code = "EMAIL_TAKEN";
            throw e;
        }
        throw err;
    }
}

async function changePassword({ userId, currentPassword, newPassword }) {
    const cur = String(currentPassword || "");
    const next = String(newPassword || "");

    if (!cur || !next) {
        const e = new Error("PASSWORD_REQUIRED");
        e.code = "PASSWORD_REQUIRED";
        throw e;
    }

    if (next.length < 6) {
        const e = new Error("PASSWORD_TOO_SHORT");
        e.code = "PASSWORD_TOO_SHORT";
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

    const ok = await bcrypt.compare(cur, user.password);
    if (!ok) {
        const e = new Error("INVALID_CURRENT_PASSWORD");
        e.code = "INVALID_CURRENT_PASSWORD";
        throw e;
    }

    const hashed = await bcrypt.hash(next, 10);

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
    });

    return true;
}

module.exports = {
    updateProfile,
    changePassword,
};
