// Create background particles
function createParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.classList.add('particle');
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.width = Math.random() * 4 + 2 + 'px';
    particle.style.height = particle.style.width;
    particle.style.animationDuration = Math.random() * 3 + 3 + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particlesContainer.appendChild(particle);
  }
}

// Add ripple effect to buttons
function addRippleEffect() {
  document.querySelectorAll('.glass-button, .social-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

// Language selector functionality
document.getElementById('languageSelect')?.addEventListener('change', function() {
  console.log('Language changed to:', this.value);
  // Implement language switching logic here
});

// Authentication functions
function handleGoogleLogin() {
  console.log('Google login initiated');
  // Simulate login process
  setTimeout(() => {
    showAwarenessSection();
  }, 1000);
}

function showMobileLogin() {
  document.getElementById('mobileLoginForm')?.classList.remove('hidden');
}

function sendOTP() {
  const mobileNumberInput = document.getElementById('mobileNumber');
  if (!mobileNumberInput) return;
  const mobileNumber = mobileNumberInput.value;
  if (mobileNumber.length >= 10) {
    const sentNumberEl = document.getElementById('sentNumber');
    if (sentNumberEl) sentNumberEl.textContent = mobileNumber;
    document.getElementById('mobileLoginForm')?.classList.add('hidden');
    document.getElementById('otpVerification')?.classList.remove('hidden');
  } else {
    alert('Please enter a valid mobile number');
  }
}

function moveToNext(current, index) {
  if (current.value.length >= 1 && index < 5) {
    current.nextElementSibling?.focus();
  }
}

function verifyOTP() {
  const otpInputs = document.querySelectorAll('#otpVerification input[type="text"]');
  const otp = Array.from(otpInputs).map(input => input.value).join('');
  
  if (otp.length === 6) {
    console.log('OTP verified:', otp);
    showAwarenessSection();
  } else {
    alert('Please enter complete OTP');
  }
}

function proceedAsGuest() {
  console.log('Proceeding as guest');
  showAwarenessSection();
}

function showAwarenessSection() {
  document.getElementById('loginSection')?.classList.remove('active');
  document.getElementById('awarenessSection')?.classList.add('active');
  document.getElementById('step2')?.classList.add('active');
}

function goBack() {
  document.getElementById('awarenessSection')?.classList.remove('active');
  document.getElementById('loginSection')?.classList.add('active');
  document.getElementById('step2')?.classList.remove('active');
}

// Consent validation
function validateConsent() {
  const dataConsent = document.getElementById('dataConsent');
  const termsConsent = document.getElementById('termsConsent');
  const proceedBtn = document.getElementById('proceedBtn');
  if (!dataConsent || !termsConsent || !proceedBtn) return;
  
  if (dataConsent.checked && termsConsent.checked) {
    proceedBtn.disabled = false;
    proceedBtn.classList.remove('opacity-50');
  } else {
    proceedBtn.disabled = true;
    proceedBtn.classList.add('opacity-50');
  }
}

function proceedToAssessment() {
  console.log('Proceeding to assessment');
  document.getElementById('step3')?.classList.add('active');
  // Redirect to assessment page
  window.location.href = 'location-input.html';
}

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  createParticles();
  addRippleEffect();
  
  // Add consent validation listeners
  document.getElementById('dataConsent')?.addEventListener('change', validateConsent);
  document.getElementById('termsConsent')?.addEventListener('change', validateConsent);
  
  // Initialize proceed button state
  validateConsent();
});
