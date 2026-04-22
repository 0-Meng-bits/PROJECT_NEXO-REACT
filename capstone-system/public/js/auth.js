let isLoginMode = true;

// Toggle between Login and Signup modes
window.toggleAuth = function(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;

    const regFields = document.getElementById('registrationFields');
    const subtitle = document.getElementById('authSubtitle');
    const submitBtn = document.getElementById('submitBtn');
    const toggleText = document.getElementById('toggleText');

    if (!isLoginMode) {
        regFields.classList.remove('hidden');
        subtitle.innerText = 'ESTABLISHING_NEW_IDENTITY...';
        submitBtn.innerText = 'CREATE ACCOUNT';
        toggleText.innerHTML = 'Already registered? <a href="#" onclick="toggleAuth(event)">Login here</a>';
    } else {
        regFields.classList.add('hidden');
        subtitle.innerText = 'INITIALIZING_SECURE_SESSION...';
        submitBtn.innerText = 'LOGIN';
        toggleText.innerHTML = 'New student? <a href="#" onclick="toggleAuth(event)">Create an Account</a>';
    }
};

// Main Form Logic
document.getElementById('authForm')?.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "PROCESSING...";
    submitBtn.disabled = true;

    // Collect base identifiers
    const ctuId = document.getElementById('authEmail').value; 
    const password = document.getElementById('authPass').value;

    try {
        let response;
        
        if (!isLoginMode) {
            // --- SIGNUP LOGIC ---
            const email = document.getElementById('regEmail').value;
            const fullName = document.getElementById('regName').value;
            const userType = document.getElementById('regUserType').value;

            response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    password, 
                    fullName, 
                    studentId: ctuId, // Maps to your DB column
                    user_type: userType, 
                    is_verified: false 
                })
            });
        } else {
            // --- LOGIN LOGIC ---
            response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: ctuId, password })
            });
        }

        // Gatekeeper: Redirect if unverified (403 Forbidden)
        if (response.status === 403) {
            window.location.href = 'pending.html';
            return;
        }

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            
            // Route based on role
            if (result.user.user_type === 'Admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                window.location.href = 'user-portal.html';
            }
        } else {
            alert("SYSTEM_ALERT: " + result.message);
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }

    } catch (error) {
        console.error("Critical failure:", error);
        alert("TERMINAL_OFFLINE: Connection failed.");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});