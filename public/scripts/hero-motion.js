(function () {
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (reduced) {
		document.querySelectorAll("[data-countup]").forEach((el) => {
			const n = el.getAttribute("data-countup");
			const suffix = el.getAttribute("data-suffix") || "";
			if (n) el.textContent = n + suffix;
		});
		document.querySelectorAll("[data-countup-text]").forEach((el) => {
			const t = el.getAttribute("data-countup-text");
			if (t) el.textContent = t;
		});
		return;
	}

	function animateCount(el) {
		const target = Number(el.getAttribute("data-countup"));
		const suffix = el.getAttribute("data-suffix") || "";
		if (!Number.isFinite(target)) return;
		const duration = 900;
		const start = performance.now();
		function frame(now) {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - (1 - t) ** 3;
			el.textContent = Math.round(target * eased) + suffix;
			if (t < 1) requestAnimationFrame(frame);
		}
		requestAnimationFrame(frame);
	}

	const board = document.querySelector(".market-board-live");
	if (board) {
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					board.querySelectorAll("[data-countup]").forEach(animateCount);
					board.querySelectorAll("[data-countup-text]").forEach((el) => {
						const t = el.getAttribute("data-countup-text");
						if (t) el.textContent = t;
					});
					io.disconnect();
				}
			},
			{ threshold: 0.35 },
		);
		io.observe(board);
	}
})();
