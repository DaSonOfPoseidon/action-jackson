// public/scripts/quotes.js

let selectedServiceType = null;
let lastQuoteNumber = null;
let lastQuoteEmail = null;
let lastQuoteName = null;

// Pricing configuration (fallback defaults, overwritten by API fetch)
let pricing = {
  cables: { cat6: 100, coax: 150, fiber: 200 },
  addons: { apMount: 25, ethRelocation: 20 },
  centralization: { 'Media Panel': 100, 'Patch Panel': 50, 'Loose Termination': 0 },
  dropsOnly: { depositThreshold: 100, depositAmount: 20 },
  wholeHome: { depositAmount: 200 },
  laborHours: { cat6: 0.8, coax: 1.0, fiber: 1.4, apMount: 0.2, ethRelocation: 0.3, mediaPanel: 1.0, patchPanel: 0.5, looseTermination: 0 }
};

// HTML escape helper to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.textContent;
}

document.addEventListener('DOMContentLoaded', () => {
  fetchPricing();
  initializeStepNavigation();
  initializeServiceTypeSelection();
  initializeFormHandling();
  setupCalculationListeners();
  initializeWholeHomeToggles();
  initializeCentralizationToggle();
  initializeInfoButtons();
  initializeSchedulingIntegration();
  initializeMediaPanelToggle();
  initializeScopeDetailToggles();
  initializeSurveyInlineScheduling();
});

// ─── Dynamic Pricing Fetch ───

async function fetchPricing() {
  try {
    const res = await fetch('/api/quotes/pricing');
    if (res.ok) {
      const data = await res.json();
      pricing = {
        cables: data.cables || pricing.cables,
        addons: data.addons || pricing.addons,
        centralization: data.centralization || pricing.centralization,
        dropsOnly: data.dropsOnly || pricing.dropsOnly,
        wholeHome: data.wholeHome || pricing.wholeHome,
        laborHours: data.laborHours || pricing.laborHours
      };
      updateDynamicPriceLabels();
    }
  } catch (err) {
    console.error('Failed to fetch pricing, using defaults:', err);
  }
}

function updateDynamicPriceLabels() {
  const fieldMap = {
    cat6: pricing.cables.cat6,
    coax: pricing.cables.coax,
    fiber: pricing.cables.fiber
  };
  document.querySelectorAll('.dynamic-price').forEach(span => {
    const field = span.dataset.field;
    if (field && fieldMap[field] !== undefined) {
      span.textContent = fieldMap[field];
    }
  });
}

// ─── Progress Indicator ───

function updateProgressIndicator(stepNumber) {
  const steps = document.querySelectorAll('.progress-step');
  const connectors = document.querySelectorAll('.progress-connector');

  steps.forEach((step) => {
    const num = parseInt(step.dataset.step);
    step.classList.remove('active', 'completed');
    if (num === stepNumber) {
      step.classList.add('active');
    } else if (num < stepNumber) {
      step.classList.add('completed');
    }
  });

  connectors.forEach((conn, i) => {
    conn.classList.toggle('active', i + 1 < stepNumber);
  });
}

// Step Navigation
function initializeStepNavigation() {
  const step1 = document.getElementById('step-1-package');
  const step2 = document.getElementById('step-2-details');
  const step3 = document.getElementById('step-3-home-info');
  const step4 = document.getElementById('step-4-contact');
  const step5 = document.getElementById('step-5-success');

  if (step1) step1.style.display = 'block';
  if (step2) step2.style.display = 'none';
  if (step3) step3.style.display = 'none';
  if (step4) step4.style.display = 'none';
  if (step5) step5.style.display = 'none';

  const showStep = (step) => {
    [step1, step2, step3, step4, step5].forEach(s => { if (s) s.style.display = 'none'; });
    if (step) {
      step.style.display = 'block';
      step.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (step === step1) updateProgressIndicator(1);
    else if (step === step2) updateProgressIndicator(2);
    else if (step === step3) updateProgressIndicator(3);
    else if (step === step4) updateProgressIndicator(4);
    else if (step === step5) updateProgressIndicator(5);
  };

  // Step 2 -> Step 3
  const toStep3Btn = document.getElementById('to-step-3');
  if (toStep3Btn) {
    toStep3Btn.onclick = () => {
      if (selectedServiceType === 'Drops Only') {
        const totalRuns = (parseInt(document.getElementById('coaxRuns')?.value) || 0) +
                          (parseInt(document.getElementById('cat6Runs')?.value) || 0) +
                          (parseInt(document.getElementById('fiberRuns')?.value) || 0);
        const totalServices = (parseInt(document.getElementById('apMountQty')?.value) || 0) +
                              (parseInt(document.getElementById('ethRelocationQty')?.value) || 0);
        if (totalRuns === 0 && totalServices === 0) {
          alert('Please select at least one cable run or add-on service.');
          return;
        }
        const centralizationSelected = document.querySelector('input[name="centralization"]:checked');
        if (!centralizationSelected) {
          alert('Please select a drop centralization method.');
          return;
        }
        // Sync inline media panel answer to Step 3 hasMediaPanel toggle
        if (centralizationSelected.value === 'Media Panel') {
          const inlineYes = document.getElementById('inlineHasPanelYes')?.checked;
          const step3Yes = document.getElementById('hasMediaPanelYes');
          const step3No = document.getElementById('hasMediaPanelNo');
          if (step3Yes && step3No) {
            step3Yes.checked = !!inlineYes;
            step3No.checked = !inlineYes;
            const locationLabel = document.getElementById('mediaPanelLocationLabel');
            if (locationLabel) locationLabel.style.display = inlineYes ? 'block' : 'none';
          }
        }
      } else if (selectedServiceType === 'Whole-Home') {
        const networking = document.getElementById('scopeNetworking')?.checked;
        const security = document.getElementById('scopeSecurity')?.checked;
        const voip = document.getElementById('scopeVoip')?.checked;
        if (!networking && !security && !voip) {
          alert('Please select at least one scope (Networking, Security, or VoIP).');
          return;
        }
        // Validate survey selection when "before-install" is chosen
        const surveyPref = document.querySelector('input[name="surveyPreference"]:checked')?.value;
        if (surveyPref === 'before-install') {
          const surveyDate = document.getElementById('surveyDate')?.value;
          const surveyTime = document.getElementById('surveySelectedTime')?.value;
          if (!surveyDate || !surveyTime) {
            alert('Please select a date and time for your site survey, or choose "Day of install".');
            return;
          }
        }
      }
      showStep(step3);
    };
  }

  const backToStep2Btn = document.getElementById('back-to-step-2');
  if (backToStep2Btn) backToStep2Btn.onclick = () => showStep(step2);

  const toStep4Btn = document.getElementById('to-step-4');
  if (toStep4Btn) {
    toStep4Btn.onclick = () => {
      const homeAge = document.getElementById('homeAge')?.value;
      const stories = document.getElementById('stories')?.value;
      const atticAccess = document.getElementById('atticAccess')?.value;
      const liability = document.getElementById('liabilityAcknowledged')?.checked;

      if (!homeAge || !stories || !atticAccess) {
        alert('Please fill in all home information fields.');
        return;
      }

      // Validate address
      const street = document.getElementById('addressStreet')?.value?.trim();
      const city = document.getElementById('addressCity')?.value?.trim();
      const state = document.getElementById('addressState')?.value;
      const zip = document.getElementById('addressZip')?.value?.trim();
      if (!street || !city || !state || !zip) {
        alert('Please fill in your complete service address.');
        return;
      }
      if (!/^\d{5}(-\d{4})?$/.test(zip)) {
        alert('Please enter a valid ZIP code (e.g., 12345 or 12345-6789).');
        return;
      }

      if (!liability) {
        alert('You must acknowledge the safety & liability notice to proceed.');
        return;
      }

      updateFinalQuoteSummary();
      showStep(step4);
    };
  }

  const backToStep3Btn = document.getElementById('back-to-step-3');
  if (backToStep3Btn) backToStep3Btn.onclick = () => showStep(step3);

  const changeServiceBtn = document.getElementById('changeServiceBtn');
  if (changeServiceBtn) {
    changeServiceBtn.onclick = () => showStep(step1);
  }

  // Skip scheduling button
  const skipBtn = document.getElementById('skipScheduleBtn');
  if (skipBtn) {
    skipBtn.onclick = () => {
      window.location.href = '/';
    };
  }

  window.showStep = showStep;
  window.steps = { step1, step2, step3, step4, step5 };
}

function initializeServiceTypeSelection() {
  const serviceButtons = document.querySelectorAll('.service-select-btn');
  console.log('[quotes] Service buttons found:', serviceButtons.length);
  serviceButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = btn.dataset.service;
      selectServiceType(type);
    });
  });
}

function selectServiceType(type) {
  selectedServiceType = type;

  const hiddenInput = document.getElementById('selectedServiceType');
  if (hiddenInput) hiddenInput.value = type;

  const displayName = document.getElementById('serviceDisplayName');
  if (displayName) displayName.textContent = type;

  const dropsSection = document.getElementById('drops-only-details');
  const wholeHomeSection = document.getElementById('whole-home-details');
  if (dropsSection) dropsSection.style.display = type === 'Drops Only' ? 'block' : 'none';
  if (wholeHomeSection) wholeHomeSection.style.display = type === 'Whole-Home' ? 'block' : 'none';

  if (window.showStep && window.steps) {
    window.showStep(window.steps.step2);
  }

  if (type === 'Drops Only') {
    calculateDropsOnlyPricing();
  }
}

function initializeWholeHomeToggles() {
  const ownEquipmentYes = document.getElementById('ownEquipmentYes');
  const ownEquipmentNo = document.getElementById('ownEquipmentNo');
  const equipmentDescSection = document.getElementById('equipmentDescriptionSection');
  const brandPrefsSection = document.getElementById('brandPreferencesSection');

  if (ownEquipmentYes) {
    ownEquipmentYes.addEventListener('change', () => {
      if (equipmentDescSection) equipmentDescSection.style.display = 'block';
      if (brandPrefsSection) brandPrefsSection.style.display = 'none';
    });
  }
  if (ownEquipmentNo) {
    ownEquipmentNo.addEventListener('change', () => {
      if (equipmentDescSection) equipmentDescSection.style.display = 'none';
      if (brandPrefsSection) brandPrefsSection.style.display = 'block';
    });
  }
}

function initializeCentralizationToggle() {
  const radios = document.querySelectorAll('input[name="centralization"]');
  const inlineQuestion = document.getElementById('mediaPanelInlineQuestion');
  const inlinePanelRadios = document.querySelectorAll('input[name="inlineHasMediaPanel"]');

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (inlineQuestion) {
        inlineQuestion.style.display = radio.value === 'Media Panel' ? 'block' : 'none';
      }
      calculateDropsOnlyPricing();
    });
  });

  inlinePanelRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      calculateDropsOnlyPricing();
    });
  });
}

// ─── Scope Detail Toggles ───

function initializeScopeDetailToggles() {
  const toggles = [
    { checkbox: 'scopeNetworking', detail: 'scopeNetworkingDetails' },
    { checkbox: 'scopeSecurity', detail: 'scopeSecurityDetails' },
    { checkbox: 'scopeVoip', detail: 'scopeVoipDetails' }
  ];

  toggles.forEach(({ checkbox, detail }) => {
    const cb = document.getElementById(checkbox);
    const detailEl = document.getElementById(detail);
    if (cb && detailEl) {
      cb.addEventListener('change', () => {
        detailEl.style.display = cb.checked ? 'block' : 'none';
      });
    }
  });
}

// ─── Inline Survey Scheduling ───

function initializeSurveyInlineScheduling() {
  const surveyRadios = document.querySelectorAll('input[name="surveyPreference"]');
  const scheduler = document.getElementById('inlineSurveyScheduler');
  if (!scheduler) return;

  // Toggle visibility based on survey preference
  surveyRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      scheduler.style.display = radio.value === 'before-install' && radio.checked ? 'block' : 'none';
    });
  });

  // Show by default since "before-install" is checked
  scheduler.style.display = 'block';

  const dateInput = document.getElementById('surveyDate');
  if (!dateInput) return;

  // Set min/max
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.min = tomorrow.toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  dateInput.max = maxDate.toISOString().split('T')[0];

  dateInput.addEventListener('change', async () => {
    const dateVal = dateInput.value;
    if (!dateVal) return;

    try {
      const res = await fetch(`/api/scheduling/slots?date=${dateVal}`);
      const data = await res.json();

      if (res.ok) {
        renderSurveyTimeSlots(data.bookedSlots || []);
        document.getElementById('surveyTimeSlotsContainer').style.display = 'block';
      }
    } catch (err) {
      console.error('Error fetching survey slots:', err);
    }
  });
}

function renderSurveyTimeSlots(bookedSlots) {
  const grid = document.getElementById('surveyTimeSlotsGrid');
  if (!grid) return;

  while (grid.firstChild) {
    grid.removeChild(grid.firstChild);
  }

  const hiddenTime = document.getElementById('surveySelectedTime');
  if (hiddenTime) hiddenTime.value = '';

  // Hide the note
  const noteEl = document.getElementById('surveyScheduleNote');
  if (noteEl) noteEl.style.display = 'none';

  // Compute blocked hours from booked slots
  const blockedHours = computeBlockedHours(bookedSlots);

  // Survey is 2 hours, so last possible start is 16:00 (ends at 18:00)
  for (let h = 8; h <= 16; h++) {
    const time = `${String(h).padStart(2, '0')}:00`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot-btn';
    btn.textContent = formatTime(time);
    btn.dataset.time = time;

    // Check if this 2-hour survey window overlaps any blocked hours
    const surveyHours = [h, h + 1];
    const isBlocked = surveyHours.some(hr => blockedHours.has(hr));

    if (isBlocked) {
      btn.classList.add('booked');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => selectSurveyTimeSlot(time, btn));
    }

    grid.appendChild(btn);
  }
}

function selectSurveyTimeSlot(time, btn) {
  const grid = document.getElementById('surveyTimeSlotsGrid');
  if (grid) {
    grid.querySelectorAll('.time-slot-btn.selected').forEach(b => b.classList.remove('selected'));
  }
  btn.classList.add('selected');

  const hiddenTime = document.getElementById('surveySelectedTime');
  if (hiddenTime) hiddenTime.value = time;

  // Show confirmation note
  const noteEl = document.getElementById('surveyScheduleNote');
  const summaryEl = document.getElementById('surveyScheduleSummary');
  const dateVal = document.getElementById('surveyDate')?.value;
  if (noteEl && summaryEl && dateVal) {
    const dateObj = new Date(dateVal + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    summaryEl.textContent = `${dateStr} at ${formatTime(time)}`;
    noteEl.style.display = 'block';
  }
}

function setupCalculationListeners() {
  const inputFields = ['coaxRuns', 'cat6Runs', 'fiberRuns', 'apMountQty', 'ethRelocationQty'];
  inputFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', calculateDropsOnlyPricing);
    }
  });
}

async function calculateDropsOnlyPricing() {
  if (selectedServiceType !== 'Drops Only') return;

  const runs = {
    coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
    cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0,
    fiber: parseInt(document.getElementById('fiberRuns')?.value) || 0
  };

  const services = {
    apMount: parseInt(document.getElementById('apMountQty')?.value) || 0,
    ethRelocation: parseInt(document.getElementById('ethRelocationQty')?.value) || 0
  };

  const centralizationType = document.querySelector('input[name="centralization"]:checked')?.value || '';
  const hasExistingPanel = document.getElementById('inlineHasPanelYes')?.checked || false;

  try {
    const params = new URLSearchParams({
      serviceType: 'Drops Only',
      'runs[coax]': runs.coax,
      'runs[cat6]': runs.cat6,
      'runs[fiber]': runs.fiber,
      'services[apMount]': services.apMount,
      'services[ethRelocation]': services.ethRelocation
    });

    if (centralizationType) {
      params.set('centralization[type]', centralizationType);
      params.set('centralization[hasExistingPanel]', String(hasExistingPanel));
    }

    const response = await fetch(`/api/quotes/calculate?${params}`);
    const data = await response.json();

    if (response.ok) {
      updateDropsPricingDisplay(data.pricing);
    }
  } catch (err) {
    console.error('Calculation error:', err);
  }
}

function updateDropsPricingDisplay(pricingData) {
  const totalCostEl = document.getElementById('totalCost');
  const depositAmountEl = document.getElementById('depositAmount');

  if (totalCostEl) totalCostEl.textContent = pricingData.totalCost || 0;
  if (depositAmountEl) depositAmountEl.textContent = pricingData.depositRequired || 0;
}

function initializeFormHandling() {
  const form = document.getElementById('quoteForm');
  if (!form) return;
  form.addEventListener('submit', handleSubmit);
}

// ─── Compute drops-only duration from labor hours ───

function computeDropsOnlyDuration() {
  const runs = {
    coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
    cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0,
    fiber: parseInt(document.getElementById('fiberRuns')?.value) || 0
  };
  const services = {
    apMount: parseInt(document.getElementById('apMountQty')?.value) || 0,
    ethRelocation: parseInt(document.getElementById('ethRelocationQty')?.value) || 0
  };

  const lh = pricing.laborHours || {};
  const totalHours =
    runs.cat6 * (lh.cat6 || 0.8) +
    runs.coax * (lh.coax || 1.0) +
    runs.fiber * (lh.fiber || 1.4) +
    services.apMount * (lh.apMount || 0.2) +
    services.ethRelocation * (lh.ethRelocation || 0.3);

  // Add 1 hour buffer, round up to nearest hour, convert to minutes
  const withBuffer = totalHours + 1;
  const roundedUp = Math.ceil(withBuffer);
  return Math.max(roundedUp * 60, 120); // minimum 2 hours
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!selectedServiceType) {
    alert('Please select a service type before submitting.');
    return;
  }

  const name = document.getElementById('name')?.value.trim() || '';
  const email = document.getElementById('email')?.value.trim() || '';
  const phone = document.getElementById('phone')?.value.trim() || '';

  if (!name || !email) {
    alert('Please fill in your name and email.');
    return;
  }

  const homeInfo = {
    homeAge: document.getElementById('homeAge')?.value,
    stories: parseInt(document.getElementById('stories')?.value) || 1,
    atticAccess: document.getElementById('atticAccess')?.value,
    hasMediaPanel: document.getElementById('hasMediaPanelYes')?.checked || false,
    mediaPanelLocation: document.getElementById('mediaPanelLocation')?.value || '',
    hasCrawlspaceOrBasement: document.getElementById('hasCrawlspaceYes')?.checked || false,
    liabilityAcknowledged: document.getElementById('liabilityAcknowledged')?.checked || false,
    address: {
      street: document.getElementById('addressStreet')?.value?.trim() || '',
      city: document.getElementById('addressCity')?.value?.trim() || '',
      state: document.getElementById('addressState')?.value || '',
      zip: document.getElementById('addressZip')?.value?.trim() || ''
    }
  };

  const payload = {
    customer: { name, email, phone: phone || undefined },
    serviceType: selectedServiceType,
    discount: 0,
    homeInfo
  };

  if (selectedServiceType === 'Drops Only') {
    payload.runs = {
      coax: parseInt(document.getElementById('coaxRuns')?.value) || 0,
      cat6: parseInt(document.getElementById('cat6Runs')?.value) || 0,
      fiber: parseInt(document.getElementById('fiberRuns')?.value) || 0
    };
    payload.services = {
      mediaPanel: 0,
      apMount: parseInt(document.getElementById('apMountQty')?.value) || 0,
      ethRelocation: parseInt(document.getElementById('ethRelocationQty')?.value) || 0
    };
    payload.centralization = document.querySelector('input[name="centralization"]:checked')?.value || '';
    if (payload.centralization === 'Media Panel') {
      payload.homeInfo.hasMediaPanel = document.getElementById('inlineHasPanelYes')?.checked || false;
    }
  } else if (selectedServiceType === 'Whole-Home') {
    payload.wholeHome = {
      scope: {
        networking: document.getElementById('scopeNetworking')?.checked || false,
        security: document.getElementById('scopeSecurity')?.checked || false,
        voip: document.getElementById('scopeVoip')?.checked || false
      },
      internetSpeed: document.getElementById('internetSpeed')?.value || '',
      hasOwnEquipment: document.getElementById('ownEquipmentYes')?.checked || false,
      equipmentDescription: document.getElementById('equipmentDescription')?.value || '',
      networkingBrand: document.querySelector('input[name="networkingBrand"]:checked')?.value || 'No Preference',
      securityBrand: document.querySelector('input[name="securityBrand"]:checked')?.value || 'No Preference',
      surveyPreference: document.querySelector('input[name="surveyPreference"]:checked')?.value || 'before-install',
      networkingDetails: document.getElementById('networkingDetails')?.value || '',
      securityDetails: document.getElementById('securityDetails')?.value || '',
      voipDetails: document.getElementById('voipDetails')?.value || '',
      notes: document.getElementById('wholeHomeNotes')?.value || ''
    };
  }

  try {
    const res = await fetch('/api/quotes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok) {
      lastQuoteNumber = data.quoteNumber;
      lastQuoteEmail = email;
      lastQuoteName = name;

      const quoteNumEl = document.getElementById('successQuoteNumber');
      if (quoteNumEl) quoteNumEl.textContent = '#' + data.quoteNumber;

      const schedPhone = document.getElementById('schedulePhone');
      if (schedPhone && phone) schedPhone.value = phone;

      // Auto-book survey if "before-install" was selected
      if (selectedServiceType === 'Whole-Home') {
        const surveyPref = document.querySelector('input[name="surveyPreference"]:checked')?.value;
        const surveyDate = document.getElementById('surveyDate')?.value;
        const surveyTime = document.getElementById('surveySelectedTime')?.value;

        if (surveyPref === 'before-install' && surveyDate && surveyTime) {
          try {
            await fetch('/api/scheduling/book', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quoteNumber: data.quoteNumber,
                name,
                email,
                date: surveyDate,
                time: surveyTime,
                appointmentType: 'survey',
                duration: 120
              })
            });
          } catch (surveyErr) {
            console.error('Failed to auto-book survey:', surveyErr);
          }
        }
      }

      if (window.showStep && window.steps) {
        window.showStep(window.steps.step5);
      }
    } else {
      alert(`Error creating quote: ${data.error || data.details?.join(', ') || 'Unknown error'}`);
    }
  } catch (err) {
    console.error(err);
    alert(`Network error: ${err.message}`);
  }
}

// ─── Scheduling Integration (Step 5) ───

function initializeSchedulingIntegration() {
  const dateInput = document.getElementById('scheduleDate');
  if (!dateInput) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  dateInput.min = tomorrow.toISOString().split('T')[0];

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 90);
  dateInput.max = maxDate.toISOString().split('T')[0];

  dateInput.addEventListener('change', async () => {
    const dateVal = dateInput.value;
    if (!dateVal) return;

    try {
      const res = await fetch(`/api/scheduling/slots?date=${dateVal}`);
      const data = await res.json();

      if (res.ok) {
        renderTimeSlots(data.bookedSlots || []);
        document.getElementById('timeSlotsContainer').style.display = 'block';
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  });

  const scheduleForm = document.getElementById('scheduleForm');
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', handleScheduleSubmit);
  }
}

// Compute which hour-indices are blocked by existing bookings
function computeBlockedHours(bookedSlots) {
  const blocked = new Set();
  for (const slot of bookedSlots) {
    const [h] = slot.time.split(':').map(Number);
    const duration = slot.duration || 60;
    const appointmentType = slot.appointmentType || 'drops-only-install';

    if (appointmentType === 'whole-home-install') {
      // Whole-home blocks all hours
      for (let hr = 0; hr < 24; hr++) blocked.add(hr);
    } else {
      const durationHours = Math.ceil(duration / 60);
      for (let i = 0; i < durationHours; i++) {
        blocked.add(h + i);
      }
    }
  }
  return blocked;
}

function renderTimeSlots(bookedSlots) {
  const grid = document.getElementById('timeSlotsGrid');
  if (!grid) return;

  while (grid.firstChild) {
    grid.removeChild(grid.firstChild);
  }

  const hiddenTime = document.getElementById('selectedTime');
  if (hiddenTime) hiddenTime.value = '';
  const bookBtn = document.getElementById('bookAppointmentBtn');
  if (bookBtn) bookBtn.disabled = true;

  const blockedHours = computeBlockedHours(bookedSlots);

  // Determine the appointment type and duration for the current booking
  let bookingDurationHours = 2; // default
  if (selectedServiceType === 'Whole-Home') {
    bookingDurationHours = 12; // full day
  } else if (selectedServiceType === 'Drops Only') {
    bookingDurationHours = Math.ceil(computeDropsOnlyDuration() / 60);
  }

  // Generate hourly slots from 8:00 to 17:00
  for (let h = 8; h < 18; h++) {
    const time = `${String(h).padStart(2, '0')}:00`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot-btn';
    btn.textContent = formatTime(time);
    btn.dataset.time = time;

    // Check if this slot or the duration window overlaps blocked hours
    let isBlocked = false;
    for (let i = 0; i < bookingDurationHours; i++) {
      if (blockedHours.has(h + i) || (h + i) >= 18) {
        isBlocked = true;
        break;
      }
    }

    if (isBlocked) {
      btn.classList.add('booked');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => selectTimeSlot(time, btn));
    }

    grid.appendChild(btn);
  }
}

function selectTimeSlot(time, btn) {
  document.querySelectorAll('#timeSlotsGrid .time-slot-btn.selected').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  const hiddenTime = document.getElementById('selectedTime');
  if (hiddenTime) hiddenTime.value = time;

  const bookBtn = document.getElementById('bookAppointmentBtn');
  if (bookBtn) bookBtn.disabled = false;
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

async function handleScheduleSubmit(e) {
  e.preventDefault();

  const date = document.getElementById('scheduleDate')?.value;
  const time = document.getElementById('selectedTime')?.value;
  const phone = document.getElementById('schedulePhone')?.value?.trim() || undefined;
  const notes = document.getElementById('scheduleNotes')?.value?.trim() || undefined;

  if (!date || !time) {
    alert('Please select a date and time slot.');
    return;
  }

  if (!lastQuoteNumber || !lastQuoteEmail || !lastQuoteName) {
    alert('Quote information missing. Please try again.');
    return;
  }

  const statusEl = document.getElementById('scheduleStatus');

  // Determine appointment type and duration
  let appointmentType = 'drops-only-install';
  let duration = 120;
  if (selectedServiceType === 'Whole-Home') {
    appointmentType = 'whole-home-install';
    duration = 720;
  } else if (selectedServiceType === 'Drops Only') {
    appointmentType = 'drops-only-install';
    duration = computeDropsOnlyDuration();
  }

  try {
    const res = await fetch('/api/scheduling/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteNumber: lastQuoteNumber,
        name: lastQuoteName,
        email: lastQuoteEmail,
        date,
        time,
        phone,
        notes,
        appointmentType,
        duration
      })
    });

    const data = await res.json();

    if (res.ok) {
      document.getElementById('scheduleForm').style.display = 'none';
      const confirmation = document.getElementById('scheduleConfirmation');
      if (confirmation) {
        confirmation.style.display = 'block';
        const details = document.getElementById('confirmationDetails');
        if (details) {
          const dateObj = new Date(date + 'T12:00:00');
          const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          details.textContent = `${dateStr} at ${formatTime(time)}`;
        }
      }
      if (statusEl) statusEl.textContent = '';
    } else {
      if (statusEl) {
        statusEl.textContent = data.error || data.details?.join(', ') || 'Error booking appointment.';
        statusEl.style.color = 'var(--error)';
      }
    }
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent = `Network error: ${err.message}`;
      statusEl.style.color = 'var(--error)';
    }
  }
}

// ─── Quote Summary ───

function updateFinalQuoteSummary() {
  const summaryContent = document.getElementById('summaryContent');
  if (!summaryContent) return;

  while (summaryContent.firstChild) {
    summaryContent.removeChild(summaryContent.firstChild);
  }

  if (selectedServiceType === 'Drops Only') {
    buildDropsOnlySummaryDOM(summaryContent);
  } else if (selectedServiceType === 'Whole-Home') {
    buildWholeHomeSummaryDOM(summaryContent);
  }

  buildHomeInfoSummaryDOM(summaryContent);
}

function createSummaryLine(label, value) {
  const line = document.createElement('div');
  line.className = 'summary-line';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  const valueSpan = document.createElement('span');
  valueSpan.textContent = value;
  line.appendChild(labelSpan);
  line.appendChild(valueSpan);
  return line;
}

function buildDropsOnlySummaryDOM(container) {
  const coax = parseInt(document.getElementById('coaxRuns')?.value) || 0;
  const cat6 = parseInt(document.getElementById('cat6Runs')?.value) || 0;
  const fiber = parseInt(document.getElementById('fiberRuns')?.value) || 0;
  const apMount = parseInt(document.getElementById('apMountQty')?.value) || 0;
  const ethRelocation = parseInt(document.getElementById('ethRelocationQty')?.value) || 0;

  const centralizationType = document.querySelector('input[name="centralization"]:checked')?.value || '';
  const hasExistingPanel = document.getElementById('inlineHasPanelYes')?.checked || false;

  const heading = document.createElement('h4');
  heading.textContent = 'Drops Only';
  container.appendChild(heading);

  const items = document.createElement('div');
  items.className = 'summary-items';

  if (cat6 > 0) items.appendChild(createSummaryLine(`Cat6 runs (${cat6}x @ $${pricing.cables.cat6})`, `$${cat6 * pricing.cables.cat6}`));
  if (coax > 0) items.appendChild(createSummaryLine(`Coax runs (${coax}x @ $${pricing.cables.coax})`, `$${coax * pricing.cables.coax}`));
  if (fiber > 0) items.appendChild(createSummaryLine(`Fiber runs (${fiber}x @ $${pricing.cables.fiber})`, `$${fiber * pricing.cables.fiber}`));

  let centralizationCost = 0;
  let centralizationLabel = '';
  if (centralizationType) {
    if (centralizationType === 'Media Panel') {
      if (hasExistingPanel) {
        centralizationCost = 0;
        centralizationLabel = 'Media Panel (Existing - $0)';
      } else {
        centralizationCost = pricing.centralization['Media Panel'];
        centralizationLabel = 'Media Panel (New Install)';
      }
    } else if (centralizationType === 'Patch Panel') {
      centralizationCost = pricing.centralization['Patch Panel'];
      centralizationLabel = 'Patch Panel';
    } else {
      centralizationCost = 0;
      centralizationLabel = 'Loose Termination';
    }
    items.appendChild(createSummaryLine(`Centralization: ${centralizationLabel}`, centralizationCost > 0 ? `$${centralizationCost}` : 'Free'));
  }

  if (apMount > 0) items.appendChild(createSummaryLine(`AP mounting (${apMount}x)`, `$${apMount * pricing.addons.apMount}`));
  if (ethRelocation > 0) items.appendChild(createSummaryLine(`Ethernet relocation (${ethRelocation}x)`, `$${ethRelocation * pricing.addons.ethRelocation}`));

  container.appendChild(items);

  const total = (cat6 * pricing.cables.cat6) + (coax * pricing.cables.coax) + (fiber * pricing.cables.fiber) +
                centralizationCost +
                (apMount * pricing.addons.apMount) +
                (ethRelocation * pricing.addons.ethRelocation);
  const deposit = total > pricing.dropsOnly.depositThreshold ? pricing.dropsOnly.depositAmount : 0;

  const totalLine = document.createElement('div');
  totalLine.className = 'summary-total';
  totalLine.appendChild(createSummaryLine('Total:', `$${total}`));
  container.appendChild(totalLine);

  if (deposit > 0) {
    const depositLine = document.createElement('div');
    depositLine.className = 'summary-deposit';
    depositLine.appendChild(createSummaryLine('Deposit Required:', `$${deposit}`));
    container.appendChild(depositLine);
  }
}

function buildWholeHomeSummaryDOM(container) {
  const heading = document.createElement('h4');
  heading.textContent = 'Whole-Home Setup';
  container.appendChild(heading);

  const items = document.createElement('div');
  items.className = 'summary-items';

  const networking = document.getElementById('scopeNetworking')?.checked;
  const security = document.getElementById('scopeSecurity')?.checked;
  const voip = document.getElementById('scopeVoip')?.checked;
  const scopeParts = [];
  if (networking) scopeParts.push('Networking');
  if (security) scopeParts.push('Security');
  if (voip) scopeParts.push('VoIP');
  items.appendChild(createSummaryLine('Scope:', scopeParts.join(', ')));

  // Scope details
  if (networking) {
    const nd = document.getElementById('networkingDetails')?.value;
    if (nd) {
      const truncated = nd.substring(0, 100) + (nd.length > 100 ? '...' : '');
      items.appendChild(createSummaryLine('Networking Details:', escapeHtml(truncated)));
    }
  }
  if (security) {
    const sd = document.getElementById('securityDetails')?.value;
    if (sd) {
      const truncated = sd.substring(0, 100) + (sd.length > 100 ? '...' : '');
      items.appendChild(createSummaryLine('Security Details:', escapeHtml(truncated)));
    }
  }
  if (voip) {
    const vd = document.getElementById('voipDetails')?.value;
    if (vd) {
      const truncated = vd.substring(0, 100) + (vd.length > 100 ? '...' : '');
      items.appendChild(createSummaryLine('VoIP Details:', escapeHtml(truncated)));
    }
  }

  const speed = document.getElementById('internetSpeed')?.value;
  if (speed) items.appendChild(createSummaryLine('Internet Speed:', escapeHtml(speed)));

  const hasOwnEquipment = document.getElementById('ownEquipmentYes')?.checked;
  if (hasOwnEquipment) {
    const desc = document.getElementById('equipmentDescription')?.value || '';
    items.appendChild(createSummaryLine('Equipment:', 'Customer-provided'));
    if (desc) {
      const truncated = desc.substring(0, 100) + (desc.length > 100 ? '...' : '');
      items.appendChild(createSummaryLine('Description:', escapeHtml(truncated)));
    }
  } else {
    const networkBrand = document.querySelector('input[name="networkingBrand"]:checked')?.value;
    const secBrand = document.querySelector('input[name="securityBrand"]:checked')?.value;
    if (networking && networkBrand) items.appendChild(createSummaryLine('Networking Brand:', networkBrand));
    if (security && secBrand) items.appendChild(createSummaryLine('Security Brand:', secBrand));
  }

  const surveyPref = document.querySelector('input[name="surveyPreference"]:checked')?.value;
  if (surveyPref) {
    let surveyText = surveyPref === 'before-install' ? 'Before install' : 'Day of install';
    // Show survey date/time if scheduled inline
    if (surveyPref === 'before-install') {
      const surveyDate = document.getElementById('surveyDate')?.value;
      const surveyTime = document.getElementById('surveySelectedTime')?.value;
      if (surveyDate && surveyTime) {
        const dateObj = new Date(surveyDate + 'T12:00:00');
        const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        surveyText += ` - ${dateStr} at ${formatTime(surveyTime)}`;
      }
    }
    items.appendChild(createSummaryLine('Site Survey:', surveyText));
  }

  const notes = document.getElementById('wholeHomeNotes')?.value;
  if (notes) {
    const truncated = notes.substring(0, 100) + (notes.length > 100 ? '...' : '');
    items.appendChild(createSummaryLine('Notes:', escapeHtml(truncated)));
  }

  container.appendChild(items);

  const depositLine = document.createElement('div');
  depositLine.className = 'summary-deposit';
  depositLine.appendChild(createSummaryLine('Deposit Required:', `$${pricing.wholeHome.depositAmount}`));
  container.appendChild(depositLine);

  const note = document.createElement('div');
  note.className = 'summary-note';
  const em = document.createElement('em');
  em.textContent = 'Final pricing will be determined after site survey.';
  note.appendChild(em);
  container.appendChild(note);
}

function buildHomeInfoSummaryDOM(container) {
  const homeAge = document.getElementById('homeAge')?.value || 'N/A';
  const stories = document.getElementById('stories')?.value || 'N/A';
  const atticAccess = document.getElementById('atticAccess')?.value || 'N/A';
  const hasMediaPanel = document.getElementById('hasMediaPanelYes')?.checked;
  const mediaPanelLoc = document.getElementById('mediaPanelLocation')?.value || '';
  const hasCrawlspace = document.getElementById('hasCrawlspaceYes')?.checked;

  const heading = document.createElement('h4');
  heading.textContent = 'Home Information';
  container.appendChild(heading);

  const items = document.createElement('div');
  items.className = 'summary-items';

  // Address
  const street = document.getElementById('addressStreet')?.value?.trim() || '';
  const city = document.getElementById('addressCity')?.value?.trim() || '';
  const state = document.getElementById('addressState')?.value || '';
  const zip = document.getElementById('addressZip')?.value?.trim() || '';
  if (street) {
    const addressStr = `${street}, ${city}, ${state} ${zip}`;
    items.appendChild(createSummaryLine('Service Address:', escapeHtml(addressStr)));
  }

  items.appendChild(createSummaryLine('Home Age:', homeAge));
  items.appendChild(createSummaryLine('Stories:', stories));
  items.appendChild(createSummaryLine('Attic Access:', atticAccess));

  const mediaPanelText = hasMediaPanel
    ? `Yes${mediaPanelLoc ? ' (' + escapeHtml(mediaPanelLoc) + ')' : ''}`
    : 'No';
  items.appendChild(createSummaryLine('Existing Media Panel:', mediaPanelText));
  items.appendChild(createSummaryLine('Crawl Space / Basement:', hasCrawlspace ? 'Yes' : 'No'));

  container.appendChild(items);
}

function initializeMediaPanelToggle() {
  const mediaPanelYes = document.getElementById('hasMediaPanelYes');
  const mediaPanelNo = document.getElementById('hasMediaPanelNo');
  const locationLabel = document.getElementById('mediaPanelLocationLabel');

  if (mediaPanelYes) {
    mediaPanelYes.addEventListener('change', () => {
      if (locationLabel) locationLabel.style.display = 'block';
    });
  }
  if (mediaPanelNo) {
    mediaPanelNo.addEventListener('change', () => {
      if (locationLabel) locationLabel.style.display = 'none';
    });
  }
}

function initializeInfoButtons() {
  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cableType = btn.getAttribute('data-cable');
      const infoPanel = document.getElementById(cableType + '-info');
      if (infoPanel) {
        infoPanel.classList.toggle('active');
      }
    });
  });
}
