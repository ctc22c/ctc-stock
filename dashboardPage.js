import { auth, db, onSnapshot, collection, doc, query, orderBy, getDoc, updateDoc, serverTimestamp, STOCK_LIST, getStockQuery, ensureStockDocs } from './firestoreService.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const userNameEl = document.getElementById('userName');
const userInitialsEl = document.getElementById('userInitials');
const verificationStatusEl = document.getElementById('verificationStatus');
const valEquityEl = document.getElementById('valEquity');
const userProfitEl = document.getElementById('userProfit');
const userBtcEl = document.getElementById('userBtc');
const activeRoiEl = document.getElementById('activeRoi');
const refBonusEl = document.getElementById('refBonus');
const investmentContainer = document.getElementById('investmentContainer');
const logoutButtons = document.querySelectorAll('#logoutBtn');
const popupNotification = document.getElementById('popupNotification');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupClose = document.getElementById('popupClose');
const notifBadge = document.getElementById('notifBadge');

let cachedPortfolio = [];
let userData = null;
let lastShownNotification = null; // Track the last notification shown by content

const formatCurrency = (value) => {
    return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};

const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${Number(value || 0).toFixed(2)}%`;
};

const getCurrentStockPrice = (symbol, portfolioItem) => {
    const matching = STOCK_LIST[symbol];
    if (matching && matching.price) return Number(matching.price);
    if (portfolioItem?.averagePrice) return Number(portfolioItem.averagePrice);
    return 0;
};

const renderHoldings = () => {
    if (!investmentContainer) return;
    if (!cachedPortfolio.length) {
        investmentContainer.innerHTML = `
            <div id="noInvestments" class="py-12 text-center space-y-4">
                <div class="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto text-slate-200">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                </div>
                <p class="text-sm font-bold text-slate-800">No active holdings yet</p>
                <a href="../pages/stocks.html" class="inline-block text-[10px] font-bold text-white bg-blue-600 px-6 py-3 rounded-full shadow-lg shadow-blue-100 uppercase tracking-wider">Explore Stocks</a>
            </div>
        `;
        return;
    }

    const rows = cachedPortfolio.map(item => {
        const currentPrice = Number(item.currentPrice || item.averagePrice || 0);
        const invested = Number(item.totalInvested || 0);
        const holdingsValue = Number(item.quantityOwned || 0) * currentPrice;
        const gain = holdingsValue - invested;
        const gainClass = gain >= 0 ? 'text-emerald-600' : 'text-red-500';

        return `
            <div class="grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr] items-center gap-4 p-5 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm">
                <div>
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">${item.symbol}</p>
                    <h3 class="mt-2 text-lg font-bold text-slate-900">${item.name || item.symbol}</h3>
                    <p class="text-sm text-slate-500 mt-1">${item.quantityOwned} shares • Avg $${Number(item.averagePrice || 0).toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Market Price</p>
                    <p class="mt-2 text-lg font-bold text-slate-900">$${currentPrice.toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Value</p>
                    <p class="mt-2 text-lg font-bold text-slate-900">$${holdingsValue.toFixed(2)}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs uppercase tracking-[0.3em] text-slate-400">Gain / Loss</p>
                    <p class="mt-2 text-lg font-bold ${gainClass}">${gain >= 0 ? '+' : ''}$${gain.toFixed(2)}</p>
                </div>
            </div>
        `;
    }).join('');

    investmentContainer.innerHTML = rows;
};

const refreshDashboard = () => {
    if (!userData) return;
    const balance = Number(userData.usdBalance ?? userData.totalBalance ?? userData.balance ?? 0);
    const totalInvested = cachedPortfolio.reduce((sum, item) => sum + Number(item.totalInvested || 0), 0);
    const totalValue = cachedPortfolio.reduce((sum, item) => sum + Number(item.quantityOwned || 0) * Number(item.currentPrice || item.averagePrice || 0), 0);
    const profit = totalValue - totalInvested;
    const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    const equity = balance + totalValue;

    if (valEquityEl) valEquityEl.innerText = equity.toFixed(2);
    if (userProfitEl) userProfitEl.innerText = `${profit >= 0 ? '' : '-'}${Math.abs(profit).toFixed(2)}`;
    if (activeRoiEl) activeRoiEl.innerText = formatPercent(roi);
    if (refBonusEl) refBonusEl.innerText = Number(userData.refBonus || 0).toFixed(2);
    if (userBtcEl) userBtcEl.innerText = Number(userData.btcBalance || 0).toFixed(4);
    renderHoldings();
};

const subscribePortfolio = async (uid) => {
    await ensureStockDocs();
    const portfolioQuery = collection(db, 'users', uid, 'portfolio');
    onSnapshot(portfolioQuery, (snapshot) => {
        cachedPortfolio = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const priceSource = STOCK_LIST[docSnap.id]?.price ?? Number(data.averagePrice || 0);
            cachedPortfolio.push({ id: docSnap.id, ...data, currentPrice: Number(priceSource) });
        });
        refreshDashboard();
    });
};

const subscribeNotifications = (uid) => {
    const notificationsQuery = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'));
    onSnapshot(notificationsQuery, (snapshot) => {
        let hasUnread = false;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.read === false) {
                hasUnread = true;
            }
        });
        if (notifBadge) {
            if (hasUnread) {
                notifBadge.classList.remove('hidden');
            } else {
                notifBadge.classList.add('hidden');
            }
        }
    });
};

const showAdminNotification = (data) => {
    if (!data || !data.currentNotification) return;
    
    const notifType = data.notificationType || 'info';
    const headerColor = notifType === 'success' ? 'bg-emerald-600' : 
                        notifType === 'error' ? 'bg-red-600' : 'bg-blue-600';
    const headerTitle = notifType === 'success' ? '✅ Success' : 
                        notifType === 'error' ? '❌ Important Notice' : 'ℹ️ Admin Message';
    
    if (popupTitle) {
        popupTitle.parentElement.className = headerColor + ' px-6 py-5';
        popupTitle.innerText = headerTitle;
    }
    if (popupMessage) popupMessage.innerText = data.currentNotification;
    if (popupNotification) popupNotification.classList.remove('hidden');
};

const subscribeUser = (uid) => {
    onSnapshot(doc(db, 'users', uid), async (snap) => {
        if (!snap.exists()) return;
        userData = snap.data();

        if (userData.currentNotification && userData.currentNotification !== lastShownNotification) {
            lastShownNotification = userData.currentNotification;
            showAdminNotification(userData);
            // Clear the notification after showing it to make it one-time
            try {
                await updateDoc(doc(db, 'users', uid), {
                    currentNotification: "",
                    notificationType: ""
                });
            } catch (error) {
                console.error('Error clearing user notification:', error);
            }
        }

        if (userNameEl) userNameEl.innerText = userData.fullName || userData.email?.split('@')[0] || 'User';
        if (userInitialsEl && userData.fullName) userInitialsEl.innerText = userData.fullName.charAt(0).toUpperCase();

        if (verificationStatusEl) {
            if (userData.kycStatus === 'verified') {
                verificationStatusEl.innerHTML = '<p class="text-[9px] font-bold tracking-tighter uppercase">Verified Account</p>';
                verificationStatusEl.className = 'glass-effect px-3 py-1 rounded-full text-white';
            } else {
                verificationStatusEl.innerHTML = '<p class="text-[9px] font-bold tracking-tighter uppercase">Unverified</p>';
                verificationStatusEl.className = 'glass-effect px-3 py-1 rounded-full bg-red-500/20 text-red-200';
            }
        }

        refreshDashboard();
    });
};

if (popupClose) {
    popupClose.addEventListener('click', () => {
        if (popupNotification) popupNotification.classList.add('hidden');
    });
}

logoutButtons.forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await signOut(auth);
            window.location.replace('../public/index.html');
        } catch (error) {
            console.error('Logout failed', error);
        }
    });
});

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('../public/index.html');
        return;
    }
    subscribeUser(user.uid);
    subscribePortfolio(user.uid);
    subscribeNotifications(user.uid);
});

export {};
