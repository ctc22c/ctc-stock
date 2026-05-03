import { auth, db, onSnapshot, collection, doc, query, where, orderBy } from './firestoreService.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const transactionsList = document.getElementById('transactionsList');
const totalTransactions = document.getElementById('totalTransactions');
const netFlow = document.getElementById('netFlow');
const depositCount = document.getElementById('depositCount');
const withdrawalCount = document.getElementById('withdrawalCount');
const investmentCount = document.getElementById('investmentCount');
const emptySelection = document.getElementById('emptySelection');
const transactionDetails = document.getElementById('transactionDetails');
const transactionOverlay = document.getElementById('transactionOverlay');
const closeOverlay = document.getElementById('closeOverlay');
const filterAll = document.getElementById('filterAll');
const filterDeposits = document.getElementById('filterDeposits');
const filterWithdrawals = document.getElementById('filterWithdrawals');
const filterInvestments = document.getElementById('filterInvestments');

const detailType = document.getElementById('detailType');
const detailStatusBadge = document.getElementById('detailStatusBadge');
const detailAmount = document.getElementById('detailAmount');
const detailDateTime = document.getElementById('detailDateTime');
const detailTransactionId = document.getElementById('detailTransactionId');
const detailMethod = document.getElementById('detailMethod');
const detailAdminNotes = document.getElementById('detailAdminNotes');
const adminNotesSection = document.getElementById('adminNotesSection');
const overlayTransactionId = document.getElementById('overlayTransactionId');
const overlayType = document.getElementById('overlayType');
const overlayStatusBadge = document.getElementById('overlayStatusBadge');
const overlayAmount = document.getElementById('overlayAmount');
const overlayTimestamp = document.getElementById('overlayTimestamp');
const overlayMethod = document.getElementById('overlayMethod');
const overlayAdminNotes = document.getElementById('overlayAdminNotes');
const overlayAdminNotesText = document.getElementById('overlayAdminNotesText');

let currentUser = null;
let allTransactions = [];
let currentFilter = 'all';
let selectedTransaction = null;

const formatCurrency = (amount, currency = 'USD') => {
    if (currency === 'BTC') {
        return `${Number(amount || 0).toFixed(8)} BTC`;
    }
    return `$${Number(amount || 0).toFixed(2)}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const getTransactionIcon = (type) => {
    switch (type) {
        case 'deposit':
            return `<svg class="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>`;
        case 'withdrawal':
            return `<svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>`;
        case 'buy':
            return `<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>`;
        case 'sell':
            return `<svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 15l-9 9-9-9m9 9V3"></path></svg>`;
        default:
            return `<svg class="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`;
    }
};

const getStatusBadge = (status) => {
    const statusClasses = {
        pending: 'status-pending',
        completed: 'status-completed',
        approved: 'status-completed',
        declined: 'status-declined',
        rejected: 'status-declined',
        active: 'status-completed'
    };
    const statusText = String(status || 'pending').replace(/^[a-z]/, (c) => c.toUpperCase());
    const badgeClass = statusClasses[status?.toLowerCase()] || 'bg-slate-500';
    return `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${badgeClass}">${statusText}</span>`;
};

const getTransactionName = (transaction) => {
    switch (transaction.type) {
        case 'deposit':
            return transaction.method === 'btc' ? 'Bitcoin Deposit' : 'USD Bank Deposit';
        case 'withdrawal':
            return transaction.method === 'btc' ? 'Bitcoin Withdrawal' : 'USD Bank Withdrawal';
        case 'buy':
            return `Buy ${transaction.quantity} ${transaction.symbol}`;
        case 'sell':
            return `Sell ${transaction.quantity} ${transaction.symbol}`;
        case 'investment':
            return `Investment (${transaction.durationDays || 'N/A'} days)`;
        default:
            return transaction.action || 'Transaction';
    }
};

const getTransactionAmount = (transaction) => {
    let amount = Number(transaction.amount || 0);
    let currency = transaction.currency || 'USD';
    let sign = '+';

    if (transaction.type === 'withdrawal' || transaction.type === 'sell' || transaction.type === 'investment') {
        sign = '-';
    }

    return `<span class="font-bold ${sign === '+' ? 'text-emerald-600' : 'text-slate-800'}">${sign}${formatCurrency(amount, currency)}</span>`;
};

const getTransactionMethod = (transaction) => {
    if (transaction.type === 'deposit') {
        return transaction.method === 'btc' ? `Bitcoin Wallet • ${transaction.targetWallet || 'BTC'}` : `Bank Transfer • ${transaction.method || 'Bank'}`;
    }
    if (transaction.type === 'withdrawal') {
        return transaction.method === 'btc' ? `Bitcoin Wallet • ${transaction.details?.btcWalletAddress || 'BTC Wallet'}` : `Bank Account • ${transaction.details?.bankName || 'Bank'}`;
    }
    if (transaction.type === 'buy' || transaction.type === 'sell') {
        return `Executed at $${Number(transaction.price || 0).toFixed(2)} • Commission $${Number(transaction.commission || 0).toFixed(2)}`;
    }
    return transaction.method || 'N/A';
};

const selectTransaction = (transaction) => {
    selectedTransaction = transaction;
    if (detailType) detailType.textContent = getTransactionName(transaction).replace(/<[^>]*>/g, '');
    if (detailStatusBadge) detailStatusBadge.innerHTML = getStatusBadge(transaction.status);
    if (detailAmount) detailAmount.innerHTML = getTransactionAmount(transaction).replace(/<[^>]*>/g, '');
    if (detailDateTime) detailDateTime.textContent = formatDate(transaction.timestamp);
    if (detailTransactionId) detailTransactionId.textContent = transaction.id;
    if (detailMethod) detailMethod.textContent = getTransactionMethod(transaction);

    if (transaction.adminMessage || transaction.adminNote) {
        detailAdminNotes.textContent = transaction.adminMessage || transaction.adminNote;
        adminNotesSection.classList.remove('hidden');
    } else {
        adminNotesSection.classList.add('hidden');
    }

    emptySelection.classList.add('hidden');
    transactionDetails.classList.remove('hidden');
};

const showTransactionOverlay = (transaction) => {
    if (overlayTransactionId) overlayTransactionId.textContent = transaction.id;
    if (overlayType) overlayType.textContent = getTransactionName(transaction).replace(/<[^>]*>/g, '');
    if (overlayStatusBadge) overlayStatusBadge.innerHTML = getStatusBadge(transaction.status);
    if (overlayAmount) overlayAmount.innerHTML = getTransactionAmount(transaction).replace(/<[^>]*>/g, '');
    if (overlayTimestamp) overlayTimestamp.textContent = formatDate(transaction.timestamp);
    if (overlayMethod) overlayMethod.textContent = getTransactionMethod(transaction);

    if (transaction.adminMessage || transaction.adminNote) {
        overlayAdminNotesText.textContent = transaction.adminMessage || transaction.adminNote;
        overlayAdminNotes.classList.remove('hidden');
    } else {
        overlayAdminNotes.classList.add('hidden');
    }
    transactionOverlay.classList.remove('hidden');
};

const renderTransactions = () => {
    const filtered = allTransactions.filter((transaction) => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'deposits') return transaction.type === 'deposit';
        if (currentFilter === 'withdrawals') return transaction.type === 'withdrawal';
        return ['investment', 'buy', 'sell'].includes(transaction.type);
    });

    filtered.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return bTime - aTime;
    });

    if (!transactionsList) return;
    transactionsList.innerHTML = '';

    if (!filtered.length) {
        transactionsList.innerHTML = `
            <div class="text-center py-12">
                <svg class="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                <p class="text-slate-500 text-lg font-semibold">No transactions found</p>
                <p class="text-slate-400 text-sm mt-2">Transactions will appear here as they are processed.</p>
            </div>
        `;
        return;
    }

    filtered.forEach((transaction) => {
        const transactionElement = document.createElement('div');
        transactionElement.className = 'transaction-row flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-all';
        transactionElement.innerHTML = `
            <div class="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                ${getTransactionIcon(transaction.type)}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-slate-800 font-semibold truncate text-sm sm:text-base">${getTransactionName(transaction)}</p>
                <p class="text-slate-500 text-xs sm:text-sm">${formatDate(transaction.timestamp)}</p>
            </div>
            <div class="flex-shrink-0 text-right">
                <p class="text-base sm:text-lg font-bold">${getTransactionAmount(transaction)}</p>
                <div class="mt-1">${getStatusBadge(transaction.status)}</div>
            </div>
        `;
        transactionElement.addEventListener('click', () => {
            selectTransaction(transaction);
            showTransactionOverlay(transaction);
        });
        transactionsList.appendChild(transactionElement);
    });
};

const updateStats = () => {
    const deposits = allTransactions.filter((t) => t.type === 'deposit');
    const withdrawals = allTransactions.filter((t) => t.type === 'withdrawal');
    const trades = allTransactions.filter((t) => ['investment', 'buy', 'sell'].includes(t.type));

    if (totalTransactions) totalTransactions.textContent = allTransactions.length;
    if (depositCount) depositCount.textContent = deposits.length;
    if (withdrawalCount) withdrawalCount.textContent = withdrawals.length;
    if (investmentCount) investmentCount.textContent = trades.length;

    let netFlowAmount = 0;
    allTransactions.forEach((transaction) => {
        const value = Number(transaction.amount || 0);
        if (transaction.type === 'deposit') netFlowAmount += value;
        if (transaction.type === 'withdrawal') netFlowAmount -= value;
        if (transaction.type === 'buy') netFlowAmount -= value;
        if (transaction.type === 'sell') netFlowAmount += value;
        if (transaction.type === 'investment') netFlowAmount -= value;
    });

    if (netFlow) {
        netFlow.textContent = netFlowAmount >= 0 ? `+$${netFlowAmount.toFixed(2)}` : `-$${Math.abs(netFlowAmount).toFixed(2)}`;
        netFlow.className = netFlowAmount >= 0 ? 'text-xl font-bold text-emerald-400' : 'text-xl font-bold text-red-400';
    }
};

const upsertTransaction = (transaction) => {
    const existingIndex = allTransactions.findIndex((t) => t.id === transaction.id && t.type === transaction.type);
    if (existingIndex >= 0) {
        allTransactions[existingIndex] = transaction;
    } else {
        allTransactions.push(transaction);
    }
};

const removeTransaction = (transaction) => {
    allTransactions = allTransactions.filter((t) => !(t.id === transaction.id && t.type === transaction.type));
};

const loadTransactions = () => {
    if (!currentUser) return;

    const depositsQuery = query(collection(db, 'deposits'), where('uid', '==', currentUser.uid));
    onSnapshot(depositsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const deposit = { id: change.doc.id, type: 'deposit', ...change.doc.data() };
            if (change.type === 'removed') removeTransaction(deposit);
            else upsertTransaction(deposit);
        });
        updateStats();
        renderTransactions();
    });

    const withdrawalsQuery = query(collection(db, 'withdrawals'), where('uid', '==', currentUser.uid));
    onSnapshot(withdrawalsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const withdrawal = { id: change.doc.id, type: 'withdrawal', ...change.doc.data() };
            if (change.type === 'removed') removeTransaction(withdrawal);
            else upsertTransaction(withdrawal);
        });
        updateStats();
        renderTransactions();
    });

    const tradesQuery = query(collection(db, 'users', currentUser.uid, 'transactions'));
    onSnapshot(tradesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const transaction = { id: change.doc.id, ...change.doc.data() };
            if (change.type === 'removed') removeTransaction(transaction);
            else upsertTransaction(transaction);
        });
        updateStats();
        renderTransactions();
    });
};

const resetFilters = () => {
    filterAll.className = 'px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700';
    filterDeposits.className = 'px-4 py-2 rounded-full bg-slate-200 text-slate-600 text-sm font-semibold transition hover:bg-slate-300';
    filterWithdrawals.className = 'px-4 py-2 rounded-full bg-slate-200 text-slate-600 text-sm font-semibold transition hover:bg-slate-300';
    filterInvestments.className = 'px-4 py-2 rounded-full bg-slate-200 text-slate-600 text-sm font-semibold transition hover:bg-slate-300';
};

if (filterAll) filterAll.addEventListener('click', () => {
    currentFilter = 'all';
    resetFilters();
    filterAll.className = 'px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700';
    renderTransactions();
});
if (filterDeposits) filterDeposits.addEventListener('click', () => {
    currentFilter = 'deposits';
    resetFilters();
    filterDeposits.className = 'px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700';
    renderTransactions();
});
if (filterWithdrawals) filterWithdrawals.addEventListener('click', () => {
    currentFilter = 'withdrawals';
    resetFilters();
    filterWithdrawals.className = 'px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700';
    renderTransactions();
});
if (filterInvestments) filterInvestments.addEventListener('click', () => {
    currentFilter = 'investments';
    resetFilters();
    filterInvestments.className = 'px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold transition hover:bg-blue-700';
    renderTransactions();
});

if (closeOverlay) {
    closeOverlay.addEventListener('click', () => transactionOverlay.classList.add('hidden'));
}
if (transactionOverlay) {
    transactionOverlay.addEventListener('click', (e) => {
        if (e.target === transactionOverlay) transactionOverlay.classList.add('hidden');
    });
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('../public/index.html');
        return;
    }
    currentUser = user;
    loadTransactions();
});

export {};
