import { auth, db } from "./firebase-init.js";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const markup = `
<div class="inquiry-backdrop" id="inquiry-backdrop" hidden>
	<section class="inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="inquiry-title">
		<button type="button" class="inquiry-close" aria-label="Затвори">×</button>
		<p class="board-eyebrow">Директен контакт</p>
		<h2 id="inquiry-title">Изпрати запитване</h2>
		<p class="inquiry-listing" id="inquiry-listing"></p>
		<form id="inquiry-form">
			<label>Вашето име<input id="inquiry-name" type="text" maxlength="100" required autocomplete="name"></label>
			<label>Желано количество<input id="inquiry-qty" type="text" maxlength="40" placeholder="напр. 24 т"></label>
			<label>Цена / Incoterm<input id="inquiry-price" type="text" maxlength="40" placeholder="напр. 420 EUR/t DAP"></label>
			<label>Съобщение<textarea id="inquiry-message" rows="5" minlength="10" maxlength="1500" required placeholder="Посочете желано количество, доставка и удобен начин за контакт."></textarea></label>
			<p class="inquiry-feedback" id="inquiry-feedback" role="status"></p>
			<button class="btn btn-primary" type="submit">Изпрати запитването</button>
		</form>
	</section>
</div>`;

document.body.insertAdjacentHTML("beforeend", markup);
const backdrop = document.getElementById("inquiry-backdrop");
const form = document.getElementById("inquiry-form");
const feedback = document.getElementById("inquiry-feedback");
let listing = null;

function close() {
	backdrop.classList.remove("open");
	setTimeout(() => { backdrop.hidden = true; }, 180);
}

function open(item) {
	if (!auth.currentUser) {
		document.getElementById("nav-login")?.click();
		if (!document.getElementById("nav-login")) alert("Влезте в профила си, за да изпратите запитване.");
		return;
	}
	if (auth.currentUser.uid === item.userId) {
		alert("Това е ваша обява. Запитванията от купувачи ще се виждат в таблото ви.");
		return;
	}
	listing = item;
	document.getElementById("inquiry-listing").textContent = item.title;
	document.getElementById("inquiry-name").value = auth.currentUser.displayName || "";
	feedback.textContent = "";
	form.reset();
	document.getElementById("inquiry-name").value = auth.currentUser.displayName || "";
	backdrop.hidden = false;
	requestAnimationFrame(() => backdrop.classList.add("open"));
}

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	if (!auth.currentUser || !listing) return;
	const submit = form.querySelector('button[type="submit"]');
	submit.disabled = true;
	submit.textContent = "Изпращане...";
	feedback.textContent = "";
	try {
		const requestQty = document.getElementById("inquiry-qty").value.trim();
		const requestPrice = document.getElementById("inquiry-price").value.trim();
		const payload = {
			listingId: listing.id,
			listingTitle: listing.title,
			listingOwnerId: listing.userId,
			buyerId: auth.currentUser.uid,
			buyerEmail: auth.currentUser.email,
			buyerName: document.getElementById("inquiry-name").value.trim(),
			message: document.getElementById("inquiry-message").value.trim(),
			status: "new",
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp()
		};
		if (requestQty) payload.requestQty = requestQty;
		if (requestPrice) payload.requestPrice = requestPrice;
		await addDoc(collection(db, "inquiries"), payload);
		fetch("/api/notify-inquiry", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				listingTitle: listing.title,
				listingId: listing.id,
				buyerName: payload.buyerName,
				buyerEmail: payload.buyerEmail,
				message: payload.message,
				requestQty,
				requestPrice,
			}),
		}).catch(() => {});
		feedback.className = "inquiry-feedback success";
		feedback.textContent = "Запитването е изпратено успешно.";
		setTimeout(close, 1200);
	} catch (error) {
		console.error("Error sending inquiry:", error);
		feedback.className = "inquiry-feedback error";
		feedback.textContent = "Запитването не беше изпратено. Опитайте отново.";
	} finally {
		submit.disabled = false;
		submit.textContent = "Изпрати запитването";
	}
});

backdrop.querySelector(".inquiry-close").addEventListener("click", close);
backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
window.FieldlotInquiries = {
	open,
	async report(listingId) {
		if (!auth.currentUser) {
			alert("Влезте, за да докладвате обява.");
			return;
		}
		const reason = window.prompt("Причина (мин. 4 символа):", "Подозрителна обява");
		if (!reason || reason.trim().length < 4) return;
		await addDoc(collection(db, "reports"), {
			listingId,
			reason: reason.trim().slice(0, 500),
			reporterId: auth.currentUser.uid,
			createdAt: serverTimestamp(),
		});
		alert("Докладът е записан за преглед.");
	},
};
