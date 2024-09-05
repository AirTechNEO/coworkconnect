document.addEventListener("DOMContentLoaded", function () {
    const authButton = document.getElementById('authButton');
    const authDropdown = document.getElementById('authDropdown');
    const userIcon = document.createElement('img');

    userIcon.src = 'user.ico';
    userIcon.id = 'userIcon';
    userIcon.style.cursor = 'pointer';

    // Hide the dropdown content when the page loads
    authDropdown.style.display = 'none';

    // Show the dropdown when the "Account" button is clicked
    function updateDropdown() {
        const token = localStorage.getItem('token');
        if (token) {
            authButton.replaceWith(userIcon);
            userIcon.style.width = '50%';
            userIcon.style.height = '50%';
            authDropdown.innerHTML = '<a href="#" id="logoutButton">Logout</a>';
            userIcon.addEventListener('click', toggleClick);
            document.getElementById('logoutButton').addEventListener('click', function(){
                logout();
                toggleClick();  // Close the dropdown
            });
        } else {
            userIcon.replaceWith(authButton);
            authDropdown.innerHTML = `
                <a href="login.html">Login</a>
                <a href="register.html">Register</a>
            `;
            authButton.addEventListener('click', toggleClick);
        }
    }
    function toggleClick () {
        // Toggle the display property
        if (authDropdown.style.display === 'none' || authDropdown.style.display === '') {
            authDropdown.style.display = 'block';
        } else {
            authDropdown.style.display = 'none';
        }
    }
    function logout() {
        console.log('Logging out'); 
        localStorage.removeItem('token');
        updateDropdown();
    }
    updateDropdown();
});
