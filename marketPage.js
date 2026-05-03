import { auth, db, onSnapshot, addDoc, setDoc, getDoc, updateDoc, collection, doc, query, orderBy, limit, serverTimestamp, STOCK_LIST, getStockQuery, ensureStockDocs, getLocalStock } from './firestoreService.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const stockLinks = {
    AAPL: 'stocks/apple.html',
    TSLA: 'stocks/tesla.html',
    GOOGL: 'stocks/google.html',
    MSFT: 'stocks/microsoft.html',
    AMZN: 'stocks/amazon.html',
    BTC: 'stocks/btc.html',
    ETH: 'stocks/eth.html',
    OIL: 'stocks/oil-gas.html',
    TECH: 'stocks/tech-index.html'
};

const portfolioValueEl = document.getElementById('portfolioValue');
const marketChangeEl = document.getElementById('marketChange');
const currentTradeSymbol = document.getElementById('tradeSymbol');
const orderTypeInput = document.getElementById('orderType');
const actionInput = document.getElementById('orderAction');
const quantityInput = document.getElementById('quantity');
const priceInput = document.getElementById('price');
const priceField = document.getElementById('priceField');
const stockGrid = document.getElementById('stockGrid');
const chatContainer = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendMessage');
const tradeForm = document.getElementById('tradingForm');

let currentStocks = [];
let portfolioItems = [];
let userBalance = 0;
let currentUser = null;
let chatMessages = [];

function getStockLink(symbol) {
    return stockLinks[symbol] || `stocks/${symbol.toLowerCase()}.html`;
}

function getInitialStocks() {
    return Object.values(STOCK_LIST).map(stock => ({ ...stock, link: getStockLink(stock.symbol) }));
}

function initStockGrid(items) {
    stockGrid.innerHTML = '';
    items.forEach(stock => {
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.onclick = () => window.location.href = stock.link;
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-lg font-bold">${stock.symbol}</h3>
                    <p class="text-gray-600 text-sm">${stock.name}</p>
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold">$${Number(stock.price || 0).toFixed(2)}</div>
                    <div class="price-change ${stock.change >= 0 ? 'positive' : 'negative'} text-sm font-semibold">
                        ${stock.change >= 0 ? '+' : ''}${Number(stock.change || 0).toFixed(2)}%
                    </div>
                </div>
            </div>
            <div class="flex justify-between text-sm text-gray-600 mb-4">
                <span>Volume: ${stock.volume || 'N/A'}</span>
                <span>24h</span>
            </div>
            <div class="flex gap-2">
                <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold" onclick="event.stopPropagation(); quickTrade('${stock.symbol}', 'buy')">
                    Buy
                </button>
                <button class="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-semibold" onclick="event.stopPropagation(); quickTrade('${stock.symbol}', 'sell')">
                    Sell
                </button>
                <button class="px-4 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold" onclick="event.stopPropagation(); window.location.href='${stock.link}'">
                    Details
                </button>
            </div>
        `;
        stockGrid.appendChild(card);
    });
}

window.quickTrade = function(symbol, action) {
    currentTradeSymbol.value = symbol;
    actionInput.value = action;
    tradeForm.scrollIntoView({ behavior: 'smooth' });
};

orderTypeInput.addEventListener('change', function() {
    priceField.style.display = this.value === 'market' ? 'none' : 'block';
});

function renderChat() {
    chatContainer.innerHTML = '';
    chatMessages.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${msg.isAdmin ? 'admin' : ''} ${msg.isPrediction ? 'prediction-message' : ''}`;
        messageDiv.innerHTML = `
            <div class="chat-author font-semibold ${msg.isAdmin ? 'text-yellow-600' : ''}">${msg.author} ${msg.isAdmin ? '👑' : ''}</div>
            <div class="mt-1">${msg.message}</div>
            ${msg.prediction ? `<div class="mt-2 text-sm opacity-90">${msg.prediction}</div>` : ''}
            <div class="text-xs opacity-60 mt-1">${new Date(msg.timestamp?.toDate()).toLocaleTimeString()}</div>
        `;
        chatContainer.appendChild(messageDiv);
    });
}

sendButton.addEventListener('click', async () => {
    const message = chatInput.value.trim();
    if (!message || !currentUser) return;
    try {
        await addDoc(collection(db, 'global_chat'), {
            author: currentUser.displayName || currentUser.email.split('@')[0],
            message,
            timestamp: serverTimestamp(),
            isAdmin: false,
            isPrediction: false,
            prediction: null
        });
        chatInput.value = '';
    } catch (error) {
        console.error('Error sending chat message:', error);
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendButton.click();
});

function updateMarketSummary() {
    const totalValue = portfolioItems.reduce((sum, item) => {
        const price = Number(item.currentPrice || item.price || item.averagePrice || 0);
        return sum + price * Number(item.quantityOwned || 0);
    }, 0);
    portfolioValueEl.innerText = `$${totalValue.toFixed(2)}`;

    const averageChange = currentStocks.length
        ? currentStocks.reduce((acc, stock) => acc + Number(stock.change || 0), 0) / currentStocks.length
        : 0;
    marketChangeEl.textContent = `${averageChange >= 0 ? '+' : ''}${averageChange.toFixed(2)}%`;
    marketChangeEl.classList.toggle('text-green-300', averageChange >= 0);
    marketChangeEl.classList.toggle('text-red-300', averageChange < 0);
}

tradeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentUser) {
        window.location.replace('../public/index.html');
        return;
    }

    const symbol = currentTradeSymbol.value;
    const action = actionInput.value;
    const orderType = orderTypeInput.value;
    const quantity = Number(quantityInput.value);
    const referenceStock = currentStocks.find(stock => stock.symbol === symbol) || getLocalStock(symbol);
    const price = orderType === 'market' ? Number(referenceStock?.price || 0) : Number(priceInput.value);
    const totalCost = Number((price * quantity).toFixed(2));
    const commission = Number((totalCost * 0.002).toFixed(2));

    if (!symbol || quantity <= 0 || price <= 0) {
        alert('Please select a stock, quantity and valid price.');
        return;
    }
    if (totalCost < 20 || totalCost > 2000000) {
        alert('Trades must be between $20 and $2,000,000.');
        return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const portfolioRef = doc(db, 'users', currentUser.uid, 'portfolio', symbol);
    const portfolioSnap = await getDoc(portfolioRef);
    const existing = portfolioSnap.exists() ? portfolioSnap.data() : { quantityOwned: 0, totalInvested: 0, averagePrice: 0 };
    const existingQty = Number(existing.quantityOwned || 0);
    const existingInvested = Number(existing.totalInvested || 0);
    const existingAvg = Number(existing.averagePrice || 0);

    let updatedQty = existingQty;
    let updatedInvested = existingInvested;
    let updatedAvg = existingAvg;
    let newBalance = Number(userBalance || 0);

    if (action === 'buy') {
        const totalDebit = totalCost + commission;
        if (newBalance < totalDebit) {
            alert('Insufficient balance to place this order.');
            return;
        }
        updatedQty = existingQty + quantity;
        updatedInvested = existingInvested + totalCost;
        updatedAvg = updatedQty > 0 ? updatedInvested / updatedQty : 0;
        newBalance = Number((newBalance - totalDebit).toFixed(2));
    } else {
        if (quantity > existingQty) {
            alert('You cannot sell more shares than you own.');
            return;
        }
        const costExiting = existingAvg * quantity;
        updatedQty = existingQty - quantity;
        updatedInvested = Number((existingInvested - costExiting).toFixed(2));
        updatedAvg = updatedQty > 0 ? updatedInvested / updatedQty : 0;
        newBalance = Number((newBalance + totalCost - commission).toFixed(2));
    }

    const portfolioPayload = {
        symbol,
        name: referenceStock?.name || symbol,
        quantityOwned: updatedQty,
        averagePrice: Number(updatedAvg.toFixed(2)),
        totalInvested: Number(updatedInvested.toFixed(2)),
        updatedAt: serverTimestamp()
    };

    const transactionPayload = {
        symbol,
        name: referenceStock?.name || symbol,
        type: action,
        action: action === 'buy' ? 'Market Buy' : 'Market Sell',
        amount: totalCost,
        quantity,
        price,
        status: 'completed',
        commission,
        timestamp: serverTimestamp(),
        marketPrice: price
    };

    try {
        await updateDoc(userRef, {
            usdBalance: newBalance,
            totalBalance: newBalance,
            lastUpdated: serverTimestamp()
        });
        await setDoc(portfolioRef, portfolioPayload, { merge: true });
        await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), transactionPayload);
        alert(`Order executed: ${action.toUpperCase()} ${quantity} ${symbol} for $${totalCost.toFixed(2)}.`);
        quantityInput.value = '';
        priceInput.value = '';
    } catch (error) {
        console.error('Trade failed:', error);
        alert('Unable to execute trade at this time. Please try again later.');
    }
});

async function subscribeMarketData() {
    await ensureStockDocs();
    const stocksQuery = getStockQuery();
    onSnapshot(stocksQuery, (snapshot) => {
        const liveData = {};
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data?.symbol) {
                liveData[data.symbol] = data;
            }
        });
        currentStocks = Object.values(STOCK_LIST).map(stock => ({
            ...stock,
            ...liveData[stock.symbol],
            link: getStockLink(stock.symbol)
        }));
        initStockGrid(currentStocks);
        updateMarketSummary();
    });
}

function subscribeGlobalChat() {
    const chatQuery = query(collection(db, 'global_chat'), orderBy('timestamp', 'desc'), limit(50));
    onSnapshot(chatQuery, (snapshot) => {
        chatMessages = [];
        snapshot.forEach(docSnap => {
            chatMessages.unshift(docSnap.data());
        });
        renderChat();
    });
}

function subscribeUserSnapshot(uid) {
    onSnapshot(doc(db, 'users', uid), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        userBalance = Number(data.usdBalance ?? data.totalBalance ?? data.balance ?? 0);
    });
}

function subscribePortfolio(uid) {
    onSnapshot(collection(db, 'users', uid, 'portfolio'), (snapshot) => {
        portfolioItems = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const price = Number(currentStocks.find(stock => stock.symbol === docSnap.id)?.price || data.averagePrice || 0);
            portfolioItems.push({ id: docSnap.id, ...data, currentPrice: price });
        });
        updateMarketSummary();
    });
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace('../public/index.html');
        return;
    }
    currentUser = user;
    subscribeMarketData();
    subscribeGlobalChat();
    subscribeUserSnapshot(user.uid);
    subscribePortfolio(user.uid);
});

initStockGrid(getInitialStocks());
initStockBook();

function initStockBook() {
    const orderBook = document.getElementById('orderBook');
    const mockOrders = [
        { price: 175.50, quantity: 100, type: 'sell' },
        { price: 175.45, quantity: 250, type: 'sell' },
        { price: 175.40, quantity: 150, type: 'sell' },
        { price: 175.35, quantity: 100, type: 'buy' },
        { price: 175.30, quantity: 200, type: 'buy' },
        { price: 175.25, quantity: 300, type: 'buy' }
    ];

    orderBook.innerHTML = `
        <div class="grid grid-cols-3 gap-4 mb-4 font-semibold text-sm">
            <div>Price</div>
            <div>Quantity</div>
            <div>Total</div>
        </div>
        ${mockOrders.map(order => `
            <div class="grid grid-cols-3 gap-4 py-2 text-sm border-b border-gray-100">
                <div class="${order.type === 'buy' ? 'text-green-600' : 'text-red-600'} font-semibold">$${order.price}</div>
                <div>${order.quantity}</div>
                <div>$${(order.price * order.quantity).toLocaleString()}</div>
            </div>
        `).join('')}
    `;
}

lucide.createIcons();

export {};
