// --- Mock Backend Data Structure ---

// Define national schemes once to avoid repetition
const nationalSchemes = {
  jalShakti: {
    "name": "Jal Shakti Abhiyan: Catch the Rain",
    "scope": "national",
    "description": "This is a nationwide campaign and not a direct financial subsidy for individuals. It promotes rainwater harvesting through convergence with other schemes like MGNREGS. Consult with your local municipal corporation or gram panchayat for details.",
    "eligibility_criteria": {
      "location": ["urban", "rural"],
      "building_types": ["residential", "commercial", "government"]
    },
    "estimated_subsidy": "N/A (varies locally)",
    "application_link": "https://jalshakti-ddws.gov.in/jal-shakti-abhiyan"
  },
  atalBhujal: {
    "name": "Atal Bhujal Yojana (ABY)",
    "scope": "national",
    "description": "This is a central government initiative limited to specific water-stressed states. Check if your state is a participant.",
    "eligibility_criteria": {
      "location": ["urban", "rural"],
      "building_types": ["residential", "commercial", "government"]
    },
    "participating_states": ["Gujarat", "Haryana", "Karnataka", "Madhya Pradesh", "Maharashtra", "Rajasthan", "Uttar Pradesh"]
  }
};

// Expanded data for multiple states
const subsidyData = {
  "Andhra Pradesh": {
    "rules": {
      "mandatory": [
        {
          "location": ["urban"],
          "plot_size_min": 300,
          "building_types": ["residential", "commercial", "government"]
        }
      ],
      "optional": []
    },
    "schemes": [
      nationalSchemes.jalShakti,
      {
        "name": "Andhra Pradesh State-level Incentives",
        "scope": "state",
        "description": "Some local municipalities may offer property tax rebates or other incentives for installing rainwater harvesting systems, particularly for older buildings. These vary by city and are not uniform across the state.",
        "eligibility_criteria": { "location": ["urban"], "building_types": ["residential", "commercial"] },
        "estimated_subsidy": "Varies (e.g., property tax rebate)",
        "application_link": "Contact your local municipal office for information."
      }
    ]
  },
  "Delhi": {
    "rules": { "mandatory": [{ "location": ["urban"], "plot_size_min": 100, "building_types": ["residential", "commercial", "government"] }], "optional": [] },
    "schemes": [
      nationalSchemes.jalShakti,
      { "name": "Delhi Jal Board Rebate", "scope": "state", "description": "Delhi Jal Board (DJB) offers a rebate on water bills for properties with functional RWH systems.", "eligibility_criteria": { "location": ["urban"], "building_types": ["residential", "commercial"] }, "estimated_subsidy": "Up to 10% rebate on water bill", "application_link": "Contact Delhi Jal Board" }
    ]
  },
  "Karnataka": {
    "rules": { "mandatory": [{ "location": ["urban"], "plot_size_min": 111, "building_types": ["residential", "commercial", "government"] }], "optional": [] },
    "schemes": [
      nationalSchemes.jalShakti,
      nationalSchemes.atalBhujal,
      { "name": "BWSSB Rebate (Bangalore)", "scope": "state", "description": "The Bangalore Water Supply and Sewerage Board (BWSSB) provides a rebate on water bills for properties with RWH systems.", "eligibility_criteria": { "location": ["urban"], "building_types": ["residential"] }, "estimated_subsidy": "Varies", "application_link": "Contact BWSSB" }
    ]
  },
  "Maharashtra": {
    "rules": { "mandatory": [{ "location": ["urban"], "plot_size_min": 500, "building_types": ["residential", "commercial", "government"] }], "optional": [] },
    "schemes": [
      nationalSchemes.jalShakti,
      nationalSchemes.atalBhujal,
      { "name": "Property Tax Rebate (e.g., Pune, Mumbai)", "scope": "state", "description": "Municipal corporations like Pune and Mumbai offer rebates on property tax for societies with functional RWH.", "eligibility_criteria": { "location": ["urban"], "building_types": ["residential", "commercial"] }, "estimated_subsidy": "5-10% property tax rebate", "application_link": "Contact local Municipal Corporation" }
    ]
  },
  "Rajasthan": {
    "rules": { "mandatory": [{ "location": ["urban"], "plot_size_min": 300, "building_types": ["residential", "commercial", "government"] }], "optional": [] },
    "schemes": [
      nationalSchemes.jalShakti,
      nationalSchemes.atalBhujal,
      { "name": "Mukhya Mantri Jal Swavlamban Abhiyan", "scope": "state", "description": "A state-wide campaign focused on water conservation. Financial assistance for RWH structures may be available.", "eligibility_criteria": { "location": ["urban", "rural"], "building_types": ["residential", "commercial"] }, "estimated_subsidy": "Varies", "application_link": "Contact your local water resource department" }
    ]
  },
  "Tamil Nadu": {
    "rules": { "mandatory": [{ "location": ["urban", "rural"], "plot_size_min": 0, "building_types": ["residential", "commercial", "government"] }], "optional": [] },
    "schemes": [
      nationalSchemes.jalShakti,
      { "name": "Chennai Metro Water Subsidy", "scope": "state", "description": "Chennai Metropolitan Water Supply and Sewerage Board (CMWSSB) provides technical assistance and may have local incentives.", "eligibility_criteria": { "location": ["urban"], "building_types": ["residential", "commercial"] }, "estimated_subsidy": "Technical assistance, varies", "application_link": "Contact CMWSSB" }
    ]
  }
};

function runEligibilityCheck(state, location, plotSize, buildingType) {
    const stateData = subsidyData[state];
    let complianceStatus = 'Optional';
    let mandatoryRule = null;
    let eligibleSchemes = [];

    // --- Compliance Check Logic ---
    if (stateData) {
        stateData.rules.mandatory.forEach(rule => {
            if (rule.location.includes(location) && plotSize >= rule.plot_size_min && rule.building_types.includes(buildingType)) {
                complianceStatus = 'Mandatory';
                mandatoryRule = rule;
            }
        });
    }

    // --- Subsidy Check Logic ---
    if (stateData && stateData.schemes) {
        stateData.schemes.forEach(scheme => {
            let isEligible = false;
            if (scheme.name === "Atal Bhujal Yojana (ABY)") {
                if (scheme.participating_states.includes(state)) {
                    isEligible = true;
                }
            } else {
                 if (scheme.eligibility_criteria.location.includes(location) && scheme.eligibility_criteria.building_types.includes(buildingType)) {
                    isEligible = true;
                }
            }
           
            if (isEligible) {
                eligibleSchemes.push(scheme);
            }
        });
    }

    // --- Display Results ---
    const complianceStatusDiv = document.getElementById('complianceStatus');
    const schemesListUl = document.getElementById('schemesList');
    const warningMessageDiv = document.getElementById('warningMessage');
    const resultsSection = document.getElementById('resultsSection');

    schemesListUl.innerHTML = '';
    
    if (complianceStatus === 'Mandatory') {
        complianceStatusDiv.innerHTML = `<span class="compliance-status">✅ Compliance Status: Mandatory</span><p>Rainwater harvesting is mandatory for new buildings with a plot size of ${mandatoryRule.plot_size_min} sq.m or more in ${location} areas of ${state}.</p>`;
        complianceStatusDiv.className = 'result-box green';
        warningMessageDiv.classList.remove('hidden');
    } else {
        complianceStatusDiv.innerHTML = `<span class="compliance-status">📝 Compliance Status: Optional</span><p>Rainwater harvesting is encouraged but not a mandatory requirement for your property type in ${state}.</p>`;
        complianceStatusDiv.className = 'result-box yellow';
        warningMessageDiv.classList.add('hidden');
    }

    if (eligibleSchemes.length > 0) {
        eligibleSchemes.forEach(scheme => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${scheme.name}</strong>: ${scheme.description}`;
            if (scheme.application_link) {
                li.innerHTML += ` <a href="${scheme.application_link}" target="_blank" class="text-cyan-400 hover:underline">Learn More</a>`;
            }
            schemesListUl.appendChild(li);
        });
        document.getElementById('subsidySchemes').classList.remove('hidden');
    } else {
         document.getElementById('subsidySchemes').classList.add('hidden');
    }

    resultsSection.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const stateParam = urlParams.get('state');
    const plotSizeParam = urlParams.get('plotSize');
    const locationParam = urlParams.get('location');
    const buildingTypeParam = urlParams.get('buildingType');

    const formContainer = document.querySelector('.glass-card');
    const eligibilityForm = document.getElementById('eligibilityForm');
    const stateSelect = document.getElementById('state');

    // Populate states dropdown
    const states = Object.keys(subsidyData).sort();
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateSelect.appendChild(option);
    });

    if (stateParam && plotSizeParam && locationParam && buildingTypeParam) {
        // --- Automatic Mode ---
        formContainer.innerHTML = `
            <h2 class="text-2xl font-bold text-white mb-4">Checking Eligibility For:</h2>
            <div class="grid md:grid-cols-2 gap-4 text-lg">
                <p><strong>State:</strong> ${stateParam}</p>
                <p><strong>Plot Size:</strong> ${plotSizeParam} sq.m</p>
                <p><strong>Location:</strong> ${locationParam.charAt(0).toUpperCase() + locationParam.slice(1)}</p>
                <p><strong>Building Type:</strong> ${buildingTypeParam.charAt(0).toUpperCase() + buildingTypeParam.slice(1)}</p>
            </div>
        `;
        runEligibilityCheck(stateParam, locationParam, parseInt(plotSizeParam), buildingTypeParam);
    } else {
        // --- Manual Mode ---
        eligibilityForm.addEventListener('submit', function(event) {
            event.preventDefault();
            const state = document.getElementById('state').value;
            const location = document.querySelector('input[name="location"]:checked').value;
            const plotSize = parseInt(document.getElementById('plotSize').value);
            const buildingType = document.querySelector('input[name="buildingType"]:checked').value;
            runEligibilityCheck(state, location, plotSize, buildingType);
        });
    }
});