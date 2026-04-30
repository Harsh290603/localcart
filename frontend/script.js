document.addEventListener('DOMContentLoaded', () => {
    
    const authForm = document.getElementById('auth-form');
    const toggleLink = document.getElementById('toggle-link');
    const formTitle = document.getElementById('form-title');
    const nameField = document.getElementById('name-field');
    const mainBtn = document.querySelector('.main-btn');
    
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    let isLogin = false; 

    // --- CONFIGURATION ---
    // Aapka Render Backend URL yahan set kar diya hai
    const API_BASE_URL = 'https://localcart-c6il.onrender.com'; 

    // 1. PASSWORD SHOW/HIDE LOGIC
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
        this.classList.toggle('fa-eye');
    });

    // 2. TOGGLE LOGIN/SIGNUP UI LOGIC
    toggleLink.addEventListener('click', () => {
        isLogin = !isLogin;
        if (isLogin) {
            formTitle.innerText = "Welcome Back";
            nameField.style.display = "none";
            mainBtn.innerText = "Login";
            toggleLink.innerText = "Create Account";
        } else {
            formTitle.innerText = "Create Account";
            nameField.style.display = "block";
            mainBtn.innerText = "Sign Up";
            toggleLink.innerText = "Login";
        }
    });

    // 3. SUBMIT HANDLER (Backend Call)
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

        // Updated: Ab ye localhost ki jagah Render URL use karega
        const url = isLogin ? `${API_BASE_URL}/login` : `${API_BASE_URL}/signup`;

        // Loading state
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
                // --- DATA PERSISTENCE ---
                localStorage.setItem('userEmail', email); 
                
                if (data.user) {
                    localStorage.setItem('userName', data.user.username);
                    localStorage.setItem('userRole', data.user.role);
                } else if (!isLogin) {
                    localStorage.setItem('userName', payload.username);
                    localStorage.setItem('userRole', payload.role);
                }

                alert(data.message);

                // Redirect Logic
                if (isLogin) {
                    if (role === 'business') {
                        window.location.href = 'business_dashboard.html';
                    } else {
                        window.location.href = 'customer_dashboard.html';
                    }
                } else {
                    // Signup ke baad refresh karke Login mode dikhao
                    alert("Account created! Please login now.");
                    location.reload(); 
                }
                
            } else {
                alert(data.message || "Authentication failed."); 
            }

        } catch (error) {
            console.error("Auth Error:", error);
            // Hint: Render free tier pe thoda time leta hai "wake up" hone mein
            alert("Backend server error! Agar server start nahi hua hai toh 30-40 seconds wait karke dubara try karein.");
        } finally {
            mainBtn.disabled = false;
            mainBtn.innerText = isLogin ? "Login" : "Sign Up";
        }
    });
});