// public/scripts/estimate.js

(function () {
  'use strict';

  // State
  let costData = null; // { categories: {...}, laborRate: number }
  let selections = {}; // { itemId: { quantity, item } }

  // DOM references
  const els = {};

  document.addEventListener('DOMContentLoaded', () => {
    els.loading = document.getElementById('estimateLoading');
    els.error = document.getElementById('estimateError');
    els.categoryContainer = document.getElementById('categoryContainer');
    els.summaryLineItems = document.getElementById('summaryLineItems');
    els.summaryEmpty = document.getElementById('summaryEmpty');
    els.summaryTotal = document.getElementById('summaryTotal');
    els.mobileSummaryTotal = document.getElementById('mobileSummaryTotal');
    els.resetBtn = document.getElementById('resetBtn');
    els.retryBtn = document.getElementById('retryBtn');
    els.mobileExpandBtn = document.getElementById('mobileExpandBtn');

    els.resetBtn.addEventListener('click', resetAll);
    els.retryBtn.addEventListener('click', loadCostItems);
    els.mobileExpandBtn.addEventListener('click', toggleMobileOverlay);

    loadCostItems();
  });

  // ─── Data Loading ───

  async function loadCostItems() {
    showLoading();

    try {
      const res = await fetch('/api/estimates/cost-items');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      if (!data.categories || Object.keys(data.categories).length === 0) {
        throw new Error('No items');
      }

      costData = data;
      selections = {};
      renderCategories();
      updateSummary();
    } catch (err) {
      console.error('Error loading cost items:', err);
      showError();
    }
  }

  function showLoading() {
    els.loading.style.display = '';
    els.error.style.display = 'none';
    els.categoryContainer.style.display = 'none';
  }

  function showError() {
    els.loading.style.display = 'none';
    els.error.style.display = '';
    els.categoryContainer.style.display = 'none';
  }

  function showContent() {
    els.loading.style.display = 'none';
    els.error.style.display = 'none';
    els.categoryContainer.style.display = '';
  }

  // ─── Rendering ───

  function renderCategories() {
    // Clear container safely
    while (els.categoryContainer.firstChild) {
      els.categoryContainer.removeChild(els.categoryContainer.firstChild);
    }

    // Preferred category order
    const order = ['Cable Runs', 'Services', 'Centralization', 'Equipment'];
    const categoryNames = Object.keys(costData.categories);

    // Sort: known order first, then any unknown categories alphabetically
    categoryNames.sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    for (const catName of categoryNames) {
      const items = costData.categories[catName];
      if (!items || items.length === 0) continue;

      if (catName === 'Centralization') {
        renderCentralizationCategory(catName, items);
      } else {
        renderStandardCategory(catName, items);
      }
    }

    showContent();
  }

  function renderStandardCategory(catName, items) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = catName;
    fieldset.appendChild(legend);

    for (const item of items) {
      const row = createItemRow(item);
      fieldset.appendChild(row);
    }

    els.categoryContainer.appendChild(fieldset);
  }

  function createItemRow(item) {
    const wrapper = document.createElement('div');

    const row = document.createElement('div');
    row.className = 'estimate-item';
    row.dataset.itemId = item._id;

    // Info section
    const info = document.createElement('div');
    info.className = 'item-info';

    const nameRow = document.createElement('div');
    nameRow.className = 'item-name';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = item.name;
    nameRow.appendChild(nameSpan);

    // Info button (only if description exists)
    if (item.description) {
      const infoBtn = document.createElement('button');
      infoBtn.type = 'button';
      infoBtn.className = 'item-info-btn';
      infoBtn.setAttribute('aria-label', item.name + ' details');

      const icon = document.createElement('i');
      icon.className = 'fas fa-info-circle';
      infoBtn.appendChild(icon);

      const descDiv = document.createElement('div');
      descDiv.className = 'item-description';
      descDiv.textContent = item.description;

      infoBtn.addEventListener('click', function () {
        descDiv.classList.toggle('active');
      });

      nameRow.appendChild(infoBtn);
      info.appendChild(nameRow);
      info.appendChild(descDiv);
    } else {
      info.appendChild(nameRow);
    }

    // Price label
    const priceLabel = document.createElement('div');
    priceLabel.className = 'item-price-label';
    priceLabel.textContent = '$' + item.price + (item.unitLabel ? ' ' + item.unitLabel : '');
    info.appendChild(priceLabel);

    row.appendChild(info);

    // Control
    const control = document.createElement('div');
    control.className = 'item-control';

    if (item.unitType === 'flat-fee') {
      const label = document.createElement('label');
      label.className = 'flat-fee-toggle';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.itemId = item._id;
      checkbox.addEventListener('change', function () {
        setQuantity(item, this.checked ? 1 : 0);
      });

      const span = document.createElement('span');
      span.className = 'flat-fee-label';
      span.textContent = 'Add';

      label.appendChild(checkbox);
      label.appendChild(span);
      control.appendChild(label);
    } else {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.value = '0';
      input.dataset.itemId = item._id;
      input.addEventListener('input', function () {
        const val = parseInt(this.value) || 0;
        setQuantity(item, Math.max(0, val));
      });
      control.appendChild(input);
    }

    row.appendChild(control);
    wrapper.appendChild(row);

    return wrapper;
  }

  function renderCentralizationCategory(catName, items) {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = catName;
    fieldset.appendChild(legend);

    const hint = document.createElement('p');
    hint.style.color = 'var(--text-muted)';
    hint.style.fontSize = '0.9rem';
    hint.style.marginBottom = '0.75rem';
    hint.textContent = 'Choose one centralization method:';
    fieldset.appendChild(hint);

    const group = document.createElement('div');
    group.className = 'centralization-group';

    for (const item of items) {
      const option = document.createElement('label');
      option.className = 'centralization-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'centralization';
      radio.value = item._id;
      radio.dataset.itemId = item._id;

      radio.addEventListener('change', function () {
        // Clear all centralization selections
        for (const cItem of items) {
          if (selections[cItem._id]) {
            delete selections[cItem._id];
          }
        }
        // Set the selected one
        if (this.checked) {
          setQuantity(item, 1);
        }
        // Update visual selection
        group.querySelectorAll('.centralization-option').forEach(function (opt) {
          opt.classList.remove('selected');
        });
        option.classList.add('selected');
      });

      const info = document.createElement('div');
      info.className = 'item-info';

      const nameRow = document.createElement('div');
      nameRow.className = 'item-name';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      nameRow.appendChild(nameSpan);

      info.appendChild(nameRow);

      const priceLabel = document.createElement('div');
      priceLabel.className = 'item-price-label';
      priceLabel.textContent = '$' + item.price + (item.unitLabel ? ' ' + item.unitLabel : '');
      info.appendChild(priceLabel);

      // Description
      if (item.description) {
        const infoBtn = document.createElement('button');
        infoBtn.type = 'button';
        infoBtn.className = 'item-info-btn';
        infoBtn.setAttribute('aria-label', item.name + ' details');

        const icon = document.createElement('i');
        icon.className = 'fas fa-info-circle';
        infoBtn.appendChild(icon);

        const descDiv = document.createElement('div');
        descDiv.className = 'item-description';
        descDiv.textContent = item.description;

        infoBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          descDiv.classList.toggle('active');
        });

        option.appendChild(radio);
        option.appendChild(info);
        option.appendChild(infoBtn);
        group.appendChild(option);
        group.appendChild(descDiv);
      } else {
        option.appendChild(radio);
        option.appendChild(info);
        group.appendChild(option);
      }
    }

    fieldset.appendChild(group);
    els.categoryContainer.appendChild(fieldset);
  }

  // ─── Selection State ───

  function setQuantity(item, qty) {
    if (qty <= 0) {
      delete selections[item._id];
    } else {
      selections[item._id] = { quantity: qty, item: item };
    }
    updateSummary();
  }

  // ─── Pricing Summary ───

  function updateSummary() {
    // Clear line items
    while (els.summaryLineItems.firstChild) {
      els.summaryLineItems.removeChild(els.summaryLineItems.firstChild);
    }

    var total = 0;
    var hasItems = false;

    var keys = Object.keys(selections);
    for (var i = 0; i < keys.length; i++) {
      var sel = selections[keys[i]];
      var lineTotal = sel.quantity * sel.item.price;
      total += lineTotal;
      hasItems = true;

      var line = document.createElement('div');
      line.className = 'summary-line-item';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'summary-item-name';
      nameSpan.textContent = sel.item.name;
      nameSpan.title = sel.item.name;

      var subtotalSpan = document.createElement('span');
      subtotalSpan.className = 'summary-item-subtotal';

      if (sel.quantity > 1) {
        subtotalSpan.textContent = sel.quantity + ' x $' + sel.item.price + ' = $' + lineTotal;
      } else {
        subtotalSpan.textContent = '$' + lineTotal;
      }

      line.appendChild(nameSpan);
      line.appendChild(subtotalSpan);
      els.summaryLineItems.appendChild(line);
    }

    if (!hasItems) {
      var empty = document.createElement('p');
      empty.className = 'summary-empty';
      empty.textContent = 'No items selected yet.';
      els.summaryLineItems.appendChild(empty);
    }

    var totalStr = '$' + total;
    els.summaryTotal.textContent = totalStr;
    els.mobileSummaryTotal.textContent = totalStr;

    // Update mobile overlay if it exists
    var overlayTotal = document.getElementById('mobileOverlayTotal');
    if (overlayTotal) {
      overlayTotal.textContent = totalStr;
    }
    updateMobileOverlayItems();
  }

  // ─── Reset ───

  function resetAll() {
    selections = {};

    // Reset number inputs
    var inputs = els.categoryContainer.querySelectorAll('input[type="number"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = '0';
    }

    // Reset checkboxes
    var checkboxes = els.categoryContainer.querySelectorAll('input[type="checkbox"]');
    for (var j = 0; j < checkboxes.length; j++) {
      checkboxes[j].checked = false;
    }

    // Reset radios
    var radios = els.categoryContainer.querySelectorAll('input[type="radio"]');
    for (var k = 0; k < radios.length; k++) {
      radios[k].checked = false;
    }

    // Remove visual selection from centralization
    var options = els.categoryContainer.querySelectorAll('.centralization-option');
    for (var l = 0; l < options.length; l++) {
      options[l].classList.remove('selected');
    }

    updateSummary();
    closeMobileOverlay();
  }

  // ─── Mobile Overlay ───

  function toggleMobileOverlay() {
    var overlay = document.getElementById('mobileOverlay');
    var backdrop = document.getElementById('mobileBackdrop');

    if (!overlay) {
      createMobileOverlay();
      overlay = document.getElementById('mobileOverlay');
      backdrop = document.getElementById('mobileBackdrop');
    }

    var isVisible = overlay.classList.contains('visible');
    if (isVisible) {
      closeMobileOverlay();
    } else {
      updateMobileOverlayItems();
      overlay.classList.add('visible');
      backdrop.classList.add('visible');
      els.mobileExpandBtn.classList.add('expanded');
    }
  }

  function closeMobileOverlay() {
    var overlay = document.getElementById('mobileOverlay');
    var backdrop = document.getElementById('mobileBackdrop');
    if (overlay) overlay.classList.remove('visible');
    if (backdrop) backdrop.classList.remove('visible');
    els.mobileExpandBtn.classList.remove('expanded');
  }

  function createMobileOverlay() {
    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.className = 'mobile-summary-backdrop';
    backdrop.id = 'mobileBackdrop';
    backdrop.addEventListener('click', closeMobileOverlay);

    // Overlay
    var overlay = document.createElement('div');
    overlay.className = 'mobile-summary-overlay';
    overlay.id = 'mobileOverlay';

    // Header
    var header = document.createElement('div');
    header.className = 'mobile-overlay-header';

    var h3 = document.createElement('h3');
    h3.textContent = 'Your Estimate';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'mobile-overlay-close';
    var closeIcon = document.createElement('i');
    closeIcon.className = 'fas fa-times';
    closeBtn.appendChild(closeIcon);
    closeBtn.addEventListener('click', closeMobileOverlay);

    header.appendChild(h3);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    // Line items container
    var itemsDiv = document.createElement('div');
    itemsDiv.id = 'mobileOverlayItems';
    overlay.appendChild(itemsDiv);

    // Divider
    var divider = document.createElement('div');
    divider.className = 'summary-divider';
    overlay.appendChild(divider);

    // Total row
    var totalRow = document.createElement('div');
    totalRow.className = 'summary-total-row';
    var totalLabel = document.createElement('span');
    totalLabel.textContent = 'Estimated Total';
    var totalValue = document.createElement('span');
    totalValue.className = 'font-mono summary-total-value';
    totalValue.id = 'mobileOverlayTotal';
    totalValue.textContent = '$0';
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalValue);
    overlay.appendChild(totalRow);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'mobile-overlay-actions';

    var lockBtn = document.createElement('a');
    lockBtn.href = '/quotes';
    lockBtn.className = 'btn-lock-it-in';
    lockBtn.textContent = 'Lock It In';

    var resetBtnMobile = document.createElement('button');
    resetBtnMobile.type = 'button';
    resetBtnMobile.className = 'btn-reset';
    resetBtnMobile.textContent = 'Reset';
    resetBtnMobile.addEventListener('click', resetAll);

    actions.appendChild(lockBtn);
    actions.appendChild(resetBtnMobile);
    overlay.appendChild(actions);

    document.body.appendChild(backdrop);
    document.body.appendChild(overlay);

    // Trigger reflow then show
    requestAnimationFrame(function () {
      overlay.classList.add('visible');
    });
  }

  function updateMobileOverlayItems() {
    var container = document.getElementById('mobileOverlayItems');
    if (!container) return;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    var keys = Object.keys(selections);
    if (keys.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'summary-empty';
      empty.textContent = 'No items selected yet.';
      container.appendChild(empty);
      return;
    }

    for (var i = 0; i < keys.length; i++) {
      var sel = selections[keys[i]];
      var lineTotal = sel.quantity * sel.item.price;

      var line = document.createElement('div');
      line.className = 'summary-line-item';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'summary-item-name';
      nameSpan.textContent = sel.item.name;

      var subtotalSpan = document.createElement('span');
      subtotalSpan.className = 'summary-item-subtotal';
      if (sel.quantity > 1) {
        subtotalSpan.textContent = sel.quantity + ' x $' + sel.item.price + ' = $' + lineTotal;
      } else {
        subtotalSpan.textContent = '$' + lineTotal;
      }

      line.appendChild(nameSpan);
      line.appendChild(subtotalSpan);
      container.appendChild(line);
    }

    var overlayTotal = document.getElementById('mobileOverlayTotal');
    if (overlayTotal) {
      var total = 0;
      for (var j = 0; j < keys.length; j++) {
        total += selections[keys[j]].quantity * selections[keys[j]].item.price;
      }
      overlayTotal.textContent = '$' + total;
    }
  }
})();
