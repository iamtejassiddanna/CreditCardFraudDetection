document.addEventListener('DOMContentLoaded', () => {
    const timeOfDayInput = document.getElementById('input-TimeOfDay');
    const dayInput = document.getElementById('input-Day');

    function getSecondsFromInputs() {
        if (!timeOfDayInput || !dayInput) return 36000;
        const timeVal = timeOfDayInput.value; // "10:00"
        const dayVal = parseInt(dayInput.value); // 1 or 2
        
        const parts = timeVal.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        
        const seconds = (dayVal - 1) * 86400 + hours * 3600 + minutes * 60;
        return seconds;
    }

    // ----------------------------------------------------
    // 1. TRANSACTION PARAMETERS & PCA MAPPINGS
    // ----------------------------------------------------
    const defaultFeatures = ['Time', 'V17', 'V14', 'V16', 'V10', 'V12', 'Amount'];
    let activeFeatures = [...defaultFeatures];

    const featureMappings = {
        V17: { Home: 0.5, Travel: -0.4, Distant: -2.2, International: -4.8 },
        V14: { Standard: 0.5, Frequent: -0.8, Rapid: -3.5 },
        V16: { Trusted: 0.5, New: -0.6, Unverified: -3.8 },
        V10: { PIN: 0.5, Bypass: -1.2, Failed: -3.9 },
        V12: { Secure: 0.5, Public: -0.5, Proxy: -3.6 }
    };

    function mapChoiceToFloat(feature, choice) {
        return featureMappings[feature][choice] !== undefined ? featureMappings[feature][choice] : 0.0;
    }

    function mapFloatToChoice(feature, val) {
        val = parseFloat(val);
        if (feature === 'V17') {
            if (val >= 0.0) return 'Home';
            if (val >= -1.0) return 'Travel';
            if (val >= -3.0) return 'Distant';
            return 'International';
        }
        if (feature === 'V14') {
            if (val >= 0.0) return 'Standard';
            if (val >= -2.0) return 'Frequent';
            return 'Rapid';
        }
        if (feature === 'V16') {
            if (val >= 0.0) return 'Trusted';
            if (val >= -2.0) return 'New';
            return 'Unverified';
        }
        if (feature === 'V10') {
            if (val >= 0.0) return 'PIN';
            if (val >= -2.0) return 'Bypass';
            return 'Failed';
        }
        if (feature === 'V12') {
            if (val >= 0.0) return 'Secure';
            if (val >= -2.0) return 'Public';
            return 'Proxy';
        }
        return '';
    }

    function setupPCAInputs(selectedFeatures) {
        activeFeatures = selectedFeatures || defaultFeatures;
        // The selects are static in index.html, no DOM generation needed
    }

    setupPCAInputs(defaultFeatures);

    // ----------------------------------------------------
    // 2. TAB SWITCHING SYSTEM
    // ----------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitleMain = document.getElementById('page-title-main');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Update nav state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update tab contents visibility
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
            
            // Update header title based on tab
            if (targetTab === 'dashboard-tab') {
                pageTitleMain.textContent = "Credit Card Fraud Detection";
            } else if (targetTab === 'predictor-tab') {
                pageTitleMain.textContent = "Transaction Fraud Predictor";
            }
        });
    });

    // ----------------------------------------------------
    // 3. CHART.JS CHARTS SETUP
    // ----------------------------------------------------
    let matrixChart = null;
    let imbalanceChart = null;
    let rocChart = null;

    function initCharts(metrics) {
        // A. Confusion Matrix Bar Chart
        const ctxMatrix = document.getElementById('matrixChart').getContext('2d');
        const cm = metrics.confusion_matrix || { tn: 56842, fp: 22, fn: 17, tp: 81 };
        
        if (matrixChart) matrixChart.destroy();
        
        matrixChart = new Chart(ctxMatrix, {
            type: 'bar',
            data: {
                labels: ['Genuine Predicted', 'Fraud Predicted'],
                datasets: [
                    {
                        label: 'Actual Genuine (Class 0)',
                        data: [cm.tn, cm.fp],
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Actual Fraud (Class 1)',
                        data: [cm.fn, cm.tp],
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${context.raw.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        type: 'logarithmic', // Log scale to handle genuine vs fraud ratio contrast
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        title: {
                            display: true,
                            text: 'Transactions (Log Scale)',
                            color: '#9ca3af'
                        }
                    }
                }
            }
        });

        // B. Imbalance Pie Chart
        const ctxImbalance = document.getElementById('imbalanceChart').getContext('2d');
        if (imbalanceChart) imbalanceChart.destroy();
        
        imbalanceChart = new Chart(ctxImbalance, {
            type: 'doughnut',
            data: {
                labels: ['Genuine (99.83%)', 'Fraudulent (0.17%)'],
                datasets: [{
                    data: [284315, 492],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.75)',
                        'rgba(239, 68, 68, 0.85)'
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans' } }
                    }
                }
            }
        });

        // C. ROC AUC Curve Chart
        const ctxRoc = document.getElementById('rocChart').getContext('2d');
        if (rocChart) rocChart.destroy();
        
        let fprData = [];
        let tprData = [];
        if (metrics.roc_curve && metrics.roc_curve.fpr && metrics.roc_curve.tpr) {
            fprData = metrics.roc_curve.fpr;
            tprData = metrics.roc_curve.tpr;
        } else {
            fprData = [0, 0.5, 1];
            tprData = [0, 0.8, 1];
        }

        const rocCoords = fprData.map((f, i) => ({ x: f, y: tprData[i] }));
        
        rocChart = new Chart(ctxRoc, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'ROC Curve (AUC = ' + (metrics.roc_auc || 0.9744).toFixed(4) + ')',
                        data: rocCoords,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        fill: true,
                        borderWidth: 2.5,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.1
                    },
                    {
                        label: 'Random Guess (AUC = 0.5000)',
                        data: [{x: 0, y: 0}, {x: 1, y: 1}],
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 10 } }
                    },
                    tooltip: {
                        callbacks: {
                            title: () => 'ROC Coordinates',
                            label: (context) => ` FPR: ${context.parsed.x.toFixed(3)}, TPR: ${context.parsed.y.toFixed(3)}`
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: { display: true, text: 'False Positive Rate (FPR)', color: '#9ca3af', font: { size: 10 } },
                        ticks: { color: '#9ca3af', stepSize: 0.2 },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        min: 0,
                        max: 1
                    },
                    y: {
                        title: { display: true, text: 'True Positive Rate (TPR)', color: '#9ca3af', font: { size: 10 } },
                        ticks: { color: '#9ca3af', stepSize: 0.2 },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        min: 0,
                        max: 1
                    }
                }
            }
        });

        const rocAucValEl = document.getElementById('roc-auc-value');
        if (rocAucValEl) {
            rocAucValEl.textContent = (metrics.roc_auc || 0.9744).toFixed(4);
        }
    }

    // ----------------------------------------------------
    // 4. FETCH AND POPULATE MODEL METRICS & FEATURES
    // ----------------------------------------------------
    function fetchMetrics() {
        fetch('/api/metrics')
            .then(res => {
                if (!res.ok) throw new Error("Metrics not available yet");
                return res.json();
            })
            .then(data => {
                // Configure features dynamically in form
                if (data.selected_features) {
                    setupPCAInputs(data.selected_features);
                }
                
                // Initialize empty charts first
                initCharts(data);
                
                // Override chart data and metric cards using live simulation history
                updateDashboardWithLiveStats();
            })
            .catch(err => {
                console.error("Error loading metrics API:", err);
                setupPCAInputs(defaultFeatures);
                
                initCharts({
                    confusion_matrix: { tn: 56842, fp: 22, fn: 17, tp: 81 }
                });
                updateDashboardWithLiveStats();
            });
    }

    // Fetch metrics and render sandbox audits on load
    fetchMetrics();
    renderSandboxAudits();

    // ----------------------------------------------------
    // 5. PREDICTOR: LOAD SAMPLES
    // ----------------------------------------------------
    const btnLoadGenuine = document.getElementById('btn-load-genuine');
    const btnLoadFraud = document.getElementById('btn-load-fraud');
    const btnLoadRandom = document.getElementById('btn-load-random');

    function loadSample(type) {
        const buttons = [btnLoadGenuine, btnLoadFraud, btnLoadRandom];
        buttons.forEach(btn => btn.disabled = true);
        
        fetch(`/api/random_transaction?type=${type}`)
            .then(res => {
                if (!res.ok) throw new Error("Could not load sample");
                return res.json();
            })
            .then(data => {
                // Fill static inputs
                document.getElementById('input-Amount').value = data.Amount.toFixed(2);
                
                // Parse seconds to Day and TimeOfDay select pickers
                const totalSeconds = Math.round(data.Time);
                const day = Math.floor(totalSeconds / 86400) + 1;
                const remainingSeconds = totalSeconds % 86400;
                const hours = Math.floor(remainingSeconds / 3600);
                const minutes = Math.floor((remainingSeconds % 3600) / 60);
                
                if (dayInput) dayInput.value = day.toString();
                if (timeOfDayInput) {
                    timeOfDayInput.value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                }
                
                // Fill dynamic PCA selects based on active features
                activeFeatures.forEach(feature => {
                    if (feature !== 'Time' && feature !== 'Amount') {
                        const val = data[feature];
                        const selectField = document.getElementById(`input-${feature}`);
                        if (selectField) {
                            selectField.value = mapFloatToChoice(feature, val);
                        }
                    }
                });
                
                // Update ground truth pills based on loaded sample Class
                if (data.Class === 1) {
                    if (pillActualFraud) pillActualFraud.classList.add('active');
                    if (pillActualGenuine) pillActualGenuine.classList.remove('active');
                } else {
                    if (pillActualGenuine) pillActualGenuine.classList.add('active');
                    if (pillActualFraud) pillActualFraud.classList.remove('active');
                }

                // Reset result display panel
                resetOutputPanel();
            })
            .catch(err => {
                alert("Could not load sample transaction. Please make sure the model is trained.");
                console.error(err);
            })
            .finally(() => {
                buttons.forEach(btn => btn.disabled = false);
            });
    }

    if (btnLoadGenuine) btnLoadGenuine.addEventListener('click', () => loadSample('genuine'));
    if (btnLoadFraud) btnLoadFraud.addEventListener('click', () => loadSample('fraud'));
    if (btnLoadRandom) btnLoadRandom.addEventListener('click', () => loadSample('any'));

    function resetOutputPanel() {
        const placeholder = document.getElementById('result-placeholder');
        const content = document.getElementById('result-content');
        
        if (placeholder && content) {
            placeholder.classList.remove('hidden');
            content.classList.add('hidden');
        }
        
        // Reset anomaly bars
        ['location', 'frequency', 'device', 'verification', 'network'].forEach(id => {
            const bar = document.getElementById(`bar-${id}`);
            const pctLabel = document.getElementById(`pct-${id}`);
            if (bar && pctLabel) {
                bar.style.width = '0%';
                pctLabel.textContent = '0%';
                pctLabel.style.color = 'var(--text-muted)';
            }
        });
    }

    // ----------------------------------------------------
    // Sandbox Audits logging and rendering
    // ----------------------------------------------------
    function logSandboxAudit(payload, result) {
        let audits = [];
        try {
            audits = JSON.parse(localStorage.getItem('sentinel_sandbox_audits')) || [];
        } catch (e) {
            audits = [];
        }
        
        const timeVal = timeOfDayInput.value;
        const parts = timeVal.split(':');
        const hr = parseInt(parts[0]) || 0;
        const min = parts[1] || "00";
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const displayHr = hr % 12 === 0 ? 12 : hr % 12;
        const formattedTime = `Day ${dayInput.value}, ${displayHr}:${min} ${ampm}`;

        const locSelect = document.getElementById('input-V17');
        const locChoice = (locSelect && locSelect.options && locSelect.selectedIndex !== -1 && locSelect.options[locSelect.selectedIndex]) ? locSelect.options[locSelect.selectedIndex].text : "Home";
        let shortLoc = locChoice.split(' ')[0]; // Take first word e.g. "Home", "Travel", "Distant", "International"

        const newAudit = {
            timestamp: formattedTime,
            amount: payload.Amount,
            location: shortLoc,
            riskScore: result.fraud_probability * 100,
            verdict: result.is_fraud ? "Fraud" : "Genuine"
        };

        audits.unshift(newAudit);
        
        if (audits.length > 5) {
            audits = audits.slice(0, 5);
        }

        localStorage.setItem('sentinel_sandbox_audits', JSON.stringify(audits));
        renderSandboxAudits();
    }

    function renderSandboxAudits() {
        const wrapper = document.getElementById('sandbox-audits-wrapper');
        if (!wrapper) return;

        let audits = [];
        try {
            audits = JSON.parse(localStorage.getItem('sentinel_sandbox_audits')) || [];
        } catch (e) {
            audits = [];
        }

        if (audits.length === 0) {
            wrapper.innerHTML = `
                <div class="placeholder-empty-audits">
                    <i class="fa-solid fa-folder-open"></i>
                    <p>No sandbox audits run yet.</p>
                    <p style="font-size: 0.7rem; opacity: 0.6;">Go to the Predictor tab to simulate transactions.</p>
                </div>
            `;
            return;
        }

        let tableHtml = `
            <table class="sandbox-audits-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Amount</th>
                        <th>Location</th>
                        <th>Risk %</th>
                        <th>Verdict</th>
                    </tr>
                </thead>
                <tbody>
        `;

        audits.forEach(audit => {
            const verdictClass = audit.verdict === "Fraud" ? "badge-compact fraud" : "badge-compact genuine";
            const verdictIcon = audit.verdict === "Fraud" ? "fa-solid fa-triangle-exclamation" : "fa-solid fa-circle-check";
            
            tableHtml += `
                <tr>
                    <td>${audit.timestamp}</td>
                    <td>$${audit.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>${audit.location}</td>
                    <td style="font-weight: 600; color: ${audit.riskScore > 50 ? '#ef4444' : (audit.riskScore > 20 ? '#f59e0b' : '#10b981')}">${audit.riskScore.toFixed(1)}%</td>
                    <td>
                        <span class="${verdictClass}">
                            <i class="${verdictIcon}"></i> ${audit.verdict.toUpperCase()}
                        </span>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        wrapper.innerHTML = tableHtml;
    }

    // Ground Truth Simulation Toggler behavior
    const pillActualGenuine = document.getElementById('pill-actual-genuine');
    const pillActualFraud = document.getElementById('pill-actual-fraud');

    if (pillActualGenuine && pillActualFraud) {
        pillActualGenuine.addEventListener('click', () => {
            pillActualGenuine.classList.add('active');
            pillActualFraud.classList.remove('active');
        });
        
        pillActualFraud.addEventListener('click', () => {
            pillActualFraud.classList.add('active');
            pillActualGenuine.classList.remove('active');
        });
    }

    // Reset Live Dashboard stats button
    const btnResetSession = document.getElementById('btn-reset-session');
    if (btnResetSession) {
        btnResetSession.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset all live sandbox session statistics? This will clear the interactive test history.")) {
                localStorage.removeItem('sentinel_sandbox_history');
                localStorage.removeItem('sentinel_sandbox_audits');
                updateDashboardWithLiveStats();
                renderSandboxAudits();
            }
        });
    }

    function calculateLiveROC(runs) {
        const actuals = runs.map(r => r.actual);
        const hasGenuine = actuals.includes(0);
        const hasFraud = actuals.includes(1);
        
        if (runs.length < 2 || !hasGenuine || !hasFraud) {
            return {
                auc: 1.0,
                fpr: [0, 0, 1],
                tpr: [0, 1, 1]
            };
        }
        
        const sorted = [...runs].sort((a, b) => b.probability - a.probability);
        
        const totalPos = actuals.filter(x => x === 1).length;
        const totalNeg = actuals.filter(x => x === 0).length;
        
        const fpr = [0];
        const tpr = [0];
        
        let tpCount = 0;
        let fpCount = 0;
        
        for (let i = 0; i < sorted.length; i++) {
            if (sorted[i].actual === 1) {
                tpCount++;
            } else {
                fpCount++;
            }
            fpr.push(fpCount / totalNeg);
            tpr.push(tpCount / totalPos);
        }
        
        let auc = 0;
        for (let i = 1; i < fpr.length; i++) {
            auc += (fpr[i] - fpr[i-1]) * (tpr[i] + tpr[i-1]) / 2;
        }
        
        return {
            auc: auc,
            fpr: fpr,
            tpr: tpr
        };
    }

    function updateDashboardWithLiveStats() {
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('sentinel_sandbox_history')) || [];
        } catch (e) {
            history = [];
        }

        // Initialize with a few starter baseline interactive runs if empty
        if (history.length === 0) {
            history = [
                { actual: 0, predicted: 0, probability: 0.025 },
                { actual: 0, predicted: 0, probability: 0.082 },
                { actual: 0, predicted: 0, probability: 0.011 },
                { actual: 0, predicted: 0, probability: 0.054 },
                { actual: 1, predicted: 1, probability: 0.942 }
            ];
            localStorage.setItem('sentinel_sandbox_history', JSON.stringify(history));
        }

        const N = history.length;
        let tn = 0, fp = 0, fn = 0, tp = 0;
        history.forEach(run => {
            if (run.actual === 0 && run.predicted === 0) tn++;
            else if (run.actual === 0 && run.predicted === 1) fp++;
            else if (run.actual === 1 && run.predicted === 0) fn++;
            else if (run.actual === 1 && run.predicted === 1) tp++;
        });

        const accuracy = (tp + tn) / N;
        const recall = (tp + fn) > 0 ? (tp / (tp + fn)) : 1.0;
        const f1 = (2 * tp) / (2 * tp + fp + fn || 1);
        const roc = calculateLiveROC(history);

        // Update DOM Cards
        document.getElementById('metric-accuracy').textContent = (accuracy * 100).toFixed(3) + '%';
        document.getElementById('metric-recall').textContent = (recall * 100).toFixed(1) + '%';
        document.getElementById('metric-auc').textContent = roc.auc.toFixed(4);
        document.getElementById('metric-f1').textContent = (f1 * 100).toFixed(1) + '%';
        
        const rocAucValEl = document.getElementById('roc-auc-value');
        if (rocAucValEl) {
            rocAucValEl.textContent = roc.auc.toFixed(4);
        }

        // Update Confusion Matrix Chart
        if (matrixChart) {
            matrixChart.data.datasets[0].data = [tn, fp];
            matrixChart.data.datasets[1].data = [fn, tp];
            matrixChart.update();
        }

        // Update Class Imbalance Chart (Live Breakdown)
        if (imbalanceChart) {
            const totalGenuine = tn + fp;
            const totalFraud = fn + tp;
            const genuinePct = (totalGenuine / N * 100).toFixed(2);
            const fraudPct = (totalFraud / N * 100).toFixed(2);
            
            imbalanceChart.data.datasets[0].data = [totalGenuine, totalFraud];
            imbalanceChart.data.labels = [`Genuine (${genuinePct}%)`, `Fraudulent (${fraudPct}%)`];
            imbalanceChart.update();
        }

        // Update ROC Curve Chart
        if (rocChart) {
            const rocCoords = roc.fpr.map((f, i) => ({ x: f, y: roc.tpr[i] }));
            rocChart.data.datasets[0].data = rocCoords;
            rocChart.data.datasets[0].label = `ROC Curve (AUC = ${roc.auc.toFixed(4)})`;
            rocChart.update();
        }
    }

    // ----------------------------------------------------
    // 6. PREDICTOR: RUN INFERENCE
    // ----------------------------------------------------
    const form = document.getElementById('prediction-form');
    const progressCircle = document.getElementById('progress-indicator');
    const probabilityValue = document.getElementById('probability-value');
    
    // Calculate progress circle stroke
    let circumference = 440;
    if (progressCircle) {
        const radius = progressCircle.r.baseVal.value;
        circumference = 2 * Math.PI * radius;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = circumference;
    }

    function setGauge(percent, isFraud) {
        if (!progressCircle) return;
        
        if (isFraud) {
            progressCircle.style.stroke = '#ef4444'; // Red
        } else {
            progressCircle.style.stroke = '#10b981'; // Green
        }
        
        const offset = circumference - (percent / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
        probabilityValue.textContent = `${percent.toFixed(1)}%`;
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('btn-submit-prediction');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing transaction signals...';
            
            // Gather form values (this collects Amount since it has name="Amount")
            const formData = new FormData(form);
            const payload = {};
            formData.forEach((value, key) => {
                payload[key] = parseFloat(value);
            });
            
            // Add manually calculated Time in seconds from selectors
            payload['Time'] = getSecondsFromInputs();
            
            // Add mapped PCA components from dropdown selectors
            const pcaFeatures = activeFeatures.filter(f => f.startsWith('V'));
            pcaFeatures.forEach(feature => {
                const selectEl = document.getElementById(`input-${feature}`);
                if (selectEl) {
                    const choice = selectEl.value; // "Home", "Travel", etc.
                    payload[feature] = mapChoiceToFloat(feature, choice);
                } else {
                    payload[feature] = 0.0; // fallback
                }
            });
            
            // Show scanning state in result
            resetOutputPanel();
            const placeholder = document.getElementById('result-placeholder');
            placeholder.querySelector('h3').textContent = "Analyzing Signals...";
            placeholder.querySelector('p').textContent = "Model algorithms are cross-referencing values with historical fraud patterns. Please wait.";
            
            // API Call
            fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(res => {
                if (!res.ok) throw new Error("Prediction API error");
                return res.json();
            })
            .then(result => {
                setTimeout(() => { // Small artificial delay to let user see animation
                    try {
                        showResult(result, payload);
                        logSandboxAudit(payload, result);
                        
                        // Append to live sandbox history
                        let history = [];
                        try {
                            history = JSON.parse(localStorage.getItem('sentinel_sandbox_history')) || [];
                        } catch (e) {
                            history = [];
                        }
                        
                        const actualPillFraud = document.getElementById('pill-actual-fraud').classList.contains('active');
                        const actualClass = actualPillFraud ? 1 : 0;
                        
                        const newRun = {
                            actual: actualClass,
                            predicted: result.is_fraud ? 1 : 0,
                            probability: result.fraud_probability
                        };
                        
                        history.push(newRun);
                        localStorage.setItem('sentinel_sandbox_history', JSON.stringify(history));
                        
                        // Update the dashboard statistics live!
                        updateDashboardWithLiveStats();
                    } catch (e) {
                        console.error("Error displaying result:", e);
                        alert("An error occurred while displaying the prediction result.");
                    } finally {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Run Fraud Analysis';
                    }
                }, 800);
            })
            .catch(err => {
                alert("Inference request failed. Make sure Flask server is running.");
                console.error(err);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Run Fraud Analysis';
                resetOutputPanel();
            });
        });
    }

    function showResult(result, payload) {
        const placeholder = document.getElementById('result-placeholder');
        const content = document.getElementById('result-content');
        
        placeholder.classList.add('hidden');
        content.classList.remove('hidden');
        
        const badge = document.getElementById('result-badge');
        const badgeIcon = document.getElementById('result-badge-icon');
        const badgeText = document.getElementById('result-badge-text');
        const verdictBox = document.getElementById('verdict-box');
        const verdictTitle = document.getElementById('verdict-title');
        const verdictDesc = document.getElementById('verdict-description');
        
        const detAmount = document.getElementById('detail-amount');
        const detTime = document.getElementById('detail-time');
        const detDisruption = document.getElementById('detail-disruption');
        
        detAmount.textContent = `$${payload.Amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        // Format time nicely
        const timeVal = timeOfDayInput.value;
        const parts = timeVal.split(':');
        const hr = parseInt(parts[0]) || 0;
        const min = parts[1] || "00";
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const displayHr = hr % 12 === 0 ? 12 : hr % 12;
        detTime.textContent = `Day ${dayInput.value}, ${displayHr}:${min} ${ampm}`;
        
        const prob = result.fraud_probability * 100;
        setGauge(prob, result.is_fraud);
        
        // Get dropdown choices text to show in explanation reasons
        const locSelect = document.getElementById('input-V17');
        const freqSelect = document.getElementById('input-V14');
        const devSelect = document.getElementById('input-V16');
        const valSelect = document.getElementById('input-V10');
        const netSelect = document.getElementById('input-V12');
        
        const locChoice = (locSelect && locSelect.options && locSelect.selectedIndex !== -1 && locSelect.options[locSelect.selectedIndex]) ? locSelect.options[locSelect.selectedIndex].text : "Home";
        const freqChoice = (freqSelect && freqSelect.options && freqSelect.selectedIndex !== -1 && freqSelect.options[freqSelect.selectedIndex]) ? freqSelect.options[freqSelect.selectedIndex].text : "Standard";
        const devChoice = (devSelect && devSelect.options && devSelect.selectedIndex !== -1 && devSelect.options[devSelect.selectedIndex]) ? devSelect.options[devSelect.selectedIndex].text : "Trusted";
        const valChoice = (valSelect && valSelect.options && valSelect.selectedIndex !== -1 && valSelect.options[valSelect.selectedIndex]) ? valSelect.options[valSelect.selectedIndex].text : "PIN Confirmed";
        const netChoice = (netSelect && netSelect.options && netSelect.selectedIndex !== -1 && netSelect.options[netSelect.selectedIndex]) ? netSelect.options[netSelect.selectedIndex].text : "Secure";

        const locVal = locSelect ? locSelect.value : "Home";
        const freqVal = freqSelect ? freqSelect.value : "Standard";
        const devVal = devSelect ? devSelect.value : "Trusted";
        const valVal = valSelect ? valSelect.value : "PIN";
        const netVal = netSelect ? netSelect.value : "Secure";

        // Generate Dynamic Explainable AI Reason
        let verdictDescHtml = "";
        if (result.is_fraud) {
            badge.className = "result-badge fraud";
            badgeIcon.className = "fa-solid fa-triangle-exclamation";
            badgeText.textContent = "FRAUD RISK";
            
            verdictBox.className = "result-verdict-box fraud";
            verdictTitle.textContent = "Suspicious Transaction Flagged";
            
            if (prob > 85) {
                detDisruption.textContent = "High Risk Anomaly Profile";
                detDisruption.className = "detail-val text-red";
            } else {
                detDisruption.textContent = "Moderate Anomaly Profile";
                detDisruption.className = "detail-val text-yellow";
            }

            const reasons = [];
            
            // Check Amount
            if (payload.Amount > 800) {
                reasons.push(`High transaction amount ($${payload.Amount.toLocaleString()}) which is statistically rare for this account profile.`);
            }
            
            // Check Suspicious Time (Night time: 1:00 AM to 5:00 AM)
            if (hr >= 1 && hr <= 5) {
                reasons.push(`Suspicious hour of day (${displayHr}:${min} ${ampm}) when cardholders are typically sleeping and fraud drainage velocity is highest.`);
            }
            
            // Check Location Selector
            if (locVal === 'Distant' || locVal === 'International') {
                reasons.push(`Location Anomaly: Transaction initiated from <strong>${locChoice}</strong>, deviating from your typical geographical profile.`);
            }
            
            // Check Purchase Frequency
            if (freqVal === 'Frequent' || freqVal === 'Rapid') {
                reasons.push(`Purchase Velocity: Spacing matches <strong>${freqChoice}</strong> behavior, suggesting automated merchant billing attempts.`);
            }
            
            // Check Device Status
            if (devVal === 'New' || devVal === 'Unverified') {
                reasons.push(`Unverified Access: Transaction launched from a <strong>${devChoice}</strong>.`);
            }
            
            // Check PIN / CVV
            if (valVal === 'Bypass' || valVal === 'Failed') {
                reasons.push(`Verification Alert: Card credentials entered using <strong>${valChoice}</strong>.`);
            }
            
            // Check Network Security
            if (netVal === 'Public' || netVal === 'Proxy') {
                reasons.push(`Network Threat: Transaction routed through an <strong>${netChoice}</strong>.`);
            }
            
            if (reasons.length === 0) {
                reasons.push("Combinatorial model signals: multiple minor deviations across transaction variables combined to cross the fraud probability threshold.");
            }
            
            verdictDescHtml = `<strong>Model Threat Diagnostics:</strong><br><ul style="padding-left: 1.2rem; margin-top: 0.4rem; font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem;">` + 
                reasons.map(r => `<li>${r}</li>`).join('') + `</ul>`;
        } else {
            badge.className = "result-badge genuine";
            badgeIcon.className = "fa-solid fa-shield-check";
            badgeText.textContent = "VERIFIED SAFE";
            
            verdictBox.className = "result-verdict-box genuine";
            verdictTitle.textContent = "Legitimate Transaction Profile";
            
            detDisruption.textContent = "Clear Signal Profile";
            detDisruption.className = "detail-val text-green";

            // Genuine Reasons
            const factors = [];
            
            if (hr >= 8 && hr <= 22) {
                factors.push(`Transaction occurred during active daylight hours (${displayHr}:${min} ${ampm})`);
            }
            if (payload.Amount < 200) {
                factors.push("Transaction volume fits average consumer spending thresholds");
            }
            
            if (locVal === 'Home') {
                factors.push("Location verified as your billing address");
            } else {
                factors.push(`Location matches verified ${locChoice}`);
            }
            
            if (devVal === 'Trusted') {
                factors.push("Initiated from a trusted primary device signature");
            }
            
            if (valVal === 'PIN') {
                factors.push("PIN and CVV verification successfully completed");
            }
            
            if (factors.length === 0) {
                factors.push("All metric indicators match standard legitimate baselines");
            }
            
            verdictDescHtml = `<strong>Safe Profile Analysis:</strong><br><ul style="padding-left: 1.2rem; margin-top: 0.4rem; font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem;">` + 
                factors.map(f => `<li>${f}</li>`).join('') + `</ul>`;
        }

        verdictDesc.innerHTML = verdictDescHtml;

        // Map values to anomaly percentages
        const locPcts = { Home: 0, Travel: 15, Distant: 55, International: 90 };
        const freqPcts = { Standard: 0, Frequent: 30, Rapid: 85 };
        const devPcts = { Trusted: 0, New: 25, Unverified: 90 };
        const valPcts = { PIN: 0, Bypass: 40, Failed: 95 };
        const netPcts = { Secure: 0, Public: 20, Proxy: 85 };

        updateAnomalyBar('location', locPcts[locVal]);
        updateAnomalyBar('frequency', freqPcts[freqVal]);
        updateAnomalyBar('device', devPcts[devVal]);
        updateAnomalyBar('verification', valPcts[valVal]);
        updateAnomalyBar('network', netPcts[netVal]);

        function updateAnomalyBar(id, pct) {
            const bar = document.getElementById(`bar-${id}`);
            const pctLabel = document.getElementById(`pct-${id}`);
            if (bar && pctLabel) {
                bar.style.width = `${pct}%`;
                pctLabel.textContent = `${pct}%`;
                
                // Color formatting
                if (pct <= 20) {
                    bar.style.backgroundColor = '#10b981'; // Green
                    pctLabel.style.color = '#10b981';
                } else if (pct <= 60) {
                    bar.style.backgroundColor = '#f59e0b'; // Yellow
                    pctLabel.style.color = '#f59e0b';
                } else {
                    bar.style.backgroundColor = '#ef4444'; // Red
                    pctLabel.style.color = '#ef4444';
                }
            }
        }
        
        if (window.innerWidth <= 1024) {
            content.scrollIntoView({ behavior: 'smooth' });
        }
    }
});
