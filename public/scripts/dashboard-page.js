import { auth, db } from "../firebase-init.js";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";

const grid = document.getElementById("dashboard-listings-grid");
const emailInput = document.getElementById("profile-email");
const companyInput = document.getElementById("profile-company");
const profileForm = document.getElementById("profile-form");

const tabListings = document.getElementById("tab-listings");
const tabProfile = document.getElementById("tab-profile");
const viewListings = document.getElementById("view-listings");
const viewProfile = document.getElementById("view-profile");

const btnNewListing = document.getElementById("btn-new-listing");

// Tabs Logic
tabListings.addEventListener("click", (e) => {
	e.preventDefault();
	tabListings.classList.add("active");
	tabProfile.classList.remove("active");
	viewListings.style.display = "block";
	viewProfile.style.display = "none";
});

tabProfile.addEventListener("click", (e) => {
	e.preventDefault();
	tabProfile.classList.add("active");
	tabListings.classList.remove("active");
	viewProfile.style.display = "block";
	viewListings.style.display = "none";
});

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
		}
	} catch (e) {
		console.error("Error fetching profile:", e);
	}
	
	loadMyListings();
});

// Handle Profile Form
profileForm.addEventListener("submit", async (e) => {
	e.preventDefault();
	if (!currentUser) return;
	
	const btn = profileForm.querySelector("button");
	const originalText = btn.textContent;
	btn.textContent = "Запазване...";
	btn.disabled = true;
	
	try {
		await setDoc(doc(db, "users", currentUser.uid), {
			companyName: companyInput.value
		}, { merge: true });
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
		<div class="badge" style="background: var(--neutral-100); color: var(--neutral-700);">Продава</div>
		<h3 style="font-size: 1.25rem; font-weight: 700; margin: 0 0 8px;">${escapeHtml(item.title)}</h3>
		<div class="price">${item.price ? escapeHtml(item.price) : "по договаряне"} <span style="font-size: 1rem;">лв</span></div>
		<div class="location">
			<span aria-hidden="true">📍</span> ${escapeHtml(item.location || "България")}
		</div>
		<p style="color: var(--neutral-600); font-size: 0.85rem; margin-bottom: 1rem; flex-grow: 1;">
			${escapeHtml(item.qty || "")}
		</p>
		${item.category ? `<div style="margin-bottom: 1rem;"><span class="badge" style="background: var(--primary-soft); color: var(--primary-dark);">${escapeHtml(item.category)}</span></div>` : ''}
		<div style="display: flex; gap: 0.5rem; margin-top: auto;">
			<button class="btn btn-outline btn-delete" style="flex: 1; border-color: red; color: red; text-align: center; border-radius: 40px; padding: 0.5rem; background: transparent; cursor: pointer;">Изтрий</button>
		</div>
	`;
	
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
