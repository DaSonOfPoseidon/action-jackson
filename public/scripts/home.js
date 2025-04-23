// Fetch services and testimonials dynamically
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/home');
        const data = await response.json();
        
        // Display services
        const servicesContainer = document.getElementById('services');
        data.services.forEach(service => {
            servicesContainer.innerHTML += `
                <div class="col-md-4">
                    <div class="card my-3">
                        <div class="card-body">
                            <h5 class="card-title">${service.name}</h5>
                            <p class="card-text">${service.description}</p>
                        </div>
                    </div>
                </div>
            `;
        });

        // Display testimonials
        const testimonialsContainer = document.getElementById('testimonials');
        testimonialsContainer.innerHTML = `
            <h3>What Our Customers Say</h3>
            <ul class="list-group">
                ${data.testimonials.map(t => `<li class="list-group-item">${t.message} - <strong>${t.name}</strong></li>`).join('')}
            </ul>
        `;
    } catch (error) {
        console.error('Error fetching homepage content:', error);
    }
});
