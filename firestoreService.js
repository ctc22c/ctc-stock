import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    query,
    where,
    orderBy,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjx0r8OsJAEI8sdTopWadcGYcnD9jcme4",
    authDomain: "ctc-capital.firebaseapp.com",
    projectId: "ctc-capital",
    storageBucket: "ctc-capital.firebasestorage.app",
    messagingSenderId: "563837502113",
    appId: "1:563837502113:web:d84ae0e9d07c997ebb26e0",
    measurementId: "G-7L643VX04V"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STOCK_LIST = {
    AAPL: { symbol: 'AAPL', name: 'Apple Inc.', price: 175.43, change: 2.34, volume: '45.2M' },
    TSLA: { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: -1.23, volume: '32.1M' },
    GOOGL: { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.87, change: 0.89, volume: '28.7M' },
    MSFT: { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.85, change: 1.67, volume: '22.3M' },
    AMZN: { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 155.89, change: 3.21, volume: '38.9M' },
    BTC: { symbol: 'BTC', name: 'Bitcoin', price: 43250.00, change: 5.67, volume: '1.2B' },
    ETH: { symbol: 'ETH', name: 'Ethereum', price: 2650.00, change: 2.89, volume: '850M' },
    OIL: { symbol: 'OIL', name: 'Oil & Gas Index', price: 78.45, change: -0.34, volume: '156M' },
    TECH: { symbol: 'TECH', name: 'Tech Index', price: 4250.67, change: 1.45, volume: '2.1B' }
};

const stockCollection = () => collection(db, 'stocks');
const userDoc = (uid) => doc(db, 'users', uid);
const userTransactionsCollection = (uid) => collection(db, 'users', uid, 'transactions');
const userPortfolioCollection = (uid) => collection(db, 'users', uid, 'portfolio');
const stockDoc = (symbol) => doc(db, 'stocks', symbol);

const getStockQuery = () => query(stockCollection());

async function ensureStockDocs() {
    try {
        const snapshot = await getDocs(getStockQuery());
        if (!snapshot.empty) {
            return;
        }

        const writes = Object.values(STOCK_LIST).map(stock => {
            return setDoc(stockDoc(stock.symbol), {
                name: stock.name,
                price: stock.price,
                change: stock.change,
                volume: stock.volume,
                symbol: stock.symbol,
                updatedAt: serverTimestamp()
            }, { merge: true });
        });

        await Promise.all(writes);
    } catch (error) {
        console.warn('Unable to ensure stock docs in Firestore:', error);
    }
}

async function getLiveStockPrices() {
    const snapshot = await getDocs(getStockQuery());
    const prices = {};
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data && data.symbol) {
            prices[data.symbol] = {
                symbol: data.symbol,
                name: data.name,
                price: data.price,
                change: data.change,
                volume: data.volume
            };
        }
    });
    return prices;
}

function getLocalStock(symbol) {
    return STOCK_LIST[symbol] || null;
}

export {
    app,
    auth,
    db,
    collection,
    doc,
    query,
    where,
    orderBy,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    onSnapshot,
    updateDoc,
    serverTimestamp,
    STOCK_LIST,
    getStockQuery,
    getLiveStockPrices,
    ensureStockDocs,
    getLocalStock,
    userDoc,
    userTransactionsCollection,
    userPortfolioCollection,
    stockDoc,
};