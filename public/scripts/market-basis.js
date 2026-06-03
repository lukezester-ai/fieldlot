/**
 * Fetches MATIF prices and calculates local basis (discount) to show in a ticker
 */
(function initMarketTicker() {
	const tickerEl = document.getElementById('market-ticker');
	const streamEl = document.getElementById('ticker-stream');
	if (!tickerEl || !streamEl) return;

	// Local basis (discount) per ton in BGN for Varna/Constanta
	// Typically, local physical grain is cheaper than MATIF due to freight to destination
	const LOCAL_BASIS_WHEAT = -40;
	const LOCAL_BASIS_SUNFLOWER = -50;
	const LOCAL_BASIS_CORN = -35;
	const LOCAL_BASIS_RAPESEED = -60;

	async function loadTicker() {
		try {
			const res = await fetch('/api/market/exchange');
			if (!res.ok) return;
			const data = await res.json();
			if (!data || !data.quotes || data.quotes.length === 0) return;

			let html = '';
			data.quotes.forEach(q => {
				const price = parseFloat(q.price);
				if (isNaN(price)) return;

				let basis = 0;
				let name = q.product.toLowerCase();
				if (name.includes('пшеница') || name.includes('wheat')) basis = LOCAL_BASIS_WHEAT;
				else if (name.includes('слънчоглед') || name.includes('sunflower')) basis = LOCAL_BASIS_SUNFLOWER;
				else if (name.includes('царевица') || name.includes('corn')) basis = LOCAL_BASIS_CORN;
				else if (name.includes('рапица') || name.includes('rape')) basis = LOCAL_BASIS_RAPESEED;

				const localPrice = price + basis;
				const arrow = q.trend === 'up' ? '▲' : (q.trend === 'down' ? '▼' : '▬');
				const trendClass = q.trend === 'up' ? 'up' : (q.trend === 'down' ? 'down' : 'flat');

				html += `
					<div class="ticker-item">
						<span class="ticker-symbol">MATIF ${q.product}</span>
						<span class="ticker-price ${trendClass}">${q.price} лв <small>${arrow}</small></span>
						<span class="ticker-basis">| Локално (CPT Варна): <strong style="color:var(--primary-color)">~${localPrice.toFixed(2)} лв</strong></span>
					</div>
				`;
			});

			// Duplicate for seamless scroll
			streamEl.innerHTML = html + html;
			tickerEl.style.display = 'block';
		} catch (e) {
			console.error("Failed to load ticker", e);
		}
	}

	loadTicker();
})();
