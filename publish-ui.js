import { auth, db, storage } from "./firebase-init.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const publishModalHTML = `
<style>
.fl-publish-backdrop {
	position: fixed; top: 0; left: 0; width: 100%; height: 100%;
	background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
	display: flex; align-items: center; justify-content: center;
	z-index: 10000; opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.fl-publish-backdrop.open { opacity: 1; pointer-events: auto; }
.fl-publish-modal {
	background: var(--bg-card); width: 100%; max-width: 500px;
	border-radius: var(--radius-lg); padding: 32px; position: relative;
	box-shadow: var(--shadow-lg); transform: translateY(20px);
	transition: transform 0.3s; border: 1px solid var(--border-color);
	max-height: 90vh; overflow-y: auto; color: var(--text-main);
}
.fl-publish-backdrop.open .fl-publish-modal { transform: translateY(0); }
.fl-publish-close {
	position: absolute; top: 16px; right: 16px; background: none; border: none;
	font-size: 28px; cursor: pointer; color: var(--neutral-400); transition: color 0.2s;
}
.fl-publish-close:hover { color: var(--neutral-900); }
.fl-publish-title { font-size: 1.8rem; margin-bottom: 24px; color: var(--text-main); font-weight: 700; }
.fl-form-group { margin-bottom: 16px; }
.fl-form-group label { display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-muted); font-size: 0.9rem; }
.fl-form-group input, .fl-form-group select, .fl-form-group textarea {
	width: 100%; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color);
	background: var(--bg-body); color: var(--text-main); font-family: inherit; font-size: 1rem;
	transition: border-color 0.2s, background 0.2s; box-sizing: border-box;
}
.fl-form-group input:focus, .fl-form-group select:focus, .fl-form-group textarea:focus {
	outline: none; border-color: var(--primary); background: var(--bg-card); box-shadow: 0 0 0 3px var(--primary-soft);
}
.fl-submit-btn {
	width: 100%; padding: 14px; background: var(--primary); color: white;
	border: none; border-radius: 40px; font-weight: 600; font-size: 1.1rem;
	cursor: pointer; transition: background 0.2s; margin-top: 10px;
}
.fl-submit-btn:hover { background: var(--primary-dark); }
.fl-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }
.fl-error { color: #d32f2f; font-size: 0.95rem; margin-bottom: 16px; display: none; padding: 10px; background: #ffebee; border-radius: 6px; }
.fl-success { color: var(--primary); font-size: 0.95rem; margin-bottom: 16px; display: none; padding: 10px; background: var(--primary-soft); border-radius: 6px; }
</style>

<div class="fl-publish-backdrop" id="fl-publish-backdrop">
	<div class="fl-publish-modal">
		<button class="fl-publish-close" id="fl-publish-close">&times;</button>
		<h2 class="fl-publish-title">Публикувай обява</h2>
		
		<div id="fl-publish-error" class="fl-error"></div>
		<div id="fl-publish-success" class="fl-success"></div>
		
		<form id="fl-publish-form">
			<div class="fl-form-group">
				<label>Заглавие (напр. Розови домати)</label>
				<input type="text" id="pub-title" required placeholder="Какво продавате?" />
			</div>
			<div style="display: flex; gap: 16px;">
				<div class="fl-form-group" style="flex: 1;">
					<label>Категория</label>
					<select id="pub-category" required>
						<option value="veg">Зеленчуци</option>
						<option value="fruit">Плодове</option>
						<option value="grain">Зърно</option>
						<option value="oil">Маслодайни</option>
						<option value="canned">Консерви</option>
						<option value="fertilizer">Торове</option>
						<option value="machines">Машини</option>
						<option value="feed">Фураж</option>
					</select>
				</div>
				<div class="fl-form-group" style="flex: 1;">
					<label>Цена (лв.)</label>
					<input type="number" step="0.01" id="pub-price" required placeholder="0.00" />
				</div>
			</div>
			<div style="display: flex; gap: 16px;">
				<div class="fl-form-group" style="flex: 1;">
					<label>Количество</label>
					<input type="text" id="pub-quantity" required placeholder="напр. 1000 кг" />
				</div>
				<div class="fl-form-group" style="flex: 1;">
					<label>Локация</label>
					<input type="text" id="pub-location" required placeholder="напр. Пловдив" />
				</div>
			</div>
			<div class="fl-form-group">
				<label>Снимка</label>
				<input type="file" id="pub-image" accept="image/*" />
			</div>
			<div class="fl-form-group">
				<label>Допълнително описание (опционално)</label>
				<textarea id="pub-desc" rows="3" placeholder="Сорт, сертификати, качество..."></textarea>
			</div>
			<button type="submit" class="fl-submit-btn" id="pub-submit-btn">Публикувай</button>
		</form>
	</div>
</div>
`;

function injectPublishModal() {
	if (document.getElementById("fl-publish-backdrop")) return;
	document.body.insertAdjacentHTML("beforeend", publishModalHTML);

	const backdrop = document.getElementById("fl-publish-backdrop");
	const closeBtn = document.getElementById("fl-publish-close");
	const form = document.getElementById("fl-publish-form");
	const errorEl = document.getElementById("fl-publish-error");
	const successEl = document.getElementById("fl-publish-success");
	const submitBtn = document.getElementById("pub-submit-btn");

	// Use event delegation because the button is recreated by auth-ui.js dynamically
	document.body.addEventListener("click", (e) => {
		const btn = e.target.closest(".btn-publish");
		if (btn) {
			e.preventDefault();
			if (!auth.currentUser) {
				// Show Auth modal if not logged in
				const authBackdrop = document.getElementById("fl-auth-backdrop");
				if (authBackdrop) authBackdrop.classList.add("active");
				else alert("Моля, влезте в профила си, за да публикувате обява.");
				return;
			}
			backdrop.classList.add("open");
			errorEl.style.display = "none";
			successEl.style.display = "none";
			form.reset();
		}
	});

	closeBtn.addEventListener("click", () => backdrop.classList.remove("open"));
	backdrop.addEventListener("click", (e) => {
		if (e.target === backdrop) backdrop.classList.remove("open");
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!auth.currentUser) return;

		errorEl.style.display = "none";
		successEl.style.display = "none";
		submitBtn.disabled = true;
		submitBtn.textContent = "Публикуване...";

		try {
			const title = document.getElementById("pub-title").value.trim();
			const category = document.getElementById("pub-category").value;
			const price = parseFloat(document.getElementById("pub-price").value);
			const quantity = document.getElementById("pub-quantity").value.trim();
			const location = document.getElementById("pub-location").value.trim();
			const desc = document.getElementById("pub-desc").value.trim();
			const fileInput = document.getElementById("pub-image");
			
			let imageUrl = "";
			if (fileInput.files.length > 0) {
				const file = fileInput.files[0];
				// Upload to Firebase Storage
				const storageRef = ref(storage, `listings/${Date.now()}_${file.name}`);
				const snapshot = await uploadBytes(storageRef, file);
				imageUrl = await getDownloadURL(snapshot.ref);
			}

			// Save to Firestore
			await addDoc(collection(db, "listings"), {
				title,
				category,
				price,
				qty: quantity,
				location,
				desc,
				imageUrl,
				userId: auth.currentUser.uid,
				userEmail: auth.currentUser.email,
				createdAt: serverTimestamp(),
				status: "active"
			});

			successEl.textContent = "Обявата е публикувана успешно!";
			successEl.style.display = "block";
			form.reset();
			
			setTimeout(() => {
				backdrop.classList.remove("open");
			}, 2000);
			
		} catch (err) {
			console.error("Error publishing listing:", err);
			errorEl.textContent = "Грешка при публикуване: " + err.message;
			errorEl.style.display = "block";
		} finally {
			submitBtn.disabled = false;
			submitBtn.textContent = "Публикувай";
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", injectPublishModal);
} else {
	injectPublishModal();
}
