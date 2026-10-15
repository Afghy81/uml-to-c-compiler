// Enhanced app.js with test runner integration
// ... (keep all existing code from app.js) ...

// Add test runner functionality
function createTestRunner() {
    const testPanel = document.createElement('div');
    testPanel.id = 'testPanel';
    testPanel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #2d2d30;
        border: 1px solid #007acc;
        border-radius: 8px;
        padding: 20px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        display: none;
    `;
    
    testPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #fff; font-size: 18px;">🧪 Integration Tests</h2>
            <button id="closeTestPanel" style="background: transparent; border: none; color: #fff; cursor: pointer; font-size: 20px;">✕</button>
        </div>
        <div id="testResults" style="color: #d4d4d4; font-family: monospace; font-size: 13px; line-height: 1.6;"></div>
        <div style="margin-top: 20px; display: flex; gap: 10px;">
            <button id="runTests" class="btn btn-primary" style="flex: 1;">▶ Run All Tests</button>
            <button id="closeTests" class="btn btn-secondary" style="flex: 1;">Close</button>
        </div>
    `;
    
    document.body.appendChild(testPanel);
    
    // Event handlers
    document.getElementById('runTests').addEventListener('click', runIntegrationTests);
    document.getElementById('closeTestPanel').addEventListener('click', () => {
        testPanel.style.display = 'none';
    });
    document.getElementById('closeTests').addEventListener('click', () => {
        testPanel.style.display = 'none';
    });
    
    return testPanel;
}

function runIntegrationTests() {
    const resultsDiv = document.getElementById('testResults');
    resultsDiv.innerHTML = '<div style="color: #f9a825;">⏳ Running tests...</div>';
    
    setTimeout(() => {
        const tests = new CompilerTests();
        const results = tests.runAll();
        
        const passColor = '#4caf50';
        const failColor = '#f44336';
        const statusColor = results.failed === 0 ? passColor : failColor;
        
        let html = '<div style="margin-bottom: 20px;">';
        results.results.forEach(result => {
            const color = result.startsWith('✓') ? passColor : failColor;
            html += `<div style="color: ${color}; padding: 4px 0;">${result}</div>`;
        });
        html += '</div>';
        
        html += `
            <div style="border-top: 1px solid #3e3e42; padding-top: 15px; margin-top: 15px;">
                <div style="color: ${statusColor}; font-weight: bold; font-size: 16px; margin-bottom: 10px;">
                    ${results.failed === 0 ? '✓ All Tests Passed!' : '✗ Some Tests Failed'}
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; text-align: center;">
                        <div style="color: ${passColor}; font-size: 24px; font-weight: bold;">${results.passed}</div>
                        <div style="color: #858585; font-size: 12px;">Passed</div>
                    </div>
                    <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; text-align: center;">
                        <div style="color: ${failColor}; font-size: 24px; font-weight: bold;">${results.failed}</div>
                        <div style="color: #858585; font-size: 12px;">Failed</div>
                    </div>
                    <div style="background: #1e1e1e; padding: 10px; border-radius: 4px; text-align: center;">
                        <div style="color: #007acc; font-size: 24px; font-weight: bold;">${((results.passed / (results.passed + results.failed)) * 100).toFixed(0)}%</div>
                        <div style="color: #858585; font-size: 12px;">Success</div>
                    </div>
                </div>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
        
        // Update status bar
        setStatus(results.failed === 0 ? 'success' : 'error', 
                  `Tests: ${results.passed}/${results.passed + results.failed} passed`);
    }, 300);
}

// Add test button to header
function addTestButton() {
    const actions = document.querySelector('.actions');
    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn-secondary';
    testBtn.innerHTML = '🧪 Run Tests';
    testBtn.id = 'testBtn';
    testBtn.addEventListener('click', () => {
        const panel = document.getElementById('testPanel');
        panel.style.display = 'block';
    });
    actions.insertBefore(testBtn, actions.firstChild);
}

// Initialize test runner
window.addEventListener('DOMContentLoaded', () => {
    createTestRunner();
    addTestButton();
    
    // Auto-run tests if ?test=true in URL
    if (window.location.search.includes('test=true')) {
        setTimeout(() => {
            document.getElementById('testPanel').style.display = 'block';
            runIntegrationTests();
        }, 500);
    }
});

// Add keyboard shortcut for tests (Ctrl+T)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        document.getElementById('testPanel').style.display = 'block';
    }
});
