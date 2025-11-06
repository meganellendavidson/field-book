// Global variables
let map;
let markedLocations = [];
let locationCounter = 1;
let isMarking = false; // Flag to prevent rapid clicking
let currentBasemap = 'linz'; // Track current basemap
let basemapLayers = {}; // Store basemap layers

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
});

// Initialize the Leaflet map
function initializeMap() {
    try {
        // Create map instance centered on Wellington, New Zealand (Land Information NZ context)
        map = L.map('map').setView([-41.2865, 174.7762], 13);

        // Create basemap layers
        basemapLayers.linz = L.tileLayer('https://basemaps.linz.govt.nz/v1/tiles/topo-raster/WebMercatorQuad/{z}/{x}/{y}.webp?api=c01k8vekfvpr3aj3qk196f70wya', {
            attribution: '© Land Information New Zealand',
            maxZoom: 19
        });

        basemapLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        basemapLayers.aerial = L.tileLayer('https://basemaps.linz.govt.nz/v1/tiles/aerial/WebMercatorQuad/{z}/{x}/{y}.webp?api=c01k8vekfvpr3aj3qk196f70wya', {
            attribution: '© Land Information New Zealand',
            maxZoom: 19
        });

        // Add default basemap (LINZ)
        basemapLayers[currentBasemap].addTo(map);

        // Add custom basemap switch control
        addBasemapSwitchControl();

        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError();
    }
}

// Add custom basemap switch control with icons
function addBasemapSwitchControl() {
    const BasemapControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'basemap-control leaflet-bar');

            // LINZ button
            const linzBtn = L.DomUtil.create('button', 'basemap-btn', container);
            linzBtn.innerHTML = '<img src="images/map-icon.svg" alt="LINZ Topo" class="basemap-icon">';
            linzBtn.title = 'LINZ Topo';
            if (currentBasemap === 'linz') linzBtn.classList.add('active');

            // OSM button
            const osmBtn = L.DomUtil.create('button', 'basemap-btn', container);
            osmBtn.innerHTML = '<img src="images/globe-icon.svg" alt="OpenStreetMap" class="basemap-icon">';
            osmBtn.title = 'OpenStreetMap';
            if (currentBasemap === 'osm') osmBtn.classList.add('active');

            // Aerial button
            const aerialBtn = L.DomUtil.create('button', 'basemap-btn', container);
            aerialBtn.innerHTML = '<img src="images/satellite-icon.svg" alt="LINZ Aerial" class="basemap-icon">';
            aerialBtn.title = 'LINZ Aerial';
            if (currentBasemap === 'aerial') aerialBtn.classList.add('active');

            // Event handlers
            L.DomEvent.on(linzBtn, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                switchBasemap('linz');
            });

            L.DomEvent.on(osmBtn, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                switchBasemap('osm');
            });

            L.DomEvent.on(aerialBtn, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                switchBasemap('aerial');
            });

            return container;
        }
    });

    new BasemapControl().addTo(map);
}

// Switch basemap function
function switchBasemap(newBasemap) {
    if (currentBasemap === newBasemap) return;

    // Remove current basemap
    map.removeLayer(basemapLayers[currentBasemap]);
    
    // Add new basemap
    map.addLayer(basemapLayers[newBasemap]);
    
    // Update current basemap
    currentBasemap = newBasemap;
    
    // Update button styles
    updateBasemapControlButtons();
}

// Update basemap control buttons to reflect current state
function updateBasemapControlButtons() {
    const linzBtn = document.querySelector('.basemap-control button[title="LINZ Topo"]');
    const osmBtn = document.querySelector('.basemap-control button[title="OpenStreetMap"]');
    const aerialBtn = document.querySelector('.basemap-control button[title="LINZ Aerial"]');
    
    // Reset all buttons
    [linzBtn, osmBtn, aerialBtn].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    
    // Highlight active button
    if (currentBasemap === 'linz' && linzBtn) {
        linzBtn.classList.add('active');
    } else if (currentBasemap === 'osm' && osmBtn) {
        osmBtn.classList.add('active');
    } else if (currentBasemap === 'aerial' && aerialBtn) {
        aerialBtn.classList.add('active');
    }
}

// Setup event listeners
function setupEventListeners() {
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToPDF);
    }
    
    const markBtn = document.getElementById('markBtn');
    if (markBtn) {
        markBtn.addEventListener('click', markCurrentLocation);
    }
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllMarkedLocations);
    }
}

// Export map to PDF
async function exportToPDF() {
    const exportBtn = document.getElementById('exportBtn');
    const mapContainer = document.getElementById('mapContainer');
    
    if (!mapContainer) {
        alert('Map container not found');
        return;
    }
    
    if (markedLocations.length === 0) {
        alert('Please mark at least one location before exporting.');
        return;
    }

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    try {
        // Disable button and show loading state
        exportBtn.disabled = true;
        const exportBtnImg = exportBtn.querySelector('img');
        if (exportBtnImg) {
            exportBtnImg.style.display = 'none';
        }
        exportBtn.innerHTML = '<span class="btn-text">📄 Generating PDF...</span>';

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // PDF dimensions
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 20;
        const availableWidth = pdfWidth - (margin * 2);
        const availableHeight = pdfHeight - (margin * 2);

        const timestamp = new Date().toLocaleString();
        let pageCount = 0;
        // Calculate total pages including blank pages
        const totalPages = markedLocations.reduce((total, location) => {
            return total + 1 + (location.includeBlankPage ? 1 : 0);
        }, 0);
        
        // Export each marked location at its saved zoom level
        for (let locationIndex = 0; locationIndex < markedLocations.length; locationIndex++) {
            const location = markedLocations[locationIndex];
            pageCount++;
            
            // Update button text to show progress
            const exportBtnText = exportBtn.querySelector('.btn-text');
            if (exportBtnText) {
                exportBtnText.textContent = `📄 ${pageCount}/${totalPages}`;
            }
            
            // Switch to the basemap that was active when this location was marked
            if (location.basemap && location.basemap !== currentBasemap) {
                map.removeLayer(basemapLayers[currentBasemap]);
                map.addLayer(basemapLayers[location.basemap]);
                currentBasemap = location.basemap;
            }
            
            // Set the map to the location and its saved zoom level
            map.setView([location.lat, location.lng], location.zoom);
            
            // Wait for the map to render
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Hide map controls during capture
            const zoomControl = document.querySelector('.leaflet-control-zoom');
            const basemapControl = document.querySelector('.basemap-control');
            const attributionControl = document.querySelector('.leaflet-control-attribution');
            
            if (zoomControl) zoomControl.style.display = 'none';
            if (basemapControl) basemapControl.style.setProperty('display', 'none', 'important');
            if (attributionControl) attributionControl.style.display = 'none';
            
            // Capture the map container as canvas
            const canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: true,
                scale: 2, // Higher quality
                logging: false,
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight
            });
            
            // Restore map controls after capture
            if (zoomControl) zoomControl.style.display = '';
            if (basemapControl) basemapControl.style.removeProperty('display');
            if (attributionControl) attributionControl.style.display = '';

            // Add new page for subsequent captures
            if (pageCount > 1) {
                pdf.addPage();
            }

            // Calculate scaling to fit the image with padding for border
            const borderWidth = 0.3; // Border thickness in mm
            const imageAvailableWidth = availableWidth - (borderWidth * 2);
            const imageAvailableHeight = availableHeight - (borderWidth * 2);
            
            const imageWidth = canvas.width;
            const imageHeight = canvas.height;
            const ratio = Math.min(imageAvailableWidth / (imageWidth / 72 * 25.4), imageAvailableHeight / (imageHeight / 72 * 25.4));
            
            const scaledWidth = (imageWidth / 72 * 25.4) * ratio;
            const scaledHeight = (imageHeight / 72 * 25.4) * ratio;

            // Center the image
            const x = (pdfWidth - scaledWidth) / 2;
            const y = (pdfHeight - scaledHeight) / 2;

            // Add border around the map
            pdf.setDrawColor(0,0,0); // Black border
            pdf.setLineWidth(borderWidth);
            // Draw border as a stroked rectangle (no fill)
            pdf.rect(x - borderWidth, y - borderWidth, scaledWidth + (borderWidth * 2), scaledHeight + (borderWidth * 2), 'S');

            // Add the map image
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);

            // Add location name using Times New Roman
            pdf.setFont('times', 'normal');
            pdf.setFontSize(16);
            pdf.setTextColor(41, 41, 41); // Dark color #3a3a3aff
            
            // Position the text at the top of the page, centered
            const textX = pdfWidth / 2;
            const textY = margin + 5; // 10mm from top margin
            
            // Add location name
            pdf.text(location.name.toUpperCase(), textX, textY, { align: 'center' });

            // Add coordinates in smaller text below the name
            pdf.setFontSize(10);
            pdf.setTextColor(90, 74, 58); // Brownish color #6d6d6dff
            const coordText = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
            pdf.text(coordText, textX, textY + 6, { align: 'center' });

            // Add blank page with grid/ruled lines if requested
            if (location.includeBlankPage) {
                pageCount++;
                const exportBtnText = exportBtn.querySelector('.btn-text');
                if (exportBtnText) {
                    exportBtnText.textContent = `📄 ${pageCount}/${totalPages}`;
                }
                pdf.addPage();
                addBlankPageLines(pdf, pdfWidth, pdfHeight, margin);
            }
        }

        // Restore original map view
        map.setView(currentCenter, currentZoom);
        
        // Update basemap control buttons to reflect current state
        updateBasemapControlButtons();

        // Save the PDF with location names
        const locationNames = markedLocations.map(loc => loc.name.replace(/[^a-zA-Z0-9\s]/g, '')).join('-');
        const filename = `field-maps-${locationNames}-${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);

        console.log('Multi-page PDF export completed successfully');
        
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        alert('Failed to export PDF. Please try again.');
        
        // Restore original view on error
        map.setView(currentCenter, currentZoom);
    } finally {
        // Re-enable button
        exportBtn.disabled = false;
        const exportBtnImg = exportBtn.querySelector('img');
        if (exportBtnImg) {
            exportBtnImg.style.display = '';
            exportBtn.innerHTML = '<img src="images/save-icon.svg" alt="Export PDF" class="btn-icon">';
        } else {
            exportBtn.innerHTML = '<img src="images/save-icon.svg" alt="Export PDF" class="btn-icon">';
        }
    }
}


// Add blank page with grid lines on left and ruled lines on right
function addBlankPageLines(pdf, pdfWidth, pdfHeight, margin) {
    const lineSpacing = 8;
    const gridSpacing = 5; // Smaller spacing for grid
    const startY = margin + 25;
    const endY = pdfHeight - margin - 10;
    const pageCenter = pdfWidth / 2;
    const leftSideEnd = pageCenter - 6; // Extend closer to center
    
    // Left side - Very faint dashed grid lines
    pdf.setLineWidth(0.05);
    pdf.setDrawColor(230, 230, 230); // Very light gray for grid
    pdf.setLineDashPattern([0.5, 0.5], 0); // Dashed pattern: 0.5mm line, 0.5mm gap
    
    // Horizontal grid lines (left side) - extend to complete the grid
    for (let y = startY; y <= endY; y += gridSpacing) {
        pdf.line(margin, y, leftSideEnd, y);
    }
    
    // Vertical grid lines (left side) - extend to complete the grid
    for (let x = margin; x <= leftSideEnd + 7; x += gridSpacing) {
        pdf.line(x, startY, x, endY);
    }
    
    // Reset dash pattern for solid lines
    pdf.setLineDashPattern([], 0);
    
    // Right side - Regular ruled lines
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(0, 0, 0); // Black for ruled lines
    
    // Horizontal ruled lines (right side)
    for (let y = startY; y <= endY; y += lineSpacing) {
        pdf.line(pageCenter + 5, y, pdfWidth - margin, y);
    }
    
    // Reset draw color to black for future elements
    pdf.setDrawColor(0, 0, 0);
}

// Get user-friendly basemap display name
function getBasemapDisplayName(basemapKey) {
    const basemapNames = {
        'linz': 'LINZ Topo',
        'osm': 'OpenStreetMap',
        'aerial': 'LINZ Aerial'
    };
    return basemapNames[basemapKey] || 'Unknown';
}

// Show error message if map fails to load
function showMapError() {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.innerHTML = '<div class="loading">Failed to load map. Please refresh the page.</div>';
    }
}

// Mark current location functionality
function markCurrentLocation() {
    // Prevent rapid clicking
    if (isMarking) return;
    
    const markBtn = document.getElementById('markBtn');
    
    // Set flag and disable button
    isMarking = true;
    markBtn.disabled = true;
    
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    const location = {
        id: Date.now(),
        name: `Location ${locationCounter}`,
        lat: center.lat,
        lng: center.lng,
        zoom: zoom,
        marker: null,
        includeBlankPage: false,
        basemap: currentBasemap // Remember which basemap was active
    };
    
    
    markedLocations.push(location);
    locationCounter++;
    
    updateMarkedLocationsList();
    
    // Show success feedback
    const markBtnImg = markBtn.querySelector('img');
    if (markBtnImg) {
        markBtnImg.src = 'images/check-icon.svg';
        markBtnImg.alt = 'Success';
    }
    markBtn.style.backgroundColor = '#9dbb65ff';
    markBtn.style.borderColor = '#9dbb65ff';
    
    setTimeout(() => {
        // Reset to original state
        if (markBtnImg) {
            markBtnImg.src = 'images/pin-icon.svg';
            markBtnImg.alt = 'Mark Location';
        }
        markBtn.style.backgroundColor = ' #b3b3b3';
        markBtn.style.borderColor = ' #b3b3b3';
        markBtn.disabled = false;
        isMarking = false;
    }, 1500);
}

function updateMarkedLocationsList() {
    const markedList = document.getElementById('markedList');
    
    if (markedLocations.length === 0) {
        markedList.innerHTML = '<p class="empty-state">No locations marked yet. Use the pin button above to add locations.</p>';
        return;
    }
    
    const listHTML = markedLocations.map(location => `
        <div class="marked-item" data-id="${location.id}" draggable="true">
            <div class="marked-item-header">
                <div class="marked-item-left">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="marked-item-name" onclick="editLocationName(${location.id})">${location.name}</span>
                </div>
                <div class="marked-item-controls">
                    <button class="goto-btn" onclick="goToLocation(${location.id})" title="Go to location">
                        <img src="images/target-icon.svg" alt="Go to location" class="btn-icon-small">
                    </button>
                    <button class="edit-btn" onclick="editLocationName(${location.id})" title="Edit name">
                        <img src="images/edit-icon.svg" alt="Edit name" class="btn-icon-small">
                    </button>
                    <button class="delete-btn" onclick="deleteLocation(${location.id})" title="Delete">
                        <img src="images/trash-icon.svg" alt="Delete" class="btn-icon-small">
                    </button>
                </div>
            </div>
            <div class="marked-item-coords">
                ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (Zoom: ${location.zoom})<br>
                Basemap: ${getBasemapDisplayName(location.basemap)}
            </div>
            <div class="marked-item-options">
                <label class="blank-page-option">
                    <input type="checkbox" ${location.includeBlankPage ? 'checked' : ''} 
                           onchange="toggleBlankPage(${location.id}, this.checked)">
                    <span>Include Field Notes</span>
                </label>
            </div>
        </div>
    `).join('');
    
    markedList.innerHTML = listHTML;
    setupDragAndDrop();
}

function toggleBlankPage(locationId, checked) {
    const location = markedLocations.find(loc => loc.id === locationId);
    if (location) {
        location.includeBlankPage = checked;
    }
}

function editLocationName(locationId) {
    const location = markedLocations.find(loc => loc.id === locationId);
    if (!location) return;
    
    const nameElement = document.querySelector(`[data-id="${locationId}"] .marked-item-name`);
    const editButton = document.querySelector(`[data-id="${locationId}"] .edit-btn`);
    const currentName = nameElement.textContent;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'marked-item-name editing';
    
    // Change edit button to save/tick icon
    const editBtnImg = editButton.querySelector('img');
    if (editBtnImg) {
        editBtnImg.src = 'images/check-icon.svg';
        editBtnImg.alt = 'Save changes';
    }
    editButton.title = 'Save changes';
    
    // Replace span with input
    nameElement.replaceWith(input);
    input.focus();
    input.select();
    
    // Handle save
    const saveName = () => {
        const newName = input.value.trim() || currentName;
        location.name = newName;
        
        // Update marker popup if marker exists
        if (location.marker) {
            location.marker.bindPopup(`<b>${newName}</b><br>Lat: ${location.lat.toFixed(6)}<br>Lng: ${location.lng.toFixed(6)}`);
        }
        
        // Restore edit button to pencil icon
        const editBtnImg = editButton.querySelector('img');
        if (editBtnImg) {
            editBtnImg.src = 'images/edit-icon.svg';
            editBtnImg.alt = 'Edit name';
        }
        editButton.title = 'Edit name';
        
        updateMarkedLocationsList();
    };
    
    // Handle cancel
    const cancelEdit = () => {
        // Restore edit button to pencil icon
        const editBtnImg = editButton.querySelector('img');
        if (editBtnImg) {
            editBtnImg.src = 'images/edit-icon.svg';
            editBtnImg.alt = 'Edit name';
        }
        editButton.title = 'Edit name';
        
        updateMarkedLocationsList();
    };
    
    input.addEventListener('blur', saveName);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveName();
        }
        if (e.key === 'Escape') {
            cancelEdit();
        }
    });
    
    // Make the edit button clickable to save
    editButton.onclick = (e) => {
        e.stopPropagation();
        saveName();
    };
}

function goToLocation(locationId) {
    const location = markedLocations.find(loc => loc.id === locationId);
    if (!location) return;
    
    map.setView([location.lat, location.lng], location.zoom);
    
    // Only try to open popup if marker exists
    if (location.marker) {
        location.marker.openPopup();
    }
}

function deleteLocation(locationId) {
    const locationIndex = markedLocations.findIndex(loc => loc.id === locationId);
    if (locationIndex === -1) return;
    
    const location = markedLocations[locationIndex];
    
    // Remove marker from map
    if (location.marker) {
        map.removeLayer(location.marker);
    }
    
    // Remove from array
    markedLocations.splice(locationIndex, 1);
    
    updateMarkedLocationsList();
}

function clearAllMarkedLocations() {
    if (markedLocations.length === 0) return;
    
    if (confirm('Are you sure you want to clear all marked locations?')) {
        // Remove all markers from map
        markedLocations.forEach(location => {
            if (location.marker) {
                map.removeLayer(location.marker);
            }
        });
        
        // Clear array
        markedLocations = [];
        locationCounter = 1;
        
        updateMarkedLocationsList();
    }
}

// Drag and drop functionality
function setupDragAndDrop() {
    const markedItems = document.querySelectorAll('.marked-item');
    let draggedElement = null;
    
    markedItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement !== this) {
        const draggedId = parseInt(draggedElement.getAttribute('data-id'));
        const targetId = parseInt(this.getAttribute('data-id'));
        
        // Find indices in the markedLocations array
        const draggedIndex = markedLocations.findIndex(loc => loc.id === draggedId);
        const targetIndex = markedLocations.findIndex(loc => loc.id === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Remove the dragged item and insert it at the target position
            const draggedItem = markedLocations.splice(draggedIndex, 1)[0];
            markedLocations.splice(targetIndex, 0, draggedItem);
            
            // Update the list
            updateMarkedLocationsList();
        }
    }
    
    return false;
}

function handleDragEnd(e) {
    // Clean up
    const items = document.querySelectorAll('.marked-item');
    items.forEach(item => {
        item.classList.remove('dragging', 'drag-over');
    });
    draggedElement = null;
}

// Handle window resize
window.addEventListener('resize', function() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
});