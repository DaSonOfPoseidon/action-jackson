// public/scripts/quotes.js

let selectedPackage = null;
let includeSurvey = false;
let selectedSpeedTier = null;
let equipmentCart = [];

// Equipment catalog organized by speed tier
const equipmentCatalog = {
  '1 Gig': [
    { sku: 'UDM-BASE', name: 'UniFi Dream Machine', price: 399, category: 'Gateway' },
    { sku: 'USW-24', name: 'UniFi Switch 24', price: 199, category: 'Switch' },
    { sku: 'U6-LITE', name: 'UniFi 6 Lite', price: 99, category: 'Access Point' },
    { sku: 'UCK-G2-PLUS', name: 'CloudKey Gen2 Plus', price: 199, category: 'Controller' }
  ],
  '5 Gig': [
    { sku: 'UDM-PRO', name: 'UniFi Dream Machine Pro', price: 599, category: 'Gateway' },
    { sku: 'USW-PRO-24', name: 'UniFi Pro Switch 24', price: 399, category: 'Switch' },
    { sku: 'U6-PRO', name: 'UniFi 6 Pro', price: 149, category: 'Access Point' },
    { sku: 'UAS-XG', name: 'UniFi Aggregation Switch XG', price: 549, category: 'Aggregation' }
  ],
  '10 Gig': [
    { sku: 'UDM-PRO-MAX', name: 'UniFi Dream Machine Pro Max', price: 899, category: 'Gateway' },
    { sku: 'USW-ENT-24', name: 'UniFi Enterprise Switch 24', price: 799, category: 'Switch' },
    { sku: 'U6-ENTERPRISE', name: 'UniFi 6 Enterprise', price: 249, category: 'Access Point' },
    { sku: 'USW-XG-6POE', name: 'UniFi Switch XG 6 PoE', price: 449, category: 'PoE Switch' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  initializePackageSelection();
  initializeEquipmentSelection();
  initializeFormHandling();
  setupCalculationListeners();
});

function initializePackageSelection() {
  // Package selection buttons
  const packageCards = document.querySelectorAll('.package-card');
  const packageButtons = document.querySelectorAll('.package-select-btn');
  
  packageButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const packageType = e.target.dataset.package;
      selectPackage(packageType);
    });
  });

  // Survey checkbox
  const surveyCheckbox = document.getElementById('includeSurvey');
  if (surveyCheckbox) {
    surveyCheckbox.addEventListener('change', (e) => {
      includeSurvey = e.target.checked;
      updateSurveyDisplay();
      calculatePricing();
    });
  }

  // Change package button
  const changePackageBtn = document.getElementById('changePackageBtn');
  if (changePackageBtn) {
    changePackageBtn.addEventListener('click', () => {
      showPackageSelection();
    });
  }
}

function selectPackage(packageType) {
  selectedPackage = packageType;
  
  // Update hidden input
  const hiddenInput = document.getElementById('selectedPackage');
  if (hiddenInput) {
    hiddenInput.value = packageType;
  }

  // Update display
  const displayName = document.getElementById('packageDisplayName');
  if (displayName) {
    displayName.textContent = packageType;
  }

  // Show selected package display, hide selection cards
  hidePackageSelection();
  showSelectedPackage();
  
  // Enable submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = false;
  }

  // Show equipment and pricing sections
  showEquipmentSection();
  showPricingSection();
  calculatePricing();
}

function showPackageSelection() {
  const packageSelection = document.querySelector('.package-selection');
  const selectedDisplay = document.getElementById('selectedPackageDisplay');
  
  if (packageSelection) packageSelection.style.display = 'block';
  if (selectedDisplay) selectedDisplay.style.display = 'none';
}

function hidePackageSelection() {
  const packageSelection = document.querySelector('.package-selection');
  if (packageSelection) packageSelection.style.display = 'none';
}

function showSelectedPackage() {
  const selectedDisplay = document.getElementById('selectedPackageDisplay');
  if (selectedDisplay) selectedDisplay.style.display = 'block';
}

function showPricingSection() {
  const pricingSection = document.getElementById('pricingSection');
  if (pricingSection) pricingSection.style.display = 'block';
}

function updateSurveyDisplay() {
  const surveyFeeInfo = document.getElementById('surveyFeeInfo');
  const premiumSurveyFeeInfo = document.getElementById('premiumSurveyFeeInfo');
  
  if (includeSurvey) {
    if (surveyFeeInfo) surveyFeeInfo.style.display = 'block';
    if (premiumSurveyFeeInfo) premiumSurveyFeeInfo.style.display = 'block';
  } else {
    if (surveyFeeInfo) surveyFeeInfo.style.display = 'none';
    if (premiumSurveyFeeInfo) premiumSurveyFeeInfo.style.display = 'none';
  }
}

function showEquipmentSection() {
  const equipmentSection = document.getElementById('equipmentSection');
  if (equipmentSection) equipmentSection.style.display = 'block';
}

function initializeEquipmentSelection() {
  // Speed tier radio buttons
  const speedTierRadios = document.querySelectorAll('input[name="speedTier"]');
  speedTierRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedSpeedTier = e.target.value;
        showEquipmentOptions();
      }
    });
  });
}

function showEquipmentOptions() {
  if (!selectedSpeedTier) return;
  
  const equipmentOptions = document.getElementById('equipmentOptions');
  const equipmentCards = document.getElementById('equipmentCards');
  
  if (!equipmentOptions || !equipmentCards) return;
  
  // Clear existing cards
  equipmentCards.innerHTML = '';
  
  // Get equipment for selected speed tier
  const equipment = equipmentCatalog[selectedSpeedTier] || [];
  
  // Create equipment cards
  equipment.forEach(item => {
    const card = createEquipmentCard(item);
    equipmentCards.appendChild(card);
  });
  
  // Show the equipment options
  equipmentOptions.style.display = 'block';
}

function createEquipmentCard(item) {
  const card = document.createElement('div');
  card.className = 'equipment-card card';
  card.innerHTML = `
    <h4>${item.name}</h4>
    <p class="equipment-category">${item.category}</p>
    <p class="equipment-price">$${item.price}</p>
    <p class="equipment-sku">SKU: ${item.sku}</p>
    <div class="equipment-controls">
      <button type="button" class="add-to-cart-btn" data-sku="${item.sku}">Add to Cart</button>
    </div>
  `;
  
  // Add event listener to the add to cart button
  const addButton = card.querySelector('.add-to-cart-btn');
  addButton.addEventListener('click', () => addToCart(item));
  
  return card;
}

function addToCart(item) {
  // Check if item already exists in cart
  const existingItem = equipmentCart.find(cartItem => cartItem.sku === item.sku);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    equipmentCart.push({ ...item, quantity: 1 });
  }
  
  updateCartDisplay();
  calculatePricing();
}

function removeFromCart(sku) {
  equipmentCart = equipmentCart.filter(item => item.sku !== sku);
  updateCartDisplay();
  calculatePricing();
}

function updateCartQuantity(sku, quantity) {
  const item = equipmentCart.find(cartItem => cartItem.sku === sku);
  if (item) {
    if (quantity <= 0) {
      removeFromCart(sku);
    } else {
      item.quantity = quantity;
      updateCartDisplay();
      calculatePricing();
    }
  }
}

function updateCartDisplay() {
  const cartItems = document.getElementById('cartItems');
  const equipmentCart_ = document.getElementById('equipmentCart');
  const equipmentTotal = document.getElementById('equipmentTotal');
  
  if (!cartItems) return;
  
  // Clear existing cart items
  cartItems.innerHTML = '';
  
  if (equipmentCart.length === 0) {
    if (equipmentCart_) equipmentCart_.style.display = 'none';
    return;
  }
  
  // Show cart
  if (equipmentCart_) equipmentCart_.style.display = 'block';
  
  // Create cart item elements
  equipmentCart.forEach(item => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    cartItem.innerHTML = `
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <span class="cart-item-price">$${item.price} each</span>
      </div>
      <div class="cart-item-controls">
        <input type="number" min="1" value="${item.quantity}" 
               onchange="updateCartQuantity('${item.sku}', parseInt(this.value))"
               class="quantity-input">
        <button type="button" onclick="removeFromCart('${item.sku}')" class="remove-btn">Remove</button>
      </div>
      <div class="cart-item-total">$${(item.price * item.quantity).toFixed(2)}</div>
    `;
    cartItems.appendChild(cartItem);
  });
  
  // Update total
  const total = getEquipmentTotal();
  if (equipmentTotal) equipmentTotal.textContent = total.toFixed(2);
}

function getEquipmentTotal() {
  return equipmentCart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Make functions globally accessible for onclick handlers
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

function setupCalculationListeners() {
  // Add listeners to all input fields for real-time calculation
  const inputFields = [
    'coaxRuns', 'cat6Runs', 'deviceMountQty', 'networkSetupQty', 'mediaPanelQty'
  ];
  
  inputFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', calculatePricing);
    }
  });
}

async function calculatePricing() {
  if (!selectedPackage) return;

  const runs = {
    coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
    cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0
  };

  const services = {
    deviceMount: parseInt(document.getElementById('deviceMountQty')?.value) || 0,
    networkSetup: parseInt(document.getElementById('networkSetupQty')?.value) || 0,
    mediaPanel: parseInt(document.getElementById('mediaPanelQty')?.value) || 0
  };

  // Calculate equipment total
  const equipmentTotal = getEquipmentTotal();

  try {
    const params = new URLSearchParams({
      packageOption: selectedPackage,
      includeSurvey: includeSurvey,
      'runs[coax]': runs.coax,
      'runs[cat6]': runs.cat6,
      'services[deviceMount]': services.deviceMount,
      'services[networkSetup]': services.networkSetup,
      'services[mediaPanel]': services.mediaPanel,
      equipmentTotal: equipmentTotal
    });

    const response = await fetch(`/api/quotes/calculate?${params}`);
    const data = await response.json();

    if (response.ok) {
      updatePricingDisplay(data);
    } else {
      console.error('Calculation error:', data.error);
    }
  } catch (err) {
    console.error('Network error during calculation:', err);
  }
}

function updatePricingDisplay(data) {
  const { packageOption, pricing } = data;

  // Hide both pricing displays first
  const basicPricing = document.getElementById('basicPricing');
  const premiumPricing = document.getElementById('premiumPricing');
  
  if (basicPricing) basicPricing.style.display = 'none';
  if (premiumPricing) premiumPricing.style.display = 'none';

  if (packageOption === 'Basic') {
    if (basicPricing) basicPricing.style.display = 'block';
    
    // Update basic pricing elements
    const totalCost = document.getElementById('totalCost');
    const depositAmount = document.getElementById('depositAmount');
    const depositInfo = document.getElementById('depositInfo');
    const surveyFee = document.getElementById('surveyFee');
    const equipmentCostBasic = document.getElementById('equipmentCostBasic');
    const equipmentCostBasicAmount = document.getElementById('equipmentCostBasicAmount');
    
    if (totalCost) totalCost.textContent = pricing.totalCost || 0;
    if (depositAmount) depositAmount.textContent = pricing.depositRequired || 0;
    if (surveyFee) surveyFee.textContent = pricing.surveyFee || 0;
    
    // Show equipment cost if there is any
    if (pricing.equipmentTotal > 0) {
      if (equipmentCostBasic) equipmentCostBasic.style.display = 'block';
      if (equipmentCostBasicAmount) equipmentCostBasicAmount.textContent = pricing.equipmentTotal || 0;
    } else {
      if (equipmentCostBasic) equipmentCostBasic.style.display = 'none';
    }
    
    // Update deposit info text based on survey inclusion
    if (depositInfo) {
      if (includeSurvey && pricing.surveyFee > 0) {
        depositInfo.textContent = 'No deposit required (Survey covers deposit)';
      } else {
        depositInfo.innerHTML = `Deposit Required: $<span id="depositAmount">${pricing.depositRequired || 0}</span>`;
      }
    }
    
  } else if (packageOption === 'Premium') {
    if (premiumPricing) premiumPricing.style.display = 'block';
    
    // Update premium pricing elements
    const estimatedHours = document.getElementById('estimatedHours');
    const laborRate = document.getElementById('laborRate');
    const estimatedTotal = document.getElementById('estimatedTotal');
    const premiumSurveyFee = document.getElementById('premiumSurveyFee');
    const equipmentCostPremium = document.getElementById('equipmentCostPremium');
    const equipmentCostPremiumAmount = document.getElementById('equipmentCostPremiumAmount');
    
    if (estimatedHours) estimatedHours.textContent = pricing.estimatedLaborHours || 0;
    if (laborRate) laborRate.textContent = pricing.laborRate || 50;
    if (estimatedTotal) estimatedTotal.textContent = pricing.estimatedTotal || 0;
    if (premiumSurveyFee) premiumSurveyFee.textContent = pricing.surveyFee || 0;
    
    // Show equipment cost if there is any
    if (pricing.equipmentTotal > 0) {
      if (equipmentCostPremium) equipmentCostPremium.style.display = 'block';
      if (equipmentCostPremiumAmount) equipmentCostPremiumAmount.textContent = pricing.equipmentTotal || 0;
    } else {
      if (equipmentCostPremium) equipmentCostPremium.style.display = 'none';
    }
  }
}

function initializeFormHandling() {
  const form = document.getElementById('quoteForm');
  if (!form) {
    console.error('Could not find #quoteForm on the page.');
    return;
  }
  form.addEventListener('submit', handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!selectedPackage) {
    alert('Please select a package before submitting.');
    return;
  }

  const name = document.getElementById('name')?.value.trim() || '';
  const email = document.getElementById('email')?.value.trim() || '';

  if (!name || !email) {
    alert('Please fill in your name and email.');
    return;
  }

  const runs = {
    coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
    cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0
  };

  const services = {
    deviceMount: parseInt(document.getElementById('deviceMountQty')?.value) || 0,
    networkSetup: parseInt(document.getElementById('networkSetupQty')?.value) || 0,
    mediaPanel: parseInt(document.getElementById('mediaPanelQty')?.value) || 0
  };

  const payload = {
    customer: { name, email },
    packageOption: selectedPackage,
    includeSurvey: includeSurvey,
    speedTier: selectedSpeedTier,
    discount: 0,
    runs,
    services,
    equipment: equipmentCart
  };

  try {
    const res = await fetch('/api/quotes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      alert(`Quote submitted successfully! Reference ID: ${data.id}`);
      // Reset form or redirect as needed
      form.reset();
      selectedPackage = null;
      includeSurvey = false;
      selectedSpeedTier = null;
      equipmentCart = [];
      showPackageSelection();
      document.getElementById('selectedPackageDisplay').style.display = 'none';
      document.getElementById('pricingSection').style.display = 'none';
      document.getElementById('equipmentSection').style.display = 'none';
      document.getElementById('submitBtn').disabled = true;
      updateCartDisplay();
    } else {
      alert(`Error creating quote: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    console.error(err);
    alert(`Network error: ${err.message}`);
  }
}
