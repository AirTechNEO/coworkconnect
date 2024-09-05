const hostname = window.location.hostname;

if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async function(event) {
        await userConnection(event, `http://${hostname}:3000/register`);
    });
}
if (document.getElementById('loginForm')){
    document.getElementById('loginForm').addEventListener('submit', async function(event) {
        await userConnection(event, `http://${hostname}:3000/login`);
    });
}

async function userConnection(event, requestType) {
    event.preventDefault(); // Prevent the default form submission
    document.getElementById('errorMessage').textContent = ''; // Clear any previous error messages
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Send a POST request to the server
    reqBody = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    };
    try {
        const response = await fetch(requestType, reqBody);
        const result = await response.json();
        if (response.ok) {
            const token = result.token; // Extract the token from the response
            localStorage.setItem("token",token); // Store the token in local storage
            window.location.href = '/'; // Redirect to the main page
        } else {
            document.getElementById('errorMessage').textContent = result.error; // Display error message
        }
    }
    catch (error) {
        console.error('Error:', error);
        document.getElementById('errorMessage').textContent = 'Error connecting to the server';
    }    
}
