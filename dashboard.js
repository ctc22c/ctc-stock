document.addEventListener('DOMContentLoaded', () => {
    // Initializing Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Simple Currency Switcher
    const selector = document.getElementById('currencySelector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            const symbols = document.querySelectorAll('.currencySymbol');
            const val = e.target.value;
            let s = '$';
            if (val === 'NGN') s = '₦';
            if (val === 'BTC') s = '₿';
            symbols.forEach(el => el.innerText = s);
        });
    }
});