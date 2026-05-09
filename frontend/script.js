document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. PERSISTENCE CHECK (Auto-Login Logic) ---
    const savedEmail = localStorage.getItem('userEmail');
    const savedRole = localStorage.getItem('userRole');

    if (savedEmail && savedRole) {
        // Agar data mil gaya, toh bina login form dikhaye redirect karein
        if (savedRole === 'business') {
            window.location.href = 'business_dashboard.html';
        } else {
            window.location.href = 'customer_dashboard.html';
        }
        return; // Script ko yahan stop kar do taaki baaki form logic load na ho
    }

    // --- 2. EXISTING SELECTORS ---
    const authForm = document.getElementById('auth-form');
    const toggleLink = document.getElementById('toggle-link');
    const formTitle = document.getElementById('form-title');
    const nameField = document.getElementById('name-field');
    const mainBtn = document.querySelector('.main-btn');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    let isLogin = true; 

    // --- CONFIGURATION ---
    const API_BASE_URL = 'https://localcart-c6il.onrender.com'; 

    // 3. PASSWORD SHOW/HIDE LOGIC
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
        this.classList.toggle('fa-eye');
    });

    // 4. TOGGLE LOGIN/SIGNUP UI LOGIC
    function handleToggle() {
        isLogin = !isLogin;
        const toggleWrapper = document.getElementById('toggle-wrapper');

        if (isLogin) {
            formTitle.innerText = "Welcome Back";
            nameField.style.display = "none";
            mainBtn.innerText = "Login";
            toggleWrapper.innerHTML = 'New here? <span id="toggle-link" style="cursor: pointer; color: var(--primary-color); font-weight: 600;">Create Account</span>';
        } else {
            formTitle.innerText = "Create Account";
            nameField.style.display = "block";
            mainBtn.innerText = "Sign Up";
            toggleWrapper.innerHTML = 'Already a member? <span id="toggle-link" style="cursor: pointer; color: var(--primary-color); font-weight: 600;">Login</span>';
        }
        // Re-attach listener because innerHTML wipes it
        document.getElementById('toggle-link').addEventListener('click', handleToggle);
    }

    toggleLink.addEventListener('click', handleToggle);

    // 5. SUBMIT HANDLER
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = passwordInput.value;
        const role = document.querySelector('input[name="role"]:checked').value;

        let payload = { email, password, role };

        if (!isLogin) {
            const username = document.getElementById('username').value;
            if(!username) {
                alert("Please enter your full name.");
                return;
            }
            payload.username = username;
        }

        const url = isLogin ? `${API_BASE_URL}/login` : `${API_BASE_URL}/signup`;

        mainBtn.innerText = isLogin ? "Logging in... ⏳" : "Signing up... ⏳";
        mainBtn.disabled = true;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok) {
                // Save data for persistence
                localStorage.setItem('userEmail', email); 
                localStorage.setItem('userRole', role); // Role ko manually save kar rahe hain redirection ke liye
                
                if (data.user && data.user.username) {
                    localStorage.setItem('userName', data.user.username);
                } else if (!isLogin) {
                    localStorage.setItem('userName', payload.username);
                }

                alert(data.message);

                if (isLogin) {
                    if (role === 'business') {
                        window.location.href = 'business_dashboard.html';
                    } else {
                        window.location.href = 'customer_dashboard.html';
                    }
                } else {
                    alert("Account created! Please login now.");
                    location.reload(); 
                }
                
            } else {
                alert(data.message || "Authentication failed."); 
            }

        } catch (error) {
            console.error("Auth Error:", error);
            alert("Backend server error! Server wake up hone mein 30-40 seconds le sakta hai.");
        } finally {
            mainBtn.disabled = false;
            mainBtn.innerText = isLogin ? "Login" : "Sign Up";
        }
    });
});