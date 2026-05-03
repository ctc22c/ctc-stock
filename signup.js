import { auth, db } from '../firebase/config.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
import { doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

const form = document.getElementById('signupForm');
const alertBox = document.getElementById('alertBox');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const submitButton = document.getElementById('submitButton');

const fieldErrors = {
  fullName: document.getElementById('fullNameError'),
  email: document.getElementById('emailError'),
  phone: document.getElementById('phoneError'),
  password: document.getElementById('passwordError'),
  confirmPassword: document.getElementById('confirmPasswordError')
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
    ? '<span class="mr-2 inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>Creating account'
    : 'Create account';
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

if (!submitButton) {
  throw new Error('Signup button not found');
}

submitButton.addEventListener('click', async (event) => {
  event.preventDefault();
  hideAlert();
  clearFieldErrors();

  const fullName = fullNameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  let valid = true;

  if (!fullName) {
    valid = false;
    setFieldError('fullName', 'Full name is required.');
  }

  if (!email) {
    valid = false;
    setFieldError('email', 'Email is required.');
  } else if (!isEmailValid(email)) {
    valid = false;
    setFieldError('email', 'Please enter a valid email address.');
  }

  if (!phone) {
    valid = false;
    setFieldError('phone', 'Phone number is required.');
  }

  if (!password) {
    valid = false;
    setFieldError('password', 'Password is required.');
  } else if (password.length < 6) {
    valid = false;
    setFieldError('password', 'Password must be at least 6 characters.');
  }

  if (!confirmPassword) {
    valid = false;
    setFieldError('confirmPassword', 'Please confirm your password.');
  } else if (password !== confirmPassword) {
    valid = false;
    setFieldError('confirmPassword', 'Passwords do not match.');
  }

  if (!valid) {
    showAlert('error', 'Please fix the highlighted fields before continuing.');
    return;
  }

  setLoading(true);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    const uid = userCredential.user.uid;
    await setDoc(doc(db, 'users', uid), {
      uid,
      email,
      fullName,
      usdBalance: 0,
      btcBalance: 0,
      kycStatus: 'unverified',
      createdAt: new Date()
    });

    window.location.href = 'login.html';
  } catch (error) {
    console.error('Signup failed:', error);
    const code = error?.code || '';
    let errorMessage = 'Unable to create account. Please try again later.';

    if (code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already linked to another account.';
    } else if (code === 'auth/weak-password') {
      errorMessage = 'Your password is too weak. Please choose a stronger password.';
    } else if (code === 'auth/invalid-email') {
      errorMessage = 'The email address appears to be invalid.';
    } else if (code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Check your connection and try again.';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    showAlert('error', errorMessage);
    console.error('Signup failed:', error);
  } finally {
    setLoading(false);
  }
});
