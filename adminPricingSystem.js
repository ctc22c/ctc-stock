/**
 * CENTRALIZED ADMIN PRICING & TRANSACTION SYSTEM
 * 
 * Setup Required in Firebase Firestore:
 * Create document: admin_controls/market_rates
 * Structure:
 * {
 *   "AAPL": { "price": 175.43, "change": 2.34, "volume": "45.2M" },
 *   "TSLA": { "price": 248.50, "change": -1.23, "volume": "32.1M" },
 *   ... (all other stocks)
 * }
 */

import { db, auth, serverTimestamp } from './firestoreService.js';
import { doc, getDoc, onSnapshot, collection, addDoc, updateDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PRICE_DOC_PATH = 'admin_controls/market_rates';
let liveStockPrices = {};
let priceUnsubscribe = null;

// ===== 1. CENTRALIZED PRICE CONTROL =====

/**
 * Subscribe to real-time price updates from Firestore
 * Automatically updates UI when prices change
 */
export async function initializePriceSubscription() {
    return new Promise((resolve) => {
        priceUnsubscribe = onSnapshot(doc(db, PRICE_DOC_PATH), (snapDoc) => {
            if (snapDoc.exists()) {
                liveStockPrices = snapDoc.data();
                updateAllPriceDisplays();
            }
            resolve();
        }, (error) => {
            console.error('Error subscribing to prices:', error);
            resolve();
        });
    });
}

/**
 * Get live price for a single stock from Firestore cache
 */
export function getLivePrice(symbol) {
    return liveStockPrices[symbol]?.price || null;
}

/**
 * Get live stock data (price, change, volume)
 */
export function getLiveStockData(symbol) {
    return liveStockPrices[symbol] || null;
}

/**
 * Update all price displays on current page
 * Finds any element with data-symbol and updates its price
 */
function updateAllPriceDisplays() {
    document.querySelectorAll('[data-price-symbol]').forEach(element => {
        const symbol = element.dataset.priceSymbol;
        const price = getLivePrice(symbol);
        if (price) {
            element.textContent = `$${price.toFixed(2)}`;
            element.classList.add('price-updated');
        }
    });

    document.querySelectorAll('[data-change-symbol]').forEach(element => {
        const symbol = element.dataset.changeSymbol;
        const stockData = getLiveStockData(symbol);
        if (stockData) {
            element.textContent = `${stockData.change >= 0 ? '+' : ''}${stockData.change.toFixed(2)}%`;
            element.className = stockData.change >= 0 ? 'text-green-500' : 'text-red-500';
        }
    });

    document.querySelectorAll('[data-volume-symbol]').forEach(element => {
        const symbol = element.dataset.volumeSymbol;
        const stockData = getLiveStockData(symbol);
        if (stockData) {
            element.textContent = stockData.volume;
        }
    });
}

/**
 * Cleanup price subscription (call on page unload)
 */
export function unsubscribeFromPrices() {
    if (priceUnsubscribe) priceUnsubscribe();
}

// ===== 2. TRANSACTION & BUY LOGIC =====

/**
 * Handle Buy button click
 * Creates a PENDING transaction without debiting
 * User calls this when Buy button is clicked
 */
export async function handleBuyOrder(userId, symbol, quantity, orderType = 'limit', limitPrice = null) {
    try {
        const livePrice = getLivePrice(symbol);
        if (!livePrice) {
            console.error('Price not found for symbol:', symbol);
            return { success: false, error: 'Stock price unavailable' };
        }

        const executionPrice = orderType === 'market' ? livePrice : limitPrice;
        if (!executionPrice || executionPrice <= 0) {
            return { success: false, error: 'Invalid price provided' };
        }

        const totalCost = executionPrice * quantity;

        // Check user balance in transaction
        const result = await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) {
                throw new Error('User not found');
            }

            const userData = userSnap.data();
            const availableBalance = userData.usdBalance || userData.totalBalance || 0;

            if (availableBalance < totalCost) {
                throw new Error(`Insufficient balance. Need $${totalCost.toFixed(2)}, have $${availableBalance.toFixed(2)}`);
            }

            // IMPORTANT: DO NOT debit here - only create pending transaction
            // Money will be debited when admin approves (status: "success")

            return { availableBalance, totalCost };
        });

        // Now create the pending transaction document
        const transactionRef = await addDoc(collection(db, 'transactions'), {
            userId,
            symbol,
            quantity,
            buyPrice: executionPrice,
            totalCost,
            orderType,
            status: 'pending',
            createdAt: serverTimestamp(),
            approvedAt: null,
            completedAt: null,
            notes: `Pending ${orderType} order for ${quantity} shares of ${symbol}`
        });

        return {
            success: true,
            transactionId: transactionRef.id,
            totalCost,
            message: `Order created. Waiting for admin approval.`
        };

    } catch (error) {
        console.error('Buy order error:', error);
        return { success: false, error: error.message };
    }
}

// ===== 3. ADMIN APPROVAL & AUTO-DEBITING =====

/**
 * Monitor transaction status for a specific user
 * Call this on dashboard to listen for approved transactions
 * Auto-debits and updates portfolio when status changes to "success"
 */
export function subscribeToUserTransactions(userId, onApproved) {
    return onSnapshot(
        collection(db, 'transactions'),
        (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                const transaction = change.doc.data();

                // Only process user's transactions
                if (transaction.userId !== userId) return;

                // Only process newly approved transactions
                if (change.type === 'modified' && transaction.status === 'success') {
                    if (!transaction.debitProcessed) {
                        await applyTransactionSuccess(userId, transaction, change.doc.id);
                        if (onApproved) onApproved(transaction);
                    }
                }
            });
        }
    );
}

/**
 * Apply transaction success:
 * 1. Debit money from user's totalBalance
 * 2. Add position to portfolio
 * 3. Update dashboard metrics
 * 4. Mark debit as processed to prevent double-charging
 */
async function applyTransactionSuccess(userId, transaction, transactionId) {
    try {
        await runTransaction(db, async (txn) => {
            const userRef = doc(db, 'users', userId);
            const portfolioRef = doc(db, 'users', userId, 'portfolio', transaction.symbol);

            const userSnap = await txn.get(userRef);
            if (!userSnap.exists()) throw new Error('User not found');

            const userData = userSnap.data();
            const currentBalance = userData.usdBalance || userData.totalBalance || 0;
            const newBalance = currentBalance - transaction.totalCost;

            // Debit the money
            txn.update(userRef, {
                usdBalance: newBalance,
                totalBalance: newBalance,
                lastTransaction: serverTimestamp()
            });

            // Add or update portfolio position
            const portfolioSnap = await txn.get(portfolioRef);
            let updatedPortfolio;

            if (portfolioSnap.exists()) {
                const existing = portfolioSnap.data();
                updatedPortfolio = {
                    ...existing,
                    quantityOwned: (existing.quantityOwned || 0) + transaction.quantity,
                    totalInvested: (existing.totalInvested || 0) + transaction.totalCost,
                    averagePrice: ((existing.totalInvested || 0) + transaction.totalCost) / ((existing.quantityOwned || 0) + transaction.quantity)
                };
            } else {
                updatedPortfolio = {
                    symbol: transaction.symbol,
                    quantityOwned: transaction.quantity,
                    totalInvested: transaction.totalCost,
                    averagePrice: transaction.buyPrice,
                    currentPrice: transaction.buyPrice,
                    createdAt: serverTimestamp()
                };
            }

            txn.set(portfolioRef, updatedPortfolio, { merge: true });

            // Mark transaction as debit processed
            txn.update(doc(db, 'transactions', transactionId), {
                debitProcessed: true,
                completedAt: serverTimestamp()
            });
        });

        // Update dashboard metrics after successful debit
        await updateDashboardMetrics(userId);

        console.log(`✅ Transaction approved and debited: ${transaction.symbol}`);

    } catch (error) {
        console.error('Error applying transaction success:', error);
    }
}

// ===== 4. DASHBOARD METRICS UPDATE =====

/**
 * Update dashboard metrics (Accrued Profit, Portfolio ROI)
 * Compares buy prices in portfolio to live prices in admin_controls
 */
export async function updateDashboardMetrics(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const portfolioRef = collection(db, 'users', userId, 'portfolio');

        // Get all portfolio items
        const portfolioSnap = new Promise((resolve) => {
            onSnapshot(portfolioRef, (snap) => {
                resolve(snap);
            });
        });

        const portfolio = await portfolioSnap;
        let totalInvested = 0;
        let totalCurrentValue = 0;

        portfolio.forEach((item) => {
            const holding = item.data();
            const livePrice = getLivePrice(holding.symbol) || holding.currentPrice;
            
            const invested = holding.totalInvested || 0;
            const currentValue = (holding.quantityOwned || 0) * livePrice;

            totalInvested += invested;
            totalCurrentValue += currentValue;
        });

        const accruedProfit = totalCurrentValue - totalInvested;
        const roi = totalInvested > 0 ? ((accruedProfit / totalInvested) * 100) : 0;

        // Update user document with calculated metrics
        await updateDoc(userRef, {
            accruedProfit,
            portfolioROI: roi,
            totalPortfolioValue: totalCurrentValue,
            lastMetricsUpdate: serverTimestamp()
        });

        // Update dashboard displays if they exist
        const profitEl = document.getElementById('accruedProfit') || document.getElementById('userProfit');
        const roiEl = document.getElementById('portfolioROI') || document.getElementById('activeRoi');

        if (profitEl) {
            profitEl.textContent = `${accruedProfit >= 0 ? '+' : ''}$${accruedProfit.toFixed(2)}`;
            profitEl.className = accruedProfit >= 0 ? 'text-emerald-600' : 'text-red-600';
        }

        if (roiEl) {
            roiEl.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`;
            roiEl.className = roi >= 0 ? 'text-emerald-600' : 'text-red-600';
        }

        console.log(`📊 Dashboard metrics updated - Profit: $${accruedProfit.toFixed(2)}, ROI: ${roi.toFixed(2)}%`);

    } catch (error) {
        console.error('Error updating dashboard metrics:', error);
    }
}

/**
 * Get formatted price for display
 */
export function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

/**
 * Get formatted percentage
 */
export function formatPercent(value) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}