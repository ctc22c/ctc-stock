import { auth, db, collection, doc, onSnapshot, query, getDocs, orderBy, STOCK_LIST, ensureStockDocs } from './firestoreService.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const portfolioTotalEl = document.getElementById('portfolioTotal');
const portfolioGainEl = document.getElementById('portfolioGain');
const portfolioRoiEl = document.getElementById('portfolioRoi');
const portfolioStatusEl = document.getElementById('portfolioStatus');
const cashAvailableEl = document.getElementById('cashAvailable');
const holdingsGrid = document.getElementById('holdingsGrid');
const watchlistEl = document.getElementById('watchlist');

let userPortfolio = [];
let userBalance = 0;
let userDoc = null;

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const formatPercent = (value) => `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(2)}%`;

const renderHoldings = () => {
    if (!holdingsGrid) return;
    if (!userPortfolio.length) {
        holdingsGrid.innerHTML = `<div class="py-12 text-center rounded-[2rem] bg-slate-900/40 border border-slate-700 text-slate-400">No active holdings yet. Place your first trade in the market terminal to populate your portfolio.</div>`;
        return;
    }

    holdingsGrid.innerHTML = userPortfolio.map(item => {
        const currentPrice = Number(item.currentPrice || item.averagePrice || 0);
        const value = Number(item.quantityOwned || 0) * currentPrice;
        const invested = Number(item.totalInvested || 0);
        const delta = value - invested;
        const deltaClass = delta >= 0 ? 'status-positive' : 'status-negative';

        return `
            <article class="glass-panel rounded-[2rem] border border-slate-700 p-5">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-xs uppercase tracking-[0.35em] text-slate-400">${item.symbol}</p>
                        <h3 class="mt-2 text-xl font-bold text-white">${item.name || item.symbol}</h3>
                    </div>
                    <div class="text-right">
                        <p class="text-xs uppercase tracking-[0.35em] text-slate-400">Current Value</p>
                        <p class="mt-2 text-2xl font-extrabold text-white">${formatCurrency(value)}</p>
                    </div>
                </div>
                <div class="mt-5 grid gap-4 sm:grid-cols-3">
                    <div class="rounded-3xl bg-slate-900/50 p-4">
                        <p class="text-[.65rem] uppercase tracking-[0.35em] text-slate-500">Quantity</p>
                        <p class="mt-2 text-lg font-bold text-white">${item.quantityOwned}</p>
                    </div>
                    <div class="rounded-3xl bg-slate-900/50 p-4">
                        <p class="text-[.65rem] uppercase tracking-[0.35em] text-slate-500">Avg Price</p>
                        <p class="mt-2 text-lg font-bold text-white">${formatCurrency(item.averagePrice)}</p>
                    </div>
                    <div class="rounded-3xl bg-slate-900/50 p-4">
                        <p class="text-[.65rem] uppercase tracking-[0.35em] text-slate-500">Gain / Loss</p>
                        <p class="mt-2 text-lg font-bold ${deltaClass}">${delta >= 0 ? '+' : '-'}${formatCurrency(Math.abs(delta))}</p>
                    </div>
                </div>
            </article>
        `;
    }).join('');
};

const renderWatchlist = async () => {
    if (!watchlistEl) return;
    await ensureStockDocs();
    const watchSymbols = ['AAPL', 'TSLA', 'GOOGL', 'BTC', 'ETH'];
    const rows = watchSymbols.map(symbol => {
        const stock = STOCK_LIST[symbol] || {};
        const changeClass = stock.change >= 0 ? 'status-positive' : 'status-negative';
        return `
            <div class="glass-panel rounded-[2rem] border border-slate-700 p-5 flex items-center justify-between gap-4">
                <div>
                    <p class="text-xs uppercase tracking-[0.35em] text-slate-400">${symbol}</p>
                    <h3 class="mt-2 text-lg font-bold text-white">${stock.name || symbol}</h3>
                </div>
                <div class="text-right">
                    <p class="text-slate-400 text-xs">$${Number(stock.price || 0).toFixed(2)}</p>
                    <p class="mt-2 text-sm font-bold ${changeClass}">${stock.change >= 0 ? '+' : ''}${Number(stock.change || 0).toFixed(2)}%</p>
                </div>
            </div>
        `;
    });
    watchlistEl.innerHTML = rows.join('');
};

const refreshPortfolioView = () => {
    const totalValue = userPortfolio.reduce((acc, item) => acc + Number(item.quantityOwned || 0) * Number(item.currentPrice || item.averagePrice || 0), 0);
    const totalInvested = userPortfolio.reduce((acc, item) => acc + Number(item.totalInvested || 0), 0);
    const gain = totalValue - totalInvested;
    const roi = totalInvested > 0 ? (gain / totalInvested) * 100 : 0;

    if (portfolioTotalEl) portfolioTotalEl.innerText = formatCurrency(totalValue);
    if (portfolioGainEl) {
        portfolioGainEl.innerText = `${gain >= 0 ? '+' : '-'}${formatCurrency(Math.abs(gain))}`;
        portfolioGainEl.className = gain >= 0 ? 'status-positive text-3xl font-extrabold' : 'status-negative text-3xl font-extrabold';
    }
    if (portfolioRoiEl) portfolioRoiEl.innerText = formatPercent(roi);
    if (cashAvailableEl) cashAvailableEl.innerText = formatCurrency(userBalance);
    renderHoldings();
};

const subscribeUser = () => {
    onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
        if (!snap.exists()) return;
        userDoc = snap.data();
        userBalance = Number(userDoc.usdBalance ?? userDoc.totalBalance ?? userDoc.balance ?? 0);
        if (portfolioStatusEl) {
            portfolioStatusEl.innerText = userDoc.kycStatus === 'verified' ? 'Verified Elite' : 'Member Tier I';
        }
        refreshPortfolioView();
    });
};

const subscribePortfolio = () => {
    onSnapshot(collection(db, 'users', auth.currentUser.uid, 'portfolio'), (snapshot) => {
        userPortfolio = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const symbol = docSnap.id;
            const currentPrice = Number(STOCK_LIST[symbol]?.price || data.averagePrice || 0);
            userPortfolio.push({ id: docSnap.id, ...data, currentPrice });
        });
        refreshPortfolioView();
    });
};

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('../public/index.html');
        return;
    }
    subscribeUser();
    subscribePortfolio();
    renderWatchlist();
});

export {};
