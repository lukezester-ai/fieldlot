import { auth } from "./firebase-init.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";

const modalHTML = `
<div class="fl-auth-backdrop" id="fl-auth-backdrop">
	<div class="fl-auth-modal" id="fl-auth-modal">
		<button type="button" class="fl-auth-close" id="fl-auth-close" aria-label="Close">×</button>
		<div class="fl-auth-head">
			<h2 id="fl-auth-title">Вход</h2>
			<p id="fl-auth-subtitle">Добре дошли отново във Fieldlot</p>
		</div>
		<div class="fl-auth-body">
			<div class="fl-auth-error" id="fl-auth-error"></div>
			<form class="fl-auth-form" id="fl-auth-form">
				<div class="fl-auth-input-group">
					<label for="fl-auth-email">Имейл</label>
					<input type="email" id="fl-auth-email" required placeholder="Вашият имейл адрес" />
				</div>
				<div class="fl-auth-input-group">
					<label for="fl-auth-password">Парола</label>
					<input type="password" id="fl-auth-password" required placeholder="Минимум 6 символа" minlength="6" />
				</div>
				<button type="submit" class="btn btn-primary fl-auth-btn" id="fl-auth-submit">Влезте</button>
			</form>
			<div class="fl-auth-switch">
				<span id="fl-auth-switch-text">Нямате профил?</span>
				<button type="button" id="fl-auth-switch-btn">Регистрирайте се</button>
			</div>
		</div>
	</div>
</div>
`;

// Inject modal
document.body.insertAdjacentHTML('beforeend', modalHTML);

const backdrop = document.getElementById('fl-auth-backdrop');
const closeBtn = document.getElementById('fl-auth-close');
const form = document.getElementById('fl-auth-form');
const emailInput = document.getElementById('fl-auth-email');
const passwordInput = document.getElementById('fl-auth-password');
const titleEl = document.getElementById('fl-auth-title');
const subtitleEl = document.getElementById('fl-auth-subtitle');
const submitBtn = document.getElementById('fl-auth-submit');
const switchText = document.getElementById('fl-auth-switch-text');
const switchBtn = document.getElementById('fl-auth-switch-btn');
const errorEl = document.getElementById('fl-auth-error');

let isLoginMode = true;

function openModal(mode = 'login') {
	isLoginMode = mode === 'login';
	updateModalUI();
	errorEl.textContent = '';
	backdrop.classList.add('active');
	emailInput.focus();
}

function closeModal() {
	backdrop.classList.remove('active');
}

closeBtn.addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => {
	if (e.target === backdrop) closeModal();
});

switchBtn.addEventListener('click', () => {
	isLoginMode = !isLoginMode;
	updateModalUI();
	errorEl.textContent = '';
});

function updateModalUI() {
	if (isLoginMode) {
		titleEl.textContent = 'Вход';
		subtitleEl.textContent = 'Добре дошли отново във Fieldlot';
		submitBtn.textContent = 'Влезте';
		switchText.textContent = 'Нямате профил?';
		switchBtn.textContent = 'Регистрирайте се';
	} else {
		titleEl.textContent = 'Регистрация';
		subtitleEl.textContent = 'Създайте своя агро профил';
		submitBtn.textContent = 'Регистриране';
		switchText.textContent = 'Вече имате профил?';
		switchBtn.textContent = 'Влезте тук';
	}
}

// Form Submission
form.addEventListener('submit', async (e) => {
	e.preventDefault();
	const email = emailInput.value;
	const password = passwordInput.value;
	errorEl.textContent = '';
	submitBtn.disabled = true;

	try {
		if (isLoginMode) {
			await signInWithEmailAndPassword(auth, email, password);
		} else {
			await createUserWithEmailAndPassword(auth, email, password);
		}
		closeModal();
		form.reset();
	} catch (err) {
		console.error("Auth error:", err);
		if (err.code === 'auth/email-already-in-use') errorEl.textContent = 'Този имейл вече е регистриран.';
		else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') errorEl.textContent = 'Грешен имейл или парола.';
		else errorEl.textContent = 'Възникна грешка. Моля, опитайте отново.';
	} finally {
		submitBtn.disabled = false;
	}
});

// Update Navbar based on Auth State
onAuthStateChanged(auth, (user) => {
	const headerActions = document.querySelector('.header-actions');
	if (!headerActions) return;

	if (user) {
		// Logged in
		headerActions.innerHTML = `
			<a href="/dashboard.html" class="btn btn-ghost" style="color: var(--fl-emerald); font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 8px;">
				<span style="display:inline-block; width:8px; height:8px; background:var(--fl-emerald); border-radius:50%;"></span>
				Моят профил
			</a>
			<button type="button" class="btn btn-ghost" id="nav-logout">Изход</button>
			<button type="button" class="btn btn-publish" id="nav-publish" data-i18n="nav.publish" style="background: var(--primary); color: white; border-radius: 40px;">Публикувай</button>
		`;
		document.getElementById('nav-logout').addEventListener('click', () => {
			signOut(auth);
		});
	} else {
		// Logged out
		headerActions.innerHTML = `
			<button type="button" class="btn btn-ghost" id="nav-login">Вход</button>
			<button type="button" class="btn btn-ghost" id="nav-register">Регистрация</button>
			<button type="button" class="btn btn-publish" id="nav-publish" data-i18n="nav.publish">Публикувай</button>
		`;
		document.getElementById('nav-login').addEventListener('click', () => openModal('login'));
		document.getElementById('nav-register').addEventListener('click', () => openModal('register'));
	}
});

// Hook existing buttons if any
document.querySelectorAll('a[data-i18n="nav.login"]').forEach(el => {
	el.addEventListener('click', (e) => { e.preventDefault(); openModal('login'); });
});
document.querySelectorAll('a[data-i18n="nav.register"]').forEach(el => {
	el.addEventListener('click', (e) => { e.preventDefault(); openModal('register'); });
});
