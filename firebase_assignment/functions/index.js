const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const usersCollection = db.collection("users");

// 유틸리티 함수
function containsKorean(text) {
    return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

function isValidEmail(email) {
    return email.includes("@");
}

// 유저 생성
exports.createUser = onRequest(async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).send({ error: "Missing name or email" });
    }

    if (containsKorean(name)) {
        return res
            .status(400)
            .send({ error: "Name should not contain Korean characters" });
    }

    if (!isValidEmail(email)) {
        return res.status(400).send({ error: "Invalid email format" });
    }

    try {
        const newUserRef = await usersCollection.add({
            name,
            email,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(201).send({
            id: newUserRef.id,
            message: "User created",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: error.message });
    }
});

// 유저 조회 (이름 기준)
exports.getUser = onRequest(async (req, res) => {
    if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed");
    }

    const userName = req.query.name;

    if (!userName) {
        return res.status(400).send({ error: "Missing user name in query" });
    }

    try {
        const querySnapshot = await usersCollection
            .where("name", "==", userName)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            return res.status(404).send({ message: "User not found" });
        }

        const userDoc = querySnapshot.docs[0];
        return res.status(200).send({ id: userDoc.id, ...userDoc.data() });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: error.message });
    }
});

// 유저 업데이트 (이름 기준, 이메일 유효성 체크)
exports.updateUser = onRequest(async (req, res) => {
    if (req.method !== "PUT") {
        return res.status(405).send("Method Not Allowed");
    }

    const userName = req.query.name;
    const updateFields = req.body;

    if (!userName || !updateFields) {
        return res
            .status(400)
            .send({ error: "Missing user name or update data" });
    }

    if (updateFields.email && !isValidEmail(updateFields.email)) {
        return res.status(400).send({ error: "Invalid email format" });
    }

    try {
        const querySnapshot = await usersCollection
            .where("name", "==", userName)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            return res.status(404).send({ message: "User not found" });
        }

        const userDoc = querySnapshot.docs[0];
        await userDoc.ref.update(updateFields);
        return res.status(200).send({ message: "User updated successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: error.message });
    }
});

// 유저 삭제 (1분 이내 삭제 불가)
exports.deleteUser = onRequest(async (req, res) => {
    if (req.method !== "DELETE") {
        return res.status(405).send("Method Not Allowed");
    }

    const userName = req.query.name;

    if (!userName) {
        return res.status(400).send({ error: "Missing user name in query" });
    }

    try {
        const querySnapshot = await usersCollection
            .where("name", "==", userName)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            return res.status(404).send({ message: "User not found" });
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const createdAt = userData.createdAt?.toDate?.();

        if (!createdAt) {
            return res.status(400).send({ error: "Missing createdAt field" });
        }

        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        if (createdAt > oneMinuteAgo) {
            return res
                .status(403)
                .send({
                    error: "Cannot delete user within 1 minute of creation",
                });
        }

        await userDoc.ref.delete();
        return res.status(200).send({ message: "User deleted successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: error.message });
    }
});
