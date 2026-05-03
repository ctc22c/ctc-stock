import { doc, runTransaction, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function executeInvestment(db, userId, amount, assetSymbol, assetName, price, durationDays) {
    const userRef = doc(db, 'users', userId);
    const investmentRef = doc(collection(db, 'investments'));

    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
            throw new Error('User account not found.');
        }
        const balance = Number(userSnap.data().usdBalance || 0);
        if (amount > balance) {
            throw new Error('Insufficient balance for this order.');
        }
        transaction.update(userRef, { usdBalance: balance - amount });
        transaction.set(investmentRef, {
            uid: userId,
            assetSymbol,
            assetName,
            amount,
            price,
            durationDays,
            status: 'active',
            createdAt: serverTimestamp()
        });
    });
}
