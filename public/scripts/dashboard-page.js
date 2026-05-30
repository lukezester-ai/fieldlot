import { auth, db, storage } from "../firebase-init.js";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { collection, query, where, getDocs, doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
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
			const storageRef = ref(storage, `profiles/${currentUser.uid}_${Date.now()}_${file.name}`);
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
			<button class="btn btn-secondary btn-delete" style="color: red; border-color: red; background: transparent; padding: 4px 8px; margin-top: 8px;">Изтрий</button>
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
