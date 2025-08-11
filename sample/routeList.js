// API Base URL - Update this to match your API server
let API_BASE_URL = 'https://work-tracker-lyart.vercel.app/api';
if (process.env.NODE_ENV !== 'production') {
    API_BASE_URL = 'https://work-tracker-git-main-norths-projects-bf6788e2.vercel.app/api';
  }

// Fetch routes from API
async function fetchRoutes() {
    try {
        console.log('Fetching from:', `${API_BASE_URL}/routes`);
        const response = await fetch(`${API_BASE_URL}/routes`);
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error text:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching routes:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error name:', error.name);
        throw error;
    }
}

// Render route card
function renderRouteCard(route) {
    // Handle undefined values with defaults
    const routeId = route._id || 'unknown';
    const workType = route.workType || t('common_unknown_work_type');
    const status = route.status || 'unknown';
    const scheduleStart = route.scheduleStart || route.timestamp;
    const scheduleEnd = route.scheduleEnd || route.timestamp;
    const actualStartTime = route.actualStartTime || route.timestamp;
    const actualEndTime = route.actualEndTime || route.timestamp;
    const description = route.description || '';
    const incomes = Array.isArray(route.incomes) ? route.incomes : [];
    const totalIncome = typeof route.totalIncome === 'number' ? route.totalIncome : 0;
    
    return `
        <div class="card" onclick="navigateToRoute('${routeId}')">
            <div class="card-header">
                <div class="work-type-container">
                    <i class="fas fa-briefcase" style="color: #2196F3;"></i>
                    <span class="work-type">${workType}</span>
                </div>
                <div class="status-badge ${getStatusColor(status)}">
                    ${status}
                </div>
            </div>
            
            <div class="card-content">
                <div class="schedule-container">
                    <i class="fas fa-calendar" style="color: #666; font-size: 16px;"></i>
                    <span class="schedule-text">${formatDate(scheduleStart, true)}&nbsp;${formatLocationTime(scheduleStart)} - ${formatLocationTime(scheduleEnd)}</span>
                </div>
                
                ${description ? `
                    <div class="description">${description}</div>
                ` : ''}
                
                <div class="income-container">
                <div class="income-item">
                    <div class="income-label">${t('routeList_total_income_label')}</div>
                    <div class="income-amount total-income">${formatCurrency(totalIncome)}</div>
                </div>

                ${Array.isArray(incomes) ? incomes.map(income => `
                    <div class="income-item">
                    <div class="income-label">${t('routeList_income_label', { source: income.source })}</div>
                    <div class="income-amount">${formatCurrency(income.amount)}</div>
                    </div>
                `).join('') : ''}                
                </div>
            </div>
            
            <div class="card-footer">
                <i class="fas fa-chevron-right" style="color: #666;"></i>
            </div>
        </div>
    `;
}

// Navigate to route details
function navigateToRoute(routeId) {
    window.location.href = `routeDetails.html?id=${routeId}`;
}

// Add new route (placeholder)
function addRoute() {
    alert(t('routeList_add_button'));
}

// Initialize the page
async function initializePage() {
    await loadLocale(currentLang);
    localizeHtml();
    
    const loadingContainer = document.getElementById('loadingContainer');
    const emptyState = document.getElementById('emptyState');
    const routeList = document.getElementById('routeList');
    
    try {
        const routes = await fetchRoutes();
        
        // Hide loading
        loadingContainer.style.display = 'none';
        
        if (routes.length === 0) {
            // Show empty state
            emptyState.style.display = 'flex';
        } else {
            // Render routes
            const routesHTML = routes.map(renderRouteCard).join('');
            routeList.innerHTML = routesHTML;
        }
    } catch (error) {
        // Hide loading and show error
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        loadingContainer.style.display = 'none';
        emptyState.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-3x" style="color: #f44336;"></i>
            <h2>${t('routeList_error_title')}</h2>
            <p>${t('routeList_error_message')}</p>
            <div style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px; text-align: left; max-height: 200px; overflow-y: auto;">
                <strong>${t('routeList_error_details_title')}</strong><br>
                ${t('routeList_error_details_message')} ${error.message}<br>
                ${error.stack ? `<br><strong>${t('routeList_error_details_stack')}</strong><br>${error.stack.replace(/\n/g, '<br>')}` : ''}
            </div>
        `;
        emptyState.style.display = 'flex';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializePage);