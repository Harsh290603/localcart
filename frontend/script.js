document.addEventListener('DOMContentLoaded', () => {
    
    const authForm = document.getElementById('auth-form');
    const toggleLink = document.getElementById('toggle-link');
    const formTitle = document.getElementById('form-title');
    const nameField = document.getElementById('name-field');
    const mainBtn = document.querySelector('.main-btn');
    
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    let isLogin = false; 

    // 1. PASSWORD SHOW/HIDE LOGIC
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
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
                alert("please enter the username");
                return;
            }
            payload.username = username;
        }

        const url = isLogin ? 'http://localhost:5000/login' : 'http://localhost:5000/signup';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            
            if (response.ok) {
                // --- DATA PERSISTENCE ---
                // Browser ki memory mein zaroori info save karo
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
                    alert("Account created login and setup your account");
                    location.reload(); 
                }
                
            } else {
                alert(data.message); 
            }

        } catch (error) {
            console.error("Error:", error);
            alert("backend server error ");
        }
    });
});