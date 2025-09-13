document.addEventListener('DOMContentLoaded', () => {
  let map, marker;
  let formData = {};

  // Create background particles
  function createParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle');
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.width = Math.random() * 4 + 2 + 'px';
      particle.style.height = particle.style.width;
      particle.style.animationDuration = Math.random() * 3 + 3 + 's';
      particle.style.animationDelay = Math.random() * 2 + 's';
      particlesContainer.appendChild(particle);
    }
  }

  // Initialize particles
  createParticles();

  // Debounce utility to limit API calls and prevent rate-limiting errors.
  function debounce(func, delay) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  }

  // Initialize MapLibre GL JS
  try {
    // IMPORTANT: Replace with your own free API key from https://www.maptiler.com/
    const MAPTILER_API_KEY = 'mUiASIDIGsImfNM8L0hq';

    const streetsStyle = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`;
    const satelliteStyle = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_API_KEY}`;
    let currentStyle = satelliteStyle; // The initial style

    if (!MAPTILER_API_KEY || MAPTILER_API_KEY === 'YOUR_MAPTILER_API_KEY') {
      const mapContainer = document.getElementById('map');
      mapContainer.innerHTML = '<div class="h-full w-full flex items-center justify-center bg-gray-800 text-gray-400 p-4 text-center rounded-lg">To display the map, please get a free API key from MapTiler.com</div>';
      // Disable map-dependent features if map fails to load
      document.getElementById('geolocation').disabled = true;
      return; // Stop map initialization
    }

    map = new maplibregl.Map({
      container: 'map',
      style: satelliteStyle,
      center: [78.9629, 20.5937], // India center
      zoom: 5,
      pitch: 0 // Start flat
    });

    map.on('load', () => {
      // This event fires on initial load and after every `setStyle` call.
      // We must re-add any custom layers here.

      // Determine building color based on the current style to ensure visibility.
      const isSatellite = currentStyle === satelliteStyle;
      const buildingColor = isSatellite ? '#ffffff' : '#aaaaaa';
      const buildingOpacity = isSatellite ? 0.7 : 0.6;

      // Add 3D buildings layer. We wrap this in a try/catch because on style change,
      // there can be a race condition. `addLayer` is the safest way to proceed.
      try {
        if (!map.getLayer('3d-buildings')) {
          map.addLayer({
            'id': '3d-buildings',
            'source': 'openmaptiles',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': buildingColor,
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': buildingOpacity
            }
          });
        }
      } catch (e) {
        console.error('Could not add 3D building layer:', e);
      }
    });

    map.on('error', (e) => {
      console.error('Map error:', e);
    });
  } catch (error) {
    console.error('Map initialization failed:', error);
  }

  // Add marker
  marker = new maplibregl.Marker({ draggable: true })
    .setLngLat([78.9629, 20.5937])
    .addTo(map);

  // Populate state dropdown with a comprehensive list of Indian states and UTs
  const stateSelect = document.getElementById('state');
  const indianStates = [
    'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 
    'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 
    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 
    'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 
    'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];
  
  indianStates.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });

  // Map click for pinpointing
  map.on('click', (e) => {
    marker.setLngLat(e.lngLat);
    updateTo3DView(e.lngLat);
    updateFromMarker(e.lngLat);
  });

  // Marker dragend
  marker.on('dragend', () => {
    const lngLat = marker.getLngLat();
    updateTo3DView(lngLat);
    updateFromMarker(lngLat);
  });

  // Switch to 3D view
  function updateTo3DView(lngLat) {
    map.flyTo({
      center: [lngLat.lng, lngLat.lat],
      zoom: 18,
      pitch: 60,
      bearing: 90
    });
  }

  // Reverse geocoding for marker using MapTiler API
  async function updateFromMarker(lngLat) {
    const lat = lngLat.lat.toFixed(5);
    const lng = lngLat.lng.toFixed(5);
    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lng;
    document.getElementById('coords').textContent = `Latitude: ${lat}, Longitude: ${lng}`;
    
    try {
      const MAPTILER_API_KEY = 'mUiASIDIGsImfNM8L0hq';
      const response = await fetch(`https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_API_KEY}`);
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const topResult = data.features[0];
        // Use place_name for the main address field for a full, readable address
        document.getElementById('address').value = topResult.place_name;
        // Extract components from the 'context' array
        const pincode = topResult.context?.find(c => c.id.startsWith('postcode'))?.text || '';
        const district = topResult.context?.find(c => c.id.startsWith('district'))?.text || '';
        const city = topResult.context?.find(c => c.id.startsWith('place'))?.text || '';
        const state = topResult.context?.find(c => c.id.startsWith('region'))?.text || '';
        
        document.getElementById('pincode').value = pincode;
        document.getElementById('state').value = state; // This will select the option in the dropdown
        document.getElementById('district').value = district;
        document.getElementById('town').value = city;
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  }

  // Create a debounced version of the reverse geocoding function.
  const debouncedUpdateFromMarker = debounce(updateFromMarker, 500);

  // Update marker from inputs
  document.getElementById('latitude').addEventListener('input', updateMarkerFromInputs);
  document.getElementById('longitude').addEventListener('input', updateMarkerFromInputs);

  function updateMarkerFromInputs() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      const lngLat = { lng, lat };
      marker.setLngLat(lngLat);
      document.getElementById('coords').textContent = `Latitude: ${lat.toFixed(5)}, Longitude: ${lng.toFixed(5)}`;
      // Use the debounced function to avoid excessive API calls while typing.
      debouncedUpdateFromMarker(lngLat);
    }
  }

  // Geolocation button
  document.getElementById('geolocation').addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lngLat = { lng: position.coords.longitude, lat: position.coords.latitude };
          marker.setLngLat(lngLat);
          updateTo3DView(lngLat);
          updateFromMarker(lngLat);
        },
        () => {
          alert('Geolocation not available or permission denied.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });

  // Debounced forward geocoding function for address search
  const debouncedAddressSearch = debounce(async (input) => {
    const suggestionsDiv = document.getElementById('suggestions');
    if (input.length < 3) {
      suggestionsDiv.classList.add('hidden');
      return;
    }

    try {
      const MAPTILER_API_KEY = 'mUiASIDIGsImfNM8L0hq';
      const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(input)}.json?key=${MAPTILER_API_KEY}&country=IN&types=address,street,place,postcode,region,district&limit=5`);
      const data = await response.json();

      suggestionsDiv.innerHTML = ''; // Clear previous suggestions
      if (data.features && data.features.length > 0) {
        suggestionsDiv.classList.remove('hidden');
        data.features.forEach(place => {
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.textContent = place.place_name;
          div.onclick = () => {
            const [lng, lat] = place.center;
            marker.setLngLat({ lng, lat });
            updateTo3DView({ lng, lat });
            updateFromMarker({ lng, lat });
            suggestionsDiv.classList.add('hidden');
          };
          suggestionsDiv.appendChild(div);
        });
      } else {
        suggestionsDiv.classList.add('hidden');
      }
    } catch (error) {
      console.error('Address search failed:', error);
    }
  }, 300);

  // Attach debounced search to the address input
  document.getElementById('address').addEventListener('input', (e) => {
    debouncedAddressSearch(e.target.value);
  });

  // Hide suggestions on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
      document.getElementById('suggestions').classList.add('hidden');
    }
  });

  // Map style toggle functionality
  const viewToggle = document.getElementById('view-toggle');
  const streetsLabel = document.querySelector('#map-style-toggle span:first-of-type');
  const satelliteLabel = document.querySelector('#map-style-toggle span:last-of-type');

  viewToggle.addEventListener('change', (e) => {
    const isSatelliteView = e.target.checked;
    const newStyle = isSatelliteView ? satelliteStyle : streetsStyle;
    
    if (currentStyle !== newStyle) {
        currentStyle = newStyle;
        map.setStyle(newStyle);
    }

    // Update label styles to indicate the active view
    satelliteLabel.classList.toggle('text-white', isSatelliteView);
    satelliteLabel.classList.toggle('font-semibold', isSatelliteView);
    satelliteLabel.classList.toggle('text-gray-300', !isSatelliteView);
    streetsLabel.classList.toggle('text-white', !isSatelliteView);
    streetsLabel.classList.toggle('font-semibold', !isSatelliteView);
    streetsLabel.classList.toggle('text-gray-300', isSatelliteView);
  });

  // Radio button functionality
  document.querySelectorAll('.radio-option').forEach(option => {
    option.addEventListener('click', () => {
      const input = option.querySelector('input[type="radio"]');
      const name = input.name;
      
      // Clear other selections in the same group
      document.querySelectorAll(`input[name="${name}"]`).forEach(radio => {
        radio.closest('.radio-option').classList.remove('selected');
      });
      
      // Select this option
      option.classList.add('selected');
      input.checked = true;
    });
  });

  // Area calculator
  window.calculateArea = function() {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    const area = length * width;
    if (area > 0) {
      document.getElementById('rooftopArea').value = area;
    }
  };

  // Section navigation
  window.nextSection = function() {
    const lat = document.getElementById('latitude').value;
    const lng = document.getElementById('longitude').value;
    
    if (!lat || !lng) {
      alert('Please provide valid coordinates before proceeding.');
      return;
    }
    
    document.getElementById('locationSection').classList.remove('active');
    document.getElementById('dataSection').classList.add('active');
  };

  window.previousSection = function() {
    document.getElementById('dataSection').classList.remove('active');
    document.getElementById('locationSection').classList.add('active');
  };

  window.goBack = function() {
    window.location.href = 'index.html';
  };

  // Form validation and submission
  window.submitData = function() { // Expose function to be called by onclick
    // Collect all form data
    formData = {
      // Location data
      location: {
        latitude: document.getElementById('latitude').value,
        longitude: document.getElementById('longitude').value,
        address: document.getElementById('address').value,
        pincode: document.getElementById('pincode').value,
        state: document.getElementById('state').value,
        district: document.getElementById('district').value,
        town: document.getElementById('town').value
      },
      
      // Basic details
      basicDetails: {
        fullName: document.getElementById('fullName').value,
        contactNumber: document.getElementById('contactNumber').value,
        householdSize: document.getElementById('householdSize').value
      },
      
      // Property details
      propertyDetails: {
        propertyType: document.querySelector('input[name="propertyType"]:checked')?.value || 'Residential',
        roofType: document.querySelector('input[name="roofType"]:checked')?.value || 'mixed',
        rooftopArea: document.getElementById('rooftopArea').value,
        openSpaceArea: document.getElementById('openSpaceArea').value,
        budgetPreference: document.getElementById('budgetRange').value,
        intendedUse: document.getElementById('intendedUse').value,
        storageMonths: document.getElementById('storageMonths').value
      },
      
      // Water sources
      waterSources: Array.from(document.querySelectorAll('input[name="existing_water_sources"]:checked'))
                       .map(cb => cb.value),
      
      timestamp: new Date().toISOString()
    };
    
    // Validate required fields
    const requiredFields = [
      { field: formData.location.latitude, name: 'Latitude' },
      { field: formData.location.longitude, name: 'Longitude' },
      { field: formData.basicDetails.fullName, name: 'Full Name' },
      { field: formData.propertyDetails.rooftopArea, name: 'Rooftop Area' },
      { field: formData.propertyDetails.openSpaceArea, name: 'Open Space Area' }
    ];
    
    for (const req of requiredFields) {
      if (!req.field) {
        alert(`Please provide ${req.name}`);
        return;
      }
    }
    
    const submitBtn = document.getElementById('submitData');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
    submitBtn.disabled = true;

    // --- Reverting to a standard hidden form submission for maximum reliability ---
    // This method avoids browser quirks with fetch/redirects in cross-origin scenarios.
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/submit_form';
    form.style.display = 'none'; // The form is not visible to the user

    const dataToSubmit = {
      name: formData.basicDetails.fullName,
      location_name: formData.location.address,
      user_lat: formData.location.latitude,
      user_lon: formData.location.longitude,
      roof_type: formData.propertyDetails.roofType,
      household_size: parseInt((formData.basicDetails.householdSize || "0").split('-')[0]) || 0,
      rooftop_area: (parseFloat(formData.propertyDetails.rooftopArea || 0) * 0.092903).toFixed(2),
      open_space_area: {
        'none': 0, 'small': 10, 'medium': 60, 'large': 150
      }[formData.propertyDetails.openSpaceArea] || 0,
      property_type: formData.propertyDetails.propertyType,
      existing_water_sources: formData.waterSources.join(','),
      budget_preference: formData.propertyDetails.budgetPreference,
      intended_use: formData.propertyDetails.intendedUse
    };

    // Add each piece of data as a hidden input field to the form
    for (const key in dataToSubmit) {
      if (Object.prototype.hasOwnProperty.call(dataToSubmit, key)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = dataToSubmit[key];
        form.appendChild(input);
      }
    }

    // Append the form to the document and submit it. The browser will now
    // handle the POST request and the subsequent redirect from the server natively.
    document.body.appendChild(form);
    form.submit();
  };

  // Language selector
  document.getElementById('languageSelect').addEventListener('change', function() {
    console.log('Language changed to:', this.value);
    // Implement language switching logic here
  });

  // Auto-calculate area when length/width change
  document.getElementById('length').addEventListener('input', () => {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    if (length > 0 && width > 0) {
      document.getElementById('rooftopArea').value = length * width;
    }
  });

  document.getElementById('width').addEventListener('input', () => {
    const length = parseFloat(document.getElementById('length').value) || 0;
    const width = parseFloat(document.getElementById('width').value) || 0;
    if (length > 0 && width > 0) {
      document.getElementById('rooftopArea').value = length * width;
    }
  });
});