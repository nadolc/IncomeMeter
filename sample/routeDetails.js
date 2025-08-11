// API Base URL - Update this to match your API server
const API_BASE_URL = 'https://work-tracker-lyart.vercel.app/api';

// Get route ID from URL parameters
function getRouteId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Fetch route details from API
async function fetchRouteDetails(routeId) {
    try {
        console.log('Fetching route details from:', `${API_BASE_URL}/routes?id=${routeId}`);
        const response = await fetch(`${API_BASE_URL}/routes?id=${routeId}`);
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
        console.error('Error fetching route details:', error);
        console.error('Error type:', error.constructor.name);
        console.error('Error name:', error.name);
        throw error;
    }
}

// Render route overview card
function renderRouteOverview(route) {
    // Handle undefined values with defaults
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
        <div class="overview-card">
            <div class="card-header">
                <div class="work-type-container">
                    <i class="fas fa-briefcase" style="color: #2196F3; font-size: 24px;"></i>
                    <span class="work-type">${workType}</span>
                </div>
                <div class="status-badge ${getStatusColor(status)}">
                    ${status}
                </div>
            </div>
            <div class="schedule-container">
                <i class="fas fa-calendar" style="color: #666; font-size: 20px;"></i>
                <div class="schedule-details">
                    <span class="schedule-label">${t('routeDetails_date_label')}:</span>
                    <span class="schedule-text">${formatDate(scheduleStart, true)}</span>
                </div>
            </div>
            <div class="schedule-container">
                <i class="fas fa-calendar" style="color: #666; font-size: 20px;"></i>
                <div class="schedule-details">
                    <span class="schedule-label">${t('routeDetails_schedule_time_label')}:</span>
                    <span class="schedule-text">${formatLocationTime(scheduleStart)} - ${formatLocationTime(scheduleEnd)}</span>
                </div>
            </div>
            <div class="schedule-container">
                <i class="fas fa-calendar" style="color: #666; font-size: 20px;"></i>
                <div class="schedule-details">
                    <span class="schedule-label">${t('routeDetails_actual_time_label')}:</span>
                    <span class="schedule-text">${formatLocationTime(actualStartTime)} - ${formatLocationTime(actualEndTime)}</span>
                </div>
            </div>
            
            ${description ? `
                <div class="description-container">
                    <div class="description-label">${t('routeDetails_description_label')}</div>
                    <div class="description-text">${description}</div>
                </div>
            ` : ''}
            
            <div class="income-container">
                ${Array.isArray(incomes) ? incomes.map(income => `
                    <div class="income-item">
                    <div class="income-label">${t('routeDetails_income_label', { source: income.source })}</div>
                    <div class="income-amount">${formatCurrency(income.amount)}</div>
                    </div>
                `).join('') : ''}
                <div class="income-item">
                    <div class="income-label">${t('routeDetails_total_income_label')}</div>
                    <div class="income-amount total-income">${formatCurrency(totalIncome)}</div>
                </div>
            </div>
        </div>
    `;
}

// Render route information card
function renderRouteInfo(route) {
    // Handle undefined values with defaults
    const routeId = route._id || 'Unknown';
    const userId = route.userId || 'Unknown';
    const createdAt = route.createTS || new Date().toISOString();
    const updatedAt = route.amendTS || new Date().toISOString();
    
    
    return `
        <div class="info-card">
            <div class="section-title">${t('routeDetails_info_card_title')}</div>
            
            <div class="info-row">
                <span class="info-label">${t('routeDetails_id_label')}</span>
                <span class="info-value">${routeId}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">${t('routeDetails_user_id_label')}</span>
                <span class="info-value">${userId}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">${t('routeDetails_created_label')}</span>
                <span class="info-value">${formatDate(createdAt)}</span>
            </div>
            
            <div class="info-row">
                <span class="info-label">${t('routeDetails_updated_label')}</span>
                <span class="info-value">${formatDate(updatedAt)}</span>
            </div>
        </div>
    `;
}

// New helper function to format distance based on user settings
function formatDistance(distance, unit) {
    if (typeof distance !== 'number' || isNaN(distance)) {
        return 'N/A';
    }
    const displayUnit = t(`routeDetails_distance_unit_${unit}`);
    return `${distance.toFixed(2)} ${displayUnit}`;
}


// Render locations card
function renderLocationsCard(route) {
    const locations = route.locations || [];
    let extraStart = '';
    let extraEnd = '';
    // New odometer and distance-related variables
    const startOdometer = route.startMile || 0;
    const endOdometer = route.endMile || 0;
    const odometerDistance = endOdometer > startOdometer ? endOdometer - startOdometer : 0;

    // Calculate distance by summing distances between locations
    let locationsDistance = 0;
    if (locations.length > 1) {
        for (let i = 0; i < locations.length - 1; i++) {
            // Note: This is a simplified calculation.
            // A more accurate method would use a mapping API to get road distance.
            // For this example, we assume `location.distanceToNext` is available.
            locationsDistance += locations[i].distanceFromLastMi || 0;
        }
    }

    const distanceDifference = Math.abs(odometerDistance - locationsDistance);

    if (locations.length > 0) {
        extraStart = `
            <div class="location-item special-location">
                <div class="location-header">
                    <div class="location-number">🚗</div>
                    <div class="location-info">
                        <div class="location-time">${formatLocationTime(route.actualStartTime)}</div>
                    </div>
                         <div class="distance-item">
                        <span class="distance-label discrepancy-label">${t('routeDetails_start_mile_label') || 'End Mile'}:</span>
                        <span class="distance-value discrepancy-value">${formatDistance(startOdometer,'mi')}</span>
                    </div>
                </div>
            </div>
        `;
    

        extraEnd = `
            <div class="location-item special-location">
                <div class="location-header">
                    <div class="location-number">🏁</div>
                    <div class="location-info">
                        <div class="location-time">${formatLocationTime(route.actualEndTime)}</div>
                    </div>
                         <div class="distance-item">
                        <span class="distance-label discrepancy-label">${t('routeDetails_end_mile_label') || 'End Mile'}:</span>
                        <span class="distance-value discrepancy-value">${formatDistance(endOdometer,'mi')}</span>
                    </div>
                         <!--<div class="distance-item">
                        <span class="distance-label discrepancy-label">${t('routeDetails_distance_difference_label')}:</span>
                        <span class="distance-value discrepancy-value">${formatDistance(distanceDifference, 'mi')}</span>
                    </div>-->
                </div>
            </div>
        `;        
    }

    return `
        <div class="locations-card">
            <div class="locations-header">
                <div class="section-title">${t('routeDetails_locations_card_title')}</div>
                <div class="location-count">${t('routeDetails_locations_count', { count: locations.length })}</div>
            </div>
            
            ${locations.length > 0 ? 
                extraStart +
                locations.map((location, index) => {
                    // Handle undefined location values
                    const timestamp = location.timestamp || new Date().toISOString();
                    const latitude = typeof location.latitude === 'string' ? location.latitude : 0;
                    const longitude = typeof location.longitude === 'string' ? location.longitude : 0;
                    const address = typeof location.address === 'string' ? location.address : latitude + ',' + longitude;
                    const accuracy = typeof location.accuracy === 'number' ? location.accuracy : null;
                    const speed = typeof location.speed === 'number' ? location.speed : null;
                    const distance = typeof location.distanceFromLastMi === 'number' ? location.distanceFromLastMi : 0;
                    
                    return `
                        <div class="location-item">
                            <div class="location-header">
                                <div class="location-number">${index + 1}</div>
                                <div class="location-info">
                                    <div class="location-time">${formatLocationTime(timestamp)}</div>
                                    <div class="location-coords">${address}</div>
                                </div>
                                    <i class="fas fa-map-marker-alt" style="color: #2196F3;"></i>
                                    <div class="location-coords" style="padding-left:5px;">${distance.toFixed(2)}mi</div>
                            </div>
                            
                            ${(accuracy !== null || speed !== null) ? `
                                <div class="location-details">
                                    ${accuracy !== null ? `
                                        <div class="location-detail">Accuracy: ${accuracy.toFixed(1)}m</div>
                                    ` : ''}
                                    ${speed !== null ? `
                                        <div class="location-detail">Speed: ${speed.toFixed(1)} m/s</div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('') + extraEnd : 
                `
                <div class="empty-locations">
                    <i class="fas fa-map-marker-alt"></i>
                    <div class="empty-locations-text">${t('routeDetails_no_locations')}</div>
                </div>
                `
            }
        </div>
    `;
}

// Go back to route list
function goBack() {
    window.location.href = 'routeList.html';
}

// Initialize the page
async function initializePage() {
    await loadLocale(currentLang);
    localizeHtml();
    
    const loadingContainer = document.getElementById('loadingContainer');
    const errorContainer = document.getElementById('errorContainer');
    const content = document.getElementById('content');
    
    const routeId = getRouteId();
    
    if (!routeId) {
        // Show error if no route ID
        loadingContainer.style.display = 'none';
        errorContainer.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-3x" style="color: #f44336;"></i>
            <h2>${t('routeDetails_invalid_route_title')}</h2>
            <p>${t('routeDetails_invalid_route_message')}</p>
        `;
        errorContainer.style.display = 'flex';
        return;
    }
    
    try {
        const routeDetails = await fetchRouteDetails(routeId);
        
        // Hide loading
        loadingContainer.style.display = 'none';
        
        if (!routeDetails) {
            // Show error if route not found
            errorContainer.style.display = 'flex';
        } else {
            // Render route details
            const contentHTML = `
                ${renderRouteOverview(routeDetails)}
                ${renderRouteInfo(routeDetails)}
                ${renderLocationsCard(routeDetails)}
            `;
            content.innerHTML = contentHTML;
            content.style.display = 'block';
        }
    } catch (error) {
        // Hide loading and show error
        console.error('Full error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        loadingContainer.style.display = 'none';
        errorContainer.innerHTML = `
            <i class="fas fa-exclamation-triangle fa-3x" style="color: #f44336;"></i>
            <h2>${t('routeDetails_error_title')}</h2>
            <p>${t('routeDetails_error_message')}</p>
            <div style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px; text-align: left; max-height: 200px; overflow-y: auto;">
                <strong>${t('routeList_error_details_title')}</strong><br>
                ${t('routeList_error_details_message')} ${error.message}<br>
                ${error.stack ? `<br><strong>${t('routeList_error_details_stack')}</strong><br>${error.stack.replace(/\n/g, '<br>')}` : ''}
            </div>
        `;
        errorContainer.style.display = 'flex';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializePage);