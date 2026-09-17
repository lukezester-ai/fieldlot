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
		await addDoc(collection(db, "inquiries"), {
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
		});
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
window.FieldlotInquiries = { open };
