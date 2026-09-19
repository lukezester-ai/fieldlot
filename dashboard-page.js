import { auth, db, storage } from "./firebase-init.js";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const grid = document.getElementById("dashboard-listings-grid");
const emailInput = document.getElementById("profile-email");
const companyInput = document.getElementById("profile-company");
const typeInput = document.getElementById("profile-type");
const descInput = document.getElementById("profile-desc");
const videoInput = document.getElementById("profile-video");
const imageInput = document.getElementById("profile-image");
const imagePreview = document.getElementById("profile-image-preview");
const publicConsentInput = document.getElementById("profile-public-consent");
const certCheckboxes = document.querySelectorAll('input[name="certs"]');
const profileForm = document.getElementById("profile-form");

// Handle image preview
imageInput.addEventListener('change', () => {
	const file = imageInput.files[0];
	if (file) {
		const reader = new FileReader();
		reader.onload = (e) => {
			imagePreview.querySelector('img').src = e.target.result;
			imagePreview.style.display = 'block';
		};
		reader.readAsDataURL(file);
	} else {
		imagePreview.style.display = 'none';
		imagePreview.querySelector('img').src = '';
	}
});

const tabListings = document.getElementById("tab-listings");
const tabInquiries = document.getElementById("tab-inquiries");
const tabProfile = document.getElementById("tab-profile");
const viewListings = document.getElementById("view-listings");
const viewInquiries = document.getElementById("view-inquiries");
const viewProfile = document.getElementById("view-profile");
const inquiriesEl = document.getElementById("dashboard-inquiries");
const inquiryCountEl = document.getElementById("inquiry-count");

const btnNewListing = document.getElementById("btn-new-listing");

function showView(name) {
	const tabs = { listings: tabListings, inquiries: tabInquiries, profile: tabProfile };
	const views = { listings: viewListings, inquiries: viewInquiries, profile: viewProfile };
	Object.entries(tabs).forEach(([key, tab]) => tab?.classList.toggle("active", key === name));
	Object.entries(views).forEach(([key, view]) => { if (view) view.style.display = key === name ? "block" : "none"; });
	if (name === "inquiries") loadInquiries();
}

tabListings.addEventListener("click", (e) => { e.preventDefault(); showView("listings"); });
tabInquiries.addEventListener("click", (e) => { e.preventDefault(); showView("inquiries"); });
tabProfile.addEventListener("click", (e) => { e.preventDefault(); showView("profile"); });

// New Listing Button hooks into existing publish-ui.js logic
btnNewListing.addEventListener("click", () => {
	// simulate click on publish button from header
	const navPublish = document.getElementById("nav-publish");
	if (navPublish) navPublish.click();
});

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
	if (!user) {
		// Not logged in, redirect to home
		window.location.href = "/";
		return;
	}
	
	currentUser = user;
	emailInput.value = user.email;
	
	// Fetch user profile data
	try {
		const userDoc = await getDoc(doc(db, "users", user.uid));
		if (userDoc.exists()) {
			const data = userDoc.data();
			if (data.companyName) companyInput.value = data.companyName;
			if (data.profileType) typeInput.value = data.profileType;
			if (data.profileDesc) descInput.value = data.profileDesc;
			if (data.profileVideo) videoInput.value = data.profileVideo;
			if (data.publicConsent) publicConsentInput.checked = data.publicConsent;
			
			if (data.certs && Array.isArray(data.certs)) {
				certCheckboxes.forEach(cb => {
					cb.checked = data.certs.includes(cb.value);
				});
			}

			if (data.profileImageUrl) {
				imagePreview.querySelector('img').src = data.profileImageUrl;
				imagePreview.style.display = 'block';
			}
		}
	} catch (e) {
		console.error("Error fetching profile:", e);
	}
	
	loadMyListings();
	loadInquiries();
});

function formatDate(value) {
	const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
	return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("bg-BG") : "току-що";
}

const STATUS_LABELS = {
	new: "Ново",
	contacted: "Свързах се",
	offer: "Оферта",
	accepted: "Прието",
	closed: "Приключено",
};

async function loadInquiries() {
	if (!currentUser || !inquiriesEl) return;
	inquiriesEl.innerHTML = '<p class="meta">Зареждане...</p>';
	try {
		const receivedSnap = await getDocs(query(collection(db, "inquiries"), where("listingOwnerId", "==", currentUser.uid)));
		const sentSnap = await getDocs(query(collection(db, "inquiries"), where("buyerId", "==", currentUser.uid)));
		const byId = new Map();
		[...receivedSnap.docs, ...sentSnap.docs].forEach((snap) => {
			byId.set(snap.id, { id: snap.id, ...snap.data() });
		});
		const rows = [...byId.values()].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
		const newCount = rows.filter((row) => row.status === "new" && row.listingOwnerId === currentUser.uid).length;
		inquiryCountEl.textContent = newCount ? `(${newCount})` : "";
		if (!rows.length) {
			inquiriesEl.innerHTML = '<p class="meta">Все още няма запитвания.</p>';
			return;
		}
		inquiriesEl.innerHTML = "";
		rows.forEach((row) => inquiriesEl.appendChild(createInquiryCard(row)));
	} catch (error) {
		console.error("Error loading inquiries:", error);
		inquiriesEl.innerHTML = '<p class="meta" style="color:var(--fl-down);">Запитванията не могат да се заредят. Проверете правилата на Firestore.</p>';
	}
}

function createInquiryCard(item) {
	const isOwner = item.listingOwnerId === currentUser.uid;
	const card = document.createElement("article");
	card.className = "inquiry-card";
	const requestLine = [item.requestQty, item.requestPrice].filter(Boolean).join(" · ");
	const offerLine = [item.offerQty, item.offerPrice, item.offerIncoterm, item.offerNote].filter(Boolean).join(" · ");
	const ownerActions = isOwner ? `
			<button type="button" class="btn btn-secondary" data-status="contacted">Маркирай „Свързах се“</button>
			<button type="button" class="btn btn-primary" data-offer>Изпрати оферта</button>
			<button type="button" class="btn btn-secondary" data-status="closed">Приключи</button>
		` : (
			item.status === "offer"
				? `<button type="button" class="btn btn-primary" data-status="accepted">Приеми офертата</button>
				   <button type="button" class="btn btn-secondary" data-status="closed">Откажи</button>`
				: `<p class="meta">Изчаквате отговор от продавача.</p>`
		);
	card.innerHTML = `
		<div class="inquiry-card-head">
			<div><h3>${escapeHtml(item.listingTitle || "Обява")}</h3><div class="inquiry-meta">${isOwner ? "От" : "До"}: <a href="mailto:${escapeHtml(item.buyerEmail)}">${escapeHtml(item.buyerName || item.buyerEmail)}</a> · ${escapeHtml(formatDate(item.createdAt))}</div></div>
			<span class="inquiry-status">${escapeHtml(STATUS_LABELS[item.status] || item.status)}</span>
		</div>
		<p class="inquiry-message">${escapeHtml(item.message)}</p>
		${requestLine ? `<p class="inquiry-meta">Заявка: ${escapeHtml(requestLine)}</p>` : ""}
		${offerLine ? `<p class="inquiry-meta">Оферта: ${escapeHtml(offerLine)}</p>` : ""}
		<div class="inquiry-actions">
			${isOwner ? `<a class="btn btn-primary" href="mailto:${escapeHtml(item.buyerEmail)}?subject=${encodeURIComponent(`Fieldlot: ${item.listingTitle || "запитване"}`)}">Отговор по имейл</a>` : ""}
			${ownerActions}
		</div>`;
	card.querySelectorAll("button[data-status]").forEach((button) => button.addEventListener("click", async () => {
		button.disabled = true;
		try {
			await updateDoc(doc(db, "inquiries", item.id), { status: button.dataset.status, updatedAt: serverTimestamp() });
			await loadInquiries();
		} catch (error) {
			console.error("Error updating inquiry:", error);
			alert("Статусът не беше обновен.");
			button.disabled = false;
		}
	}));
	card.querySelector("[data-offer]")?.addEventListener("click", async () => {
		const offerQty = window.prompt("Количество в офертата:", item.requestQty || item.offerQty || "");
		if (offerQty == null) return;
		const offerPrice = window.prompt("Цена:", item.requestPrice || item.offerPrice || "");
		if (offerPrice == null) return;
		const offerIncoterm = window.prompt("Incoterm (EXW, DAP…):", item.offerIncoterm || "EXW");
		try {
			await updateDoc(doc(db, "inquiries", item.id), {
				status: "offer",
				offerQty: String(offerQty).slice(0, 40),
				offerPrice: String(offerPrice).slice(0, 40),
				offerIncoterm: String(offerIncoterm || "EXW").slice(0, 20),
				updatedAt: serverTimestamp(),
			});
			await loadInquiries();
		} catch (error) {
			console.error("Error sending offer:", error);
			alert("Офертата не беше записана. Проверете Firestore правилата.");
		}
	});
	return card;
}

// Handle Profile Form
profileForm.addEventListener("submit", async (e) => {
	e.preventDefault();
	if (!currentUser) return;
	
	const btn = profileForm.querySelector("button");
	const originalText = btn.textContent;
	btn.textContent = "Запазване...";
	btn.disabled = true;
	
	try {
		// Collect selected certs
		const selectedCerts = Array.from(certCheckboxes)
			.filter(cb => cb.checked)
			.map(cb => cb.value);

		let profileImageUrl = imagePreview.querySelector('img').src; // keep existing if no new file
		if (profileImageUrl.startsWith('data:')) {
			profileImageUrl = ''; // it's just a local preview, let's wait for upload
		}

		if (imageInput.files.length > 0) {
			const file = imageInput.files[0];
			const storageRef = ref(storage, `profiles/${currentUser.uid}/${Date.now()}_${file.name}`);
			const snapshot = await uploadBytes(storageRef, file);
			profileImageUrl = await getDownloadURL(snapshot.ref);
		}

		const profileData = {
			companyName: companyInput.value,
			profileType: typeInput.value,
			profileDesc: descInput.value,
			profileVideo: videoInput.value,
			publicConsent: publicConsentInput.checked,
			certs: selectedCerts,
		};
		if (profileImageUrl) {
			profileData.profileImageUrl = profileImageUrl;
		}

		await setDoc(doc(db, "users", currentUser.uid), profileData, { merge: true });

		const publicRef = doc(db, "publicProfiles", currentUser.uid);
		if (profileData.publicConsent) {
			await setDoc(
				publicRef,
				{
					companyName: profileData.companyName || "",
					profileType: profileData.profileType || "",
					profileDesc: profileData.profileDesc || "",
					profileVideo: profileData.profileVideo || "",
					certs: profileData.certs || [],
					...(profileData.profileImageUrl ? { profileImageUrl: profileData.profileImageUrl } : {}),
				},
				{ merge: true },
			);
		} else {
			await deleteDoc(publicRef).catch(() => {});
		}
		
		btn.textContent = "Запазено!";
		setTimeout(() => {
			btn.textContent = originalText;
			btn.disabled = false;
		}, 2000);
	} catch (err) {
		console.error("Error saving profile:", err);
		alert("Грешка при запазване.");
		btn.textContent = originalText;
		btn.disabled = false;
	}
});

function escapeHtml(s) {
	if (!s) return "";
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

async function loadMyListings() {
	if (!currentUser) return;
	
	grid.innerHTML = '<p class="meta" style="grid-column: 1 / -1;">Зареждане...</p>';
	
	try {
		const q = query(collection(db, "listings"), where("userId", "==", currentUser.uid));
		const snapshot = await getDocs(q);
		
		grid.innerHTML = '';
		
		if (snapshot.empty) {
			grid.innerHTML = '<p class="meta" style="grid-column: 1 / -1;">Нямате добавени обяви. Кликнете "+ Нова обява" за да започнете.</p>';
			return;
		}
		
		snapshot.forEach(docSnap => {
			const d = docSnap.data();
			grid.appendChild(createCard(docSnap.id, d));
		});
		
	} catch (e) {
		console.error("Error loading listings:", e);
		grid.innerHTML = '<p class="meta" style="grid-column: 1 / -1; color: red;">Грешка при зареждане на обявите.</p>';
	}
}

function createCard(id, item) {
	const article = document.createElement('article');
	article.className = 'listing-card yp-entry';
	article.dataset.id = id;
	
	// Create visual elements
	article.innerHTML = `
		<div class="yp-entry-main">
			<div class="yp-entry-head">
				<span class="tag sell">Продава</span>
				${item.category ? `<span class="tag yp-cat">${escapeHtml(item.category)}</span>` : ''}
			</div>
			<h3 class="yp-entry-title">${escapeHtml(item.title)}</h3>
			<p class="yp-entry-line">${escapeHtml(item.location || "България")} · ${escapeHtml(item.qty || "")}</p>
		</div>
		<div class="yp-entry-aside">
			<div class="price">${item.price ? escapeHtml(item.price) : "по договаряне"} <small>лв</small></div>
			<button class="btn btn-secondary btn-hide" style="padding: 4px 8px; margin-top: 8px;">${item.moderationStatus === "hidden" ? "Покажи" : "Скрий"}</button>
			<button class="btn btn-secondary btn-delete" style="color: red; border-color: red; background: transparent; padding: 4px 8px; margin-top: 8px;">Изтрий</button>
		</div>
	`;
	
	const hideBtn = article.querySelector('.btn-hide');
	hideBtn.addEventListener('click', async (e) => {
		e.stopPropagation();
		const next = item.moderationStatus === "hidden" ? "approved" : "hidden";
		try {
			await updateDoc(doc(db, "listings", id), { moderationStatus: next });
			item.moderationStatus = next;
			hideBtn.textContent = next === "hidden" ? "Покажи" : "Скрий";
		} catch (err) {
			console.error("Error hiding listing", err);
			alert("Статусът не беше обновен.");
		}
	});

	const delBtn = article.querySelector('.btn-delete');
	delBtn.addEventListener('click', async (e) => {
		e.stopPropagation();
		if (confirm("Сигурни ли сте, че искате да изтриете тази обява?")) {
			try {
				await deleteDoc(doc(db, "listings", id));
				article.remove();
				if (grid.children.length === 0) {
					grid.innerHTML = '<p class="meta" style="grid-column: 1 / -1;">Нямате добавени обяви. Кликнете "+ Нова обява" за да започнете.</p>';
				}
			} catch (err) {
				console.error("Error deleting doc", err);
				alert("Грешка при изтриване.");
			}
		}
	});
	
	return article;
}
