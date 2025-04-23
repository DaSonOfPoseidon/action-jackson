// Load Navbar from /components/navbar.html
document.addEventListener('DOMContentLoaded', function () {
    fetch('/components/navbar.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('navbar-container').innerHTML = data;
        })
        .catch(error => console.error('Error loading the navbar:', error));
});

// Load Footer from /components/footer.html
document.addEventListener('DOMContentLoaded', function () {
    fetch('/components/footer.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('footer-container').innerHTML = data;
        })
        .catch(error => console.error('Error loading the footer:', error));
});
