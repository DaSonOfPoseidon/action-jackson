// Handle form submission for scheduling
document.getElementById('schedule-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const date = document.getElementById('date').value;

    try {
        const response = await fetch('/api/scheduling/book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, date }),
        });

        if (response.ok) {
            alert('Appointment successfully scheduled!');
            document.getElementById('schedule-form').reset();
        } else {
            alert('Error scheduling appointment.');
        }
    } catch (error) {
        console.error('Error booking appointment:', error);
    }
});
