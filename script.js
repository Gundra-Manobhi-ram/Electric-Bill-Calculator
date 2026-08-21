/**
 * ELECTRIC BILL CALCULATOR - ENGINE & STATE MANAGER
 * Built with strict boundary validation, dynamic tariff architecture,
 * mock OCR bill processing, and progressive slab calculation.
 */

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================================================
    // 1. CONFIGURABLE TARIFF TABLE STRUCTURE
    // ==========================================================================
    const TARIFF_CONFIG = {
        Domestic: {
            name: "Domestic (Residential)",
            slabs: [
                { limit: 30, rate: 1.90 },
                { limit: 45, rate: 3.00 },
                { limit: 50, rate: 4.50 },
                { limit: 100, rate: 6.00 },
                { limit: Infinity, rate: 8.75 }
            ]
        },
        A: {
            name: "Tariff A (Commercial Low-Load)",
            slabs: [
                { limit: 50, rate: 3.50 },
                { limit: 100, rate: 5.25 },
                { limit: Infinity, rate: 7.80 }
            ]
        },
        B: {
            name: "Tariff B (Industrial High-Load)",
            slabs: [
                { limit: 200, rate: 6.50 },
                { limit: Infinity, rate: 9.10 }
            ]
        }
    };

    // ==========================================================================
    // 2. GLOBAL APPLICATION STATE
    // ==========================================================================
    const state = {
        currentPage: 'landing', // landing, part1, part2, final
        part1: {
            prevReading: null,
            presReading: null,
            unitsConsumed: 0,
            tariffType: null,
            energyCharges: 0,
            slabBreakdown: []
        },
        part2: {
            activeMethod: 'upload', // 'upload' or 'manual'
            uploadedBills: [],      // Array of { id, name, totalAmount, energyCharges, otherCharges }
            manualEntries: [0],     // Array of number values
            avgOtherCharges: 0
        },
        finalBill: 0
    };

    // ==========================================================================
    // 3. DOM ELEMENT REFERENCES
    // ==========================================================================
    const pages = {
        landing: document.getElementById('page-landing'),
        part1: document.getElementById('page-part1'),
        part2: document.getElementById('page-part2'),
        final: document.getElementById('page-final')
    };

    const progressHeader = document.getElementById('progress-header');
    const errorToast = document.getElementById('error-toast');
    const errorMessageSpan = document.getElementById('error-message');

    // Part 1 Inputs
    const prevReadingInput = document.getElementById('prev-reading');
    const presReadingInput = document.getElementById('pres-reading');
    const displayUnits = document.getElementById('display-units');
    const tariffOptions = document.getElementById('tariff-options');
    const part1ResultBox = document.getElementById('part1-result-box');
    const displayPart1Charges = document.getElementById('display-part1-charges');
    const tariffBreakdown = document.getElementById('tariff-breakdown');
    const btnPart1Next = document.getElementById('btn-part1-next');

    // Part 2 Inputs
    const tabUpload = document.getElementById('tab-upload');
    const tabManual = document.getElementById('tab-manual');
    const methodUpload = document.getElementById('method-upload');
    const methodManual = document.getElementById('method-manual');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const fileListContainer = document.getElementById('file-list-container');
    const fileList = document.getElementById('file-list');
    const manualInputsList = document.getElementById('manual-inputs-list');
    const btnAddManual = document.getElementById('btn-add-manual');
    const displayPart2Charges = document.getElementById('display-part2-charges');
    const displayPart2Note = document.getElementById('display-part2-note');
    const btnPart2Next = document.getElementById('btn-part2-next');

    // Final Inputs
    const finalPart1 = document.getElementById('final-part1');
    const finalPart2 = document.getElementById('final-part2');
    const finalTotal = document.getElementById('final-total');

    // Navigation Buttons
    const btnStart = document.getElementById('btn-start');
    const btnPart2Back = document.getElementById('btn-part2-back');
    const btnFinalBack = document.getElementById('btn-final-back');
    const btnRestart = document.getElementById('btn-restart');

    // ==========================================================================
    // 4. UTILITY & VALIDATION FUNCTIONS
    // ==========================================================================

    /**
     * Shows error banner with standard strict requirement message: "Invalid input"
     */
    function showError() {
        errorMessageSpan.textContent = "Invalid input";
        errorToast.classList.remove('hidden');
    }

    function clearError() {
        errorToast.classList.add('hidden');
    }

    /**
     * Formats monetary values safely with symbol ₹ and 2 decimal places.
     */
    function formatCurrency(amount) {
        if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
            return "₹0.00";
        }
        return "₹" + amount.toFixed(2);
    }

    /**
     * Strict Non-Negative Numeric Validator
     */
    function isValidNonNegativeNumber(val) {
        if (val === "" || val === null || val === undefined) return false;
        const num = Number(val);
        return !isNaN(num) && isFinite(num) && num >= 0;
    }

    // ==========================================================================
    // 5. NAVIGATION ENGINE & STEP TRACKING
    // ==========================================================================
    function navigateTo(targetPage) {
        clearError();
        state.currentPage = targetPage;

        Object.keys(pages).forEach(p => {
            if (p === targetPage) {
                pages[p].classList.remove('hidden');
            } else {
                pages[p].classList.add('hidden');
            }
        });

        if (targetPage === 'landing') {
            progressHeader.classList.add('hidden');
        } else {
            progressHeader.classList.remove('hidden');
            updateProgressBadges(targetPage);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function updateProgressBadges(page) {
        const b1 = document.getElementById('step-badge-1');
        const b2 = document.getElementById('step-badge-2');
        const b3 = document.getElementById('step-badge-3');
        const l1 = document.getElementById('line-1');
        const l2 = document.getElementById('line-2');

        [b1, b2, b3].forEach(b => b.classList.remove('active', 'completed'));
        [l1, l2].forEach(l => l.classList.remove('active'));

        if (page === 'part1') {
            b1.classList.add('active');
        } else if (page === 'part2') {
            b1.classList.add('completed');
            l1.classList.add('active');
            b2.classList.add('active');
        } else if (page === 'final') {
            b1.classList.add('completed');
            b2.classList.add('completed');
            l1.classList.add('active');
            l2.classList.add('active');
            b3.classList.add('active');
        }
    }

    // ==========================================================================
    // 6. PART 1: PROGRESSIVE TARIFF CALCULATION ENGINE
    // ==========================================================================

    function calculatePart1() {
        clearError();
        const prevRaw = prevReadingInput.value.trim();
        const presRaw = presReadingInput.value.trim();

        // 1. Validate mandatory fields existence
        if (prevRaw === "" || presRaw === "") {
            displayUnits.textContent = "0";
            part1ResultBox.classList.add('hidden');
            btnPart1Next.disabled = true;
            return false;
        }

        // 2. Validate strict numeric types
        if (!isValidNonNegativeNumber(prevRaw) || !isValidNonNegativeNumber(presRaw)) {
            showError();
            displayUnits.textContent = "0";
            part1ResultBox.classList.add('hidden');
            btnPart1Next.disabled = true;
            return false;
        }

        const prev = parseFloat(prevRaw);
        const pres = parseFloat(presRaw);

        // 3. Validate logical boundary: Present reading >= Previous reading
        if (pres < prev) {
            showError();
            displayUnits.textContent = "0";
            part1ResultBox.classList.add('hidden');
            btnPart1Next.disabled = true;
            return false;
        }

        // Calculate Units Consumed (Boundary case Present == Previous -> Units = 0)
        const units = pres - prev;
        state.part1.prevReading = prev;
        state.part1.presReading = pres;
        state.part1.unitsConsumed = units;
        displayUnits.textContent = units.toString();

        // 4. Validate Tariff Selection
        const selectedTariffRadio = document.querySelector('input[name="tariff"]:checked');
        if (!selectedTariffRadio) {
            part1ResultBox.classList.add('hidden');
            btnPart1Next.disabled = true;
            return false;
        }

        const tariffType = selectedTariffRadio.value;
        if (!TARIFF_CONFIG[tariffType]) {
            showError();
            btnPart1Next.disabled = true;
            return false;
        }

        state.part1.tariffType = tariffType;

        // Progressive Slab Tariff Computation
        const config = TARIFF_CONFIG[tariffType];
        let remainingUnits = units;
        let totalEnergyCharge = 0;
        const breakdownLines = [];

        for (let i = 0; i < config.slabs.length; i++) {
            if (remainingUnits <= 0) break;

            const slab = config.slabs[i];
            const unitsInThisSlab = Math.min(remainingUnits, slab.limit);
            const costForThisSlab = unitsInThisSlab * slab.rate;

            totalEnergyCharge += costForThisSlab;
            remainingUnits -= unitsInThisSlab;

            const slabName = (i === 0) ? `First ${unitsInThisSlab}` :
                             (slab.limit === Infinity) ? `Remaining ${unitsInThisSlab}` :
                             `Next ${unitsInThisSlab}`;

            breakdownLines.push(`<div>${slabName} units × ₹${slab.rate.toFixed(2)} = ₹${costForThisSlab.toFixed(2)}</div>`);
        }

        state.part1.energyCharges = totalEnergyCharge;
        state.part1.slabBreakdown = breakdownLines;

        // Render Outputs
        displayPart1Charges.textContent = formatCurrency(totalEnergyCharge);
        tariffBreakdown.innerHTML = breakdownLines.join('');
        part1ResultBox.classList.remove('hidden');
        btnPart1Next.disabled = false;
        return true;
    }

    // Input Listeners for Part 1
    prevReadingInput.addEventListener('input', calculatePart1);
    presReadingInput.addEventListener('input', calculatePart1);
    tariffOptions.addEventListener('change', calculatePart1);

    btnPart1Next.addEventListener('click', () => {
        if (calculatePart1()) {
            navigateTo('part2');
            calculatePart2();
        } else {
            showError();
        }
    });

    // ==========================================================================
    // 7. PART 2: UPLOAD (OCR) & MANUAL AUDIT ENGINE
    // ==========================================================================

    // Tab Switcher Handler
    tabUpload.addEventListener('click', () => {
        tabUpload.classList.add('active');
        tabManual.classList.remove('active');
        methodUpload.classList.remove('hidden');
        methodManual.classList.add('hidden');
        state.part2.activeMethod = 'upload';
        calculatePart2();
    });

    tabManual.addEventListener('click', () => {
        tabManual.classList.add('active');
        tabUpload.classList.remove('active');
        methodManual.classList.remove('hidden');
        methodUpload.classList.add('hidden');
        state.part2.activeMethod = 'manual';
        calculatePart2();
    });

    // Dropzone Events
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileUploads(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileUploads(e.target.files);
        }
    });

    /**
     * Simulated OCR Engine - Parses Bill Amounts & Charges safely
     * Extracts values or rejects corrupted/invalid formats.
     */
    function handleFileUploads(files) {
        clearError();
        let hasError = false;

        Array.from(files).forEach((file, idx) => {
            // Validation: File format type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                hasError = true;
                return;
            }

            // Validation: Empty file check
            if (file.size === 0) {
                hasError = true;
                return;
            }

            // MOCK OCR PARSER SIMULATION:
            // Deterministically calculates total vs energy charge based on size/name hash
            // for demonstration, ensuring valid numeric math where Total >= Energy.
            const baseVal = 1000 + (file.name.length * 40) + (file.size % 200);
            const totalBill = baseVal + 200;
            const energyCharge = baseVal;
            const otherCharges = totalBill - energyCharge;

            // Strict Validation Guard on parsed OCR outputs
            if (!isValidNonNegativeNumber(totalBill) || 
                !isValidNonNegativeNumber(energyCharge) || 
                energyCharge > totalBill) {
                hasError = true;
                return;
            }

            state.part2.uploadedBills.push({
                id: Date.now() + '_' + idx,
                name: file.name,
                totalAmount: totalBill,
                energyCharges: energyCharge,
                otherCharges: otherCharges
            });
        });

        if (hasError) {
            showError();
        }

        renderUploadedFilesList();
        calculatePart2();
    }

    function renderUploadedFilesList() {
        fileList.innerHTML = '';
        if (state.part2.uploadedBills.length === 0) {
            fileListContainer.classList.add('hidden');
            return;
        }

        fileListContainer.classList.remove('hidden');
        state.part2.uploadedBills.forEach(bill => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-item-info">
                    <i class="fa-solid fa-file-image"></i>
                    <div>
                        <div class="file-name">${escapeHtml(bill.name)}</div>
                        <div style="font-size: 0.72rem; color: var(--text-dim);">Total: ₹${bill.totalAmount.toFixed(2)} | Energy: ₹${bill.energyCharges.toFixed(2)}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="file-charge">+${formatCurrency(bill.otherCharges)}</span>
                    <button type="button" class="btn-remove-file" data-id="${bill.id}">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
            fileList.appendChild(item);
        });

        // Attach Delete Listeners
        fileList.querySelectorAll('.btn-remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                state.part2.uploadedBills = state.part2.uploadedBills.filter(b => b.id !== id);
                renderUploadedFilesList();
                calculatePart2();
            });
        });
    }

    // MANUAL ENTRY ENGINE
    function renderManualInputs() {
        manualInputsList.innerHTML = '';
        state.part2.manualEntries.forEach((val, idx) => {
            const row = document.createElement('div');
            row.className = 'manual-row';
            row.innerHTML = `
                <div class="input-wrapper">
                    <i class="fa-solid fa-indian-rupee-sign input-icon"></i>
                    <input type="number" class="manual-val-input" data-idx="${idx}" placeholder="Enter Taxes & Other Charges" value="${val !== null && val !== undefined ? val : ''}" min="0" step="any">
                </div>
                ${state.part2.manualEntries.length > 1 ? `
                    <button type="button" class="btn-remove-row" data-idx="${idx}">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                ` : ''}
            `;
            manualInputsList.appendChild(row);
        });

        // Listeners for Manual Inputs
        manualInputsList.querySelectorAll('.manual-val-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.getAttribute('data-idx'));
                const val = e.target.value.trim();
                state.part2.manualEntries[idx] = val;
                calculatePart2();
            });
        });

        manualInputsList.querySelectorAll('.btn-remove-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                state.part2.manualEntries.splice(idx, 1);
                renderManualInputs();
                calculatePart2();
            });
        });
    }

    btnAddManual.addEventListener('click', () => {
        state.part2.manualEntries.push('');
        renderManualInputs();
        calculatePart2();
    });

    /**
     * Calculates Part 2 Average with Strict Validation Rules
     */
    function calculatePart2() {
        clearError();
        let validAmounts = [];

        if (state.part2.activeMethod === 'upload') {
            if (state.part2.uploadedBills.length === 0) {
                displayPart2Charges.textContent = "₹0.00";
                displayPart2Note.textContent = "Please upload at least one valid previous bill.";
                btnPart2Next.disabled = true;
                return false;
            }

            for (const bill of state.part2.uploadedBills) {
                if (!isValidNonNegativeNumber(bill.otherCharges)) {
                    showError();
                    btnPart2Next.disabled = true;
                    return false;
                }
                validAmounts.push(bill.otherCharges);
            }
        } else {
            // Manual Method Validation
            if (state.part2.manualEntries.length === 0) {
                showError();
                btnPart2Next.disabled = true;
                return false;
            }

            for (const rawVal of state.part2.manualEntries) {
                const strVal = String(rawVal).trim();
                if (strVal === "" || !isValidNonNegativeNumber(strVal)) {
                    showError();
                    btnPart2Next.disabled = true;
                    return false;
                }
                validAmounts.push(parseFloat(strVal));
            }
        }

        if (validAmounts.length === 0) {
            showError();
            btnPart2Next.disabled = true;
            return false;
        }

        // Calculate Average
        const sum = validAmounts.reduce((acc, curr) => acc + curr, 0);
        const avg = sum / validAmounts.length;

        if (isNaN(avg) || !isFinite(avg) || avg < 0) {
            showError();
            btnPart2Next.disabled = true;
            return false;
        }

        state.part2.avgOtherCharges = avg;
        displayPart2Charges.textContent = formatCurrency(avg);
        displayPart2Note.textContent = `Calculated average across ${validAmounts.length} valid previous bill entry(ies).`;
        btnPart2Next.disabled = false;
        return true;
    }

    btnPart2Back.addEventListener('click', () => navigateTo('part1'));
    btnPart2Next.addEventListener('click', () => {
        if (calculatePart2()) {
            calculateFinal();
            navigateTo('final');
        } else {
            showError();
        }
    });

    // ==========================================================================
    // 8. FINAL PAGE: ESTIMATION CONSOLIDATION
    // ==========================================================================
    function calculateFinal() {
        const p1 = state.part1.energyCharges;
        const p2 = state.part2.avgOtherCharges;
        const total = p1 + p2;

        state.finalBill = total;

        finalPart1.textContent = formatCurrency(p1);
        finalPart2.textContent = formatCurrency(p2);
        finalTotal.textContent = formatCurrency(total);
    }

    btnFinalBack.addEventListener('click', () => navigateTo('part2'));
    btnRestart.addEventListener('click', () => {
        // Reset state
        state.part1 = { prevReading: null, presReading: null, unitsConsumed: 0, tariffType: null, energyCharges: 0, slabBreakdown: [] };
        state.part2 = { activeMethod: 'upload', uploadedBills: [], manualEntries: [''], avgOtherCharges: 0 };
        state.finalBill = 0;

        prevReadingInput.value = '';
        presReadingInput.value = '';
        document.querySelectorAll('input[name="tariff"]').forEach(r => r.checked = false);
        displayUnits.textContent = '0';
        part1ResultBox.classList.add('hidden');
        btnPart1Next.disabled = true;

        renderUploadedFilesList();
        renderManualInputs();

        navigateTo('landing');
    });

    // Landing START Trigger
    btnStart.addEventListener('click', () => {
        renderManualInputs();
        navigateTo('part1');
    });

    // Utility XSS Prevention helper
    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});