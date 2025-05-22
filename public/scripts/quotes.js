// public/scripts/quotes.js

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('quoteForm');
  if (!form) {
    console.error('Could not find #quoteForm on the page.');
    return;
  }
  form.addEventListener('submit', handleSubmit);
});

async function handleSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('name')?.value.trim() || '';
  const email = document.getElementById('email')?.value.trim() || '';

  const packageOption = document.querySelector('input[name="package"]:checked')?.value || null;

  const discountInput = document.getElementById('discount')?.value;
  const discount = discountInput ? parseFloat(discountInput) : 0;


  const coaxRuns = parseInt(document.getElementById('coaxRuns')?.value, 10) || 0;
  const cat6Runs = parseInt(document.getElementById('cat6Runs')?.value, 10) || 0;


  const deviceMountQty  = parseInt(document.getElementById('deviceMountQty')?.value, 10) || 0;
  const networkSetupQty = parseInt(document.getElementById('networkSetupQty')?.value, 10) || 0;
  const mediaPanelQty   = parseInt(document.getElementById('mediaPanelQty')?.value, 10) || 0;


  const payload = {
    customer: { name, email },
    packageOption,
    discount,
    runs: { coax: coaxRuns, cat6: cat6Runs },
    services: {
      deviceMount: deviceMountQty,
      networkSetup: networkSetupQty,
      mediaPanel: mediaPanelQty
    }
  };


  try {
    const res = await fetch('/api/quotes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      // replace with whatever makes sense: a redirect or UI update
      alert(`Quote created! Reference ID: ${data.id}`);
      // e.g. window.location.href = `/quotes/${data.id}`;
    } else {
      alert(`Error creating quote: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error(err);
    alert(`Network error: ${err.message}`);
  }
}
