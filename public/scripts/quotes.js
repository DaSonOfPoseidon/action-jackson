// Handle form submission for generating quotes
document.getElementById('quote-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const serviceType = document.getElementById('serviceType').value;
    const drops = parseInt(document.getElementById('drops').value);
    const construction = document.querySelector('input[name="construction"]:checked').value === 'true';
    const atticCrawl = document.querySelector('input[name="atticCrawl"]:checked').value === 'true';

    try {
        const response = await fetch('/api/quotes/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ serviceType, drops, construction, atticCrawl }),
        });

        if (response.ok) {
            alert('Quote generated and submitted successfully!');
            document.getElementById('quote-form').reset();
        } else {
            alert('Error generating quote.');
        }
    } catch (error) {
        console.error('Error submitting quote:', error);
    }
});
