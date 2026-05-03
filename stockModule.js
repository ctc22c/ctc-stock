// Shared Stock Module for all stock pages
export async function initializeStockPage(stockSymbol, stockData) {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
    const { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');

    const firebaseConfig = {
        apiKey: "AIzaSyAjx0r8OsJAEI8sdTopWadcGYcnD9jcme4",
        authDomain: "ctc-capital.firebaseapp.com",
        projectId: "ctc-capital",
        storageBucket: "ctc-capital.appspot.com",
        messagingSenderId: "968357893850",
        appId: "1:968357893850:web:aa800c38df2e89ac2db5c1"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    let currentUser = null;
    let userBalance = 0;

    // Setup UI
    document.getElementById('currentPrice').textContent = `$${stockData.price.toFixed(2)}`;
    document.getElementById('priceChange').textContent = `${stockData.change >= 0 ? '+' : ''}${stockData.change}%`;
    document.getElementById('priceChange').className = stockData.change >= 0 ? 'text-xl font-semibold price-positive' : 'text-xl font-semibold price-negative';

    // Auth listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadUserBalance(db);
            loadTransactionHistory(db, stockSymbol);
            loadHoldings(db, stockSymbol, stockData.price);
        }
    });

    // Load balance
    function loadUserBalance(db) {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
                userBalance = parseFloat(snap.data().usdBalance || 0);
                document.getElementById('balanceDisplay').textContent = `$${userBalance.toFixed(2)}`;
            }
        });
    }

    // Load transaction history
    function loadTransactionHistory(db, stockSymbol) {
        if (!currentUser) return;
        const q = query(
            collection(db, 'users', currentUser.uid, 'transactions'),
            where('symbol', '==', stockSymbol),
            orderBy('timestamp', 'desc')
        );
        
        onSnapshot(q, (snap) => {
            const container = document.getElementById('transactionHistory');
            if (snap.empty) {
                container.innerHTML = '<div class="text-gray-500 text-sm">No transactions yet</div>';
                return;
            }
            
            container.innerHTML = '';
            snap.forEach(doc => {
                const tx = doc.data();
                const date = new Date(tx.timestamp?.toDate()).toLocaleDateString();
                const item = document.createElement('div');
                item.className = 'p-3 bg-gray-50 rounded-lg text-sm';
                item.innerHTML = `
                    <div class="flex justify-between">
                        <span class="font-semibold">${tx.quantity.toFixed(2)} shares</span>
                        <span class="text-green-600">$${tx.totalAmount.toFixed(2)}</span>
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${date}</div>
                `;
                container.appendChild(item);
            });
        });
    }

    // Load holdings
    function loadHoldings(db, stockSymbol, currentPrice) {
        if (!currentUser) return;
        const q = query(
            collection(db, 'users', currentUser.uid, 'portfolio'),
            where('symbol', '==', stockSymbol)
        );
        
        onSnapshot(q, (snap) => {
            let totalShares = 0;
            let totalInvested = 0;
            
            snap.forEach(doc => {
                const holding = doc.data();
                totalShares += holding.quantity || 0;
                totalInvested += holding.totalAmount || 0;
            });
            
            const currentValue = totalShares * currentPrice;
            const profit = currentValue - totalInvested;
            
            document.getElementById('totalShares').textContent = totalShares.toFixed(2);
            document.getElementById('totalInvested').textContent = `$${totalInvested.toFixed(2)}`;
            document.getElementById('currentValue').textContent = `$${currentValue.toFixed(2)}`;
            document.getElementById('accruedProfit').textContent = `$${profit.toFixed(2)}`;
            document.getElementById('accruedProfit').className = 'text-2xl font-bold ' + (profit >= 0 ? 'text-green-600' : 'text-red-600');
        });
    }

    // Buy stock handler
    document.getElementById('buyForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentUser) {
            alert('Please login first');
            return;
        }

        const amount = parseFloat(document.getElementById('buyAmount').value);
        
        if (!amount || amount < 20 || amount > 2000000) {
            alert('Amount must be between $20 and $2,000,000');
            return;
        }

        if (amount > userBalance) {
            alert(`Insufficient balance. You have $${userBalance.toFixed(2)}`);
            return;
        }

        const shares = amount / stockData.price;
        const commission = amount * 0.01; // 1% commission

        try {
            // Add transaction
            await addDoc(collection(db, 'users', currentUser.uid, 'transactions'), {
                symbol: stockSymbol,
                quantity: shares,
                pricePerShare: stockData.price,
                totalAmount: amount,
                commission: commission,
                timestamp: serverTimestamp(),
                type: 'buy'
            });

            // Add to portfolio
            await addDoc(collection(db, 'users', currentUser.uid, 'portfolio'), {
                symbol: stockSymbol,
                quantity: shares,
                pricePerShare: stockData.price,
                totalAmount: amount,
                purchaseDate: serverTimestamp(),
                commission: commission
            });

            // Update user balance
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                usdBalance: userBalance - amount - commission
            });

            // Add to global trades
            await addDoc(collection(db, 'global_trades'), {
                uid: currentUser.uid,
                user: currentUser.displayName || currentUser.email,
                symbol: stockSymbol,
                quantity: shares,
                totalAmount: amount,
                commission: commission,
                timestamp: serverTimestamp()
            });

            alert(`✅ Purchased ${shares.toFixed(2)} shares of ${stockSymbol} for $${amount.toFixed(2)} (Commission: $${commission.toFixed(2)})`);
            document.getElementById('buyForm').reset();
            document.getElementById('sharesToBuy').textContent = '0 shares';
        } catch (error) {
            alert('Error: ' + error.message);
            console.error(error);
        }
    });

    // Calculate shares on input
    document.getElementById('buyAmount').addEventListener('input', (e) => {
        const amount = parseFloat(e.target.value) || 0;
        const shares = amount / stockData.price;
        document.getElementById('sharesToBuy').textContent = `${shares.toFixed(4)} shares`;
    });
}
