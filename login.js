import { auth } from '../firebase/config.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const form = document.getElementById('loginForm');
const alertBox = document.getElementById('alertBox');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitButton = document.getElementById('submitButton');

const fieldErrors = {
  email: document.getElementById('emailError'),
  password: document.getElementById('passwordError')
};

const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`;
const eyeOffIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="h-5 w-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.956 9.956 0 012.307-3.708M6.21 6.21A9.966 9.966 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.956 9.956 0 01-1.56 2.9"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3l18 18"/></svg>`;

function showAlert(type, message) {
  alertBox.hidden = false;
  alertBox.textContent = message;
  alertBox.className = 'rounded-3xl border px-4 py-4 text-sm font-medium shadow-sm';

  if (type === 'success') {
    alertBox.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-800');
  } else {
    alertBox.classList.add('border-red-200', 'bg-red-50', 'text-red-800');
  }
}

function hideAlert() {
  alertBox.hidden = true;
  alertBox.textContent = '';
}

function setFieldError(field, message) {
  const element = fieldErrors[field];
  if (!element) return;
  element.textContent = message;
  element.classList.remove('hidden');
}

function clearFieldErrors() {
  Object.values(fieldErrors).forEach((element) => {
    element.textContent = '';
    element.classList.add('hidden');
  });
}

function isEmailValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  submitButton.innerHTML = isLoading
    ? '<span class="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>Logging in'
    : 'Log in';
}

function togglePasswordVisibility(button) {
  const targetSelector = button.dataset.target;
  const targetInput = document.querySelector(targetSelector);
  if (!targetInput) return;

  const isPassword = targetInput.type === 'password';
  targetInput.type = isPassword ? 'text' : 'password';
  button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  button.innerHTML = isPassword ? eyeOffIcon : eyeIcon;
}

document.querySelectorAll('[data-target]').forEach((button) => {
  button.addEventListener('click', () => togglePasswordVisibility(button));
});

if (!form) {
  throw new Error('Login form not found');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert();
  clearFieldErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let valid = true;

  if (!email) {
    valid = false;
    setFieldError('email', 'Email is required.');
  } else if (!isEmailValid(email)) {
    valid = false;
    setFieldError('email', 'Please enter a valid email address.');
  }

  if (!password) {
    valid = false;
    setFieldError('password', 'Password is required.');
  }

  if (!valid) {
    showAlert('error', 'Please fix the highlighted fields before continuing.');
    return;
  }

  setLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        showAlert('success', 'Login successful. Redirecting to your dashboard...');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          window.location.assign('../app/dashboard.html');
        }, 1200);
      });
  } catch (error) {
    const code = error?.code || '';
    let errorMessage = 'Unable to login. Please try again.';

    if (code === 'auth/user-not-found') {
      errorMessage = 'No account found for that email address.';
    } else if (code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password. Please try again.';
    } else if (code === 'auth/invalid-email') {
      errorMessage = 'The email address appears to be invalid.';
    } else if (code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Check your connection and try again.';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    showAlert('error', errorMessage);
    console.error('Login failed:', error);
  } finally {
    setLoading(false);
  }
});
