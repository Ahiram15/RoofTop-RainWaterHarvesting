import pandas as pd
from math import radians, sin, cos, sqrt, asin
from flask import Flask, request, render_template, redirect, url_for, jsonify, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
from fpdf import FPDF, XPos, YPos
from datetime import datetime

# Initialize the Flask app
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from frontend

# Configure the database file
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Path Configuration ---
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CSV_FILE_PATH = os.path.join(BASE_DIR, 'data', 'mock_location_data.csv')

# --- Pre-load Data ---
# Load location data into memory at startup to avoid repeated file reads
try:
    location_df = pd.read_csv(CSV_FILE_PATH)
except FileNotFoundError:
    location_df = None
    print(f"CRITICAL ERROR: Location data file not found at '{CSV_FILE_PATH}'. The application will not be able to provide location-based analysis.")

# --- Database Model for User Data ---
class UserInput(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    location_name = db.Column(db.String(120), nullable=False)
    user_lat = db.Column(db.Float)
    user_lon = db.Column(db.Float)
    household_size = db.Column(db.Integer)
    rooftop_area = db.Column(db.Float)
    open_space_area = db.Column(db.Float)  # NEW FIELD
    roof_type = db.Column(db.String(50))
    property_type = db.Column(db.String(50))  # NEW FIELD
    existing_water_sources = db.Column(db.String(200))  # NEW FIELD
    budget_preference = db.Column(db.String(50))  # NEW FIELD
    intended_use = db.Column(db.String(100))  # NEW FIELD

# --- Core Calculation Functions ---

def haversine(lat1, lon1, lat2, lon2):
    """Calculate the distance between two points on Earth using the Haversine formula."""
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of Earth in kilometers
    return c * r

def get_nearest_location(user_lat, user_lon):
    """Find the nearest location from the CSV based on user's GPS coordinates."""
    if location_df is None:
        return None
    df = location_df.copy() # Use a copy to avoid modifying the global DataFrame
    df['distance'] = df.apply(
        lambda row: haversine(user_lat, user_lon, row['Latitude'], row['Longitude']),
        axis=1
    )
    nearest_row = df.loc[df['distance'].idxmin()]
    return nearest_row.to_dict()

def get_mock_location_data(location_name, user_lat=None, user_lon=None):
    """Get location data by name from the mock CSV."""
    if location_df is None:
        return None
    for index, row in location_df.iterrows():
        if row['Region_Name'].lower() in location_name.lower():
            match_dict = row.to_dict()
            if user_lat and user_lon:
                match_dict['distance'] = haversine(user_lat, user_lon, match_dict['Latitude'], match_dict['Longitude'])
            return match_dict
    
    match = location_df[location_df['Region_Name'].str.lower() == location_name.lower()]
    if not match.empty:
        return match.to_dict('records')[0]
    return None

def calculate_runoff_potential(roof_area_m2, rainfall_mm, runoff_coefficient):
    """Calculate annual runoff generation capacity."""
    annual_runoff_liters = roof_area_m2 * rainfall_mm * runoff_coefficient
    peak_monthly = annual_runoff_liters * 0.4  # Assuming 40% in peak monsoon month
    return {
        'annual_liters': annual_runoff_liters,
        'peak_monthly': peak_monthly,
        'daily_average': annual_runoff_liters / 365
    }

def validate_artificial_recharge_safety(location_data):
    """Check if artificial recharge is safe based on multiple factors."""
    safety_issues = []
    is_safe = True
    
    # Check groundwater depth
    gw_depth = location_data.get('Groundwater_Depth_m', 10)
    if gw_depth < 3:
        safety_issues.append("Shallow groundwater (<3m) - Risk of waterlogging and contamination")
        is_safe = False
    
    # Check water quality
    water_quality = location_data.get('Water_Quality', 'Good')
    if water_quality.lower() in ['poor', 'contaminated']:
        safety_issues.append("Poor groundwater quality - Recharge may worsen contamination")
        is_safe = False
    
    # Check soil infiltration rate
    infiltration_rate = location_data.get('Infiltration_Rate_mm_per_hr', 15)
    if infiltration_rate < 5:
        safety_issues.append("Low soil infiltration (<5mm/hr) - Water will stagnate")
        is_safe = False
    
    # Check aquifer type and remarks for regulatory issues
    remarks = location_data.get('Remarks', '').lower()
    if 'overexploited' in remarks or 'prohibited' in remarks:
        safety_issues.append("Regulatory restrictions - Check CGWA guidelines")
        is_safe = False
    
    return {
        'is_safe': is_safe,
        'safety_issues': safety_issues,
        'alternatives': ['Storage tank only', 'Community structures', 'Water conservation'] if not is_safe else []
    }

def determine_category(roof_area, open_space, rainfall, soil_type, gw_depth, infiltration_rate):
    """Classify user into 6 categories based on multiple criteria."""
    
    # Category 1: Storage Tank Only
    if (roof_area < 50 or open_space < 10 or rainfall < 600 or gw_depth < 3 or 
        infiltration_rate < 5):
        return {
            'category': 1,
            'name': 'Storage Tank Only',
            'description': 'Small urban homes, apartments with limited space/rainfall',
            'recommended_structures': ['Above-ground storage tank (1,000-5,000L)', 'First flush diverter'],
            'recharge_feasible': False
        }
    
    # Category 2: Storage + Small Recharge Pit
    elif (50 <= roof_area <= 150 and 10 <= open_space <= 25 and 600 <= rainfall <= 1000 and 
          3 <= gw_depth <= 8 and soil_type.lower() in ['sandy', 'loamy']):
        return {
            'category': 2,
            'name': 'Storage + Small Recharge Pit',
            'description': 'Small/medium homes with limited yard space',
            'recommended_structures': ['Storage tank (3,000-8,000L)', 'Recharge pit (1×1×2m)', 'Sand-gravel-boulder filter'],
            'recharge_feasible': True
        }
    
    # Category 3: Recharge Pit/Trench + Storage Tank
    elif (150 <= roof_area <= 400 and 25 <= open_space <= 100 and 1000 <= rainfall <= 1400 and 
          5 <= gw_depth <= 15):
        return {
            'category': 3,
            'name': 'Recharge Pit/Trench + Storage Tank',
            'description': 'Medium houses with good space and rainfall',
            'recommended_structures': ['Storage tank (5,000-15,000L)', 'Multiple recharge pits', 'Trench system (10-20m)'],
            'recharge_feasible': True
        }
    
    # Category 4: Recharge Shaft / Borewell Recharge
    elif (400 <= roof_area <= 1000 and open_space >= 50 and rainfall > 1000 and gw_depth > 15):
        return {
            'category': 4,
            'name': 'Recharge Shaft / Borewell Recharge',
            'description': 'Large homes, multi-story buildings',
            'recommended_structures': ['Storage tank (10,000-25,000L)', 'Recharge shaft (25-30m deep)', 'Injection well'],
            'recharge_feasible': True
        }
    
    # Category 5: Recharge Pond / Community Structures
    elif (roof_area > 1000 and open_space > 200 and rainfall > 800):
        return {
            'category': 5,
            'name': 'Recharge Pond / Community Structures',
            'description': 'Institutions, farms, large plots, apartments',
            'recommended_structures': ['Large storage (25,000-100,000L)', 'Percolation pond (10×10×2-3m)', 'Check dams'],
            'recharge_feasible': True
        }
    
    # Category 6: Supplementary Only
    else:
        return {
            'category': 6,
            'name': 'Supplementary Only',
            'description': 'Very small homes, low rainfall zones',
            'recommended_structures': ['Small tank (500-2,000L)', 'Community systems', 'Water efficiency focus'],
            'recharge_feasible': False
        }

def calculate_structure_dimensions(runoff_volume, soil_infiltration, available_space):
    """Suggest structure dimensions based on runoff volume and site conditions."""
    dimensions = {}
    
    # Recharge Pit calculations
    if runoff_volume <= 50000:  # Up to 50,000 liters
        dimensions['pit'] = {
            'length_m': 1.5,
            'width_m': 1.5,
            'depth_m': 2.5,
            'volume_m3': 5.6,
            'material_cost': '₹8,000-15,000'
        }
    elif runoff_volume <= 150000:
        dimensions['pit'] = {
            'length_m': 2.0,
            'width_m': 2.0,
            'depth_m': 3.0,
            'volume_m3': 12.0,
            'material_cost': '₹15,000-25,000'
        }
    
    # Recharge Trench calculations
    if available_space > 50 and runoff_volume > 100000:
        trench_length = min(available_space * 0.3, runoff_volume / 5000)  # Conservative sizing
        dimensions['trench'] = {
            'length_m': trench_length,
            'width_m': 1.0,
            'depth_m': 2.0,
            'volume_m3': trench_length * 2.0,
            'material_cost': f'₹{int(trench_length * 2000)}-{int(trench_length * 3500)}'
        }
    
    # Storage tank sizing
    storage_size = min(runoff_volume * 0.3, 25000)  # 30% of annual runoff or max 25,000L
    dimensions['storage'] = {
        'capacity_liters': int(storage_size),
        'diameter_m': round((storage_size / 1000 / 3.14159 * 4 / 3) ** (1/3), 1),
        'material_cost': f'₹{int(storage_size * 12)}-{int(storage_size * 18)}'
    }
    
    return dimensions

def estimate_costs_and_payback(structure_type, dimensions, annual_runoff, local_water_cost=0.16):
    """Calculate construction costs and payback period."""
    costs = {
        'storage_tank': {
            'base_cost': dimensions.get('storage', {}).get('capacity_liters', 5000) * 15,
            'installation': 5000,
            'maintenance_annual': 2000
        },
        'recharge_pit': {
            'base_cost': 15000,
            'installation': 8000,
            'maintenance_annual': 3000
        },
        'recharge_trench': {
            'base_cost': 25000,
            'installation': 12000,
            'maintenance_annual': 4000
        }
    }
    
    total_cost = sum(costs.get(structure_type, costs['storage_tank']).values()) - costs.get(structure_type, costs['storage_tank'])['maintenance_annual']
    annual_water_value = annual_runoff * local_water_cost
    annual_savings = annual_water_value - costs.get(structure_type, costs['storage_tank'])['maintenance_annual']
    
    payback_years = total_cost / annual_savings if annual_savings > 0 else float('inf')
    
    return {
        'total_construction_cost': total_cost,
        'annual_water_value': annual_water_value,
        'annual_net_savings': annual_savings,
        'payback_years': round(payback_years, 1),
        'roi_percentage': round((annual_savings / total_cost) * 100, 1) if total_cost > 0 else 0
    }

def get_purification_recommendations(intended_use, roof_type, location_data):
    """Recommend filtration sequence based on intended use and conditions."""
    base_sequence = [
        "Gutter mesh/screen - Remove leaves, twigs, debris",
        "First-flush diverter - Discard initial dirty runoff (5-10 min)",
        "Silt trap chamber - Allow heavy particles to settle"
    ]
    
    # Add filtration based on intended use
    if intended_use.lower() in ['drinking', 'potable', 'cooking']:
        base_sequence.extend([
            "Multi-layer filter - Sand, gravel, activated charcoal",
            "UV disinfection or chlorination",
            "Optional: RO system for drinking water"
        ])
        maintenance_freq = "Monthly filter cleaning, quarterly media replacement"
        estimated_cost = "₹15,000-30,000 for complete treatment"
    
    elif intended_use.lower() in ['gardening', 'toilet', 'non-potable']:
        base_sequence.extend([
            "Simple sand-gravel filter",
            "Mesh filter for final screening"
        ])
        maintenance_freq = "Quarterly cleaning, annual media check"
        estimated_cost = "₹5,000-12,000 for basic treatment"
    
    else:  # General use
        base_sequence.append("Sand-gravel-charcoal filter")
        maintenance_freq = "Bi-monthly cleaning"
        estimated_cost = "₹8,000-18,000 for standard treatment"
    
    return {
        'treatment_sequence': base_sequence,
        'maintenance_schedule': maintenance_freq,
        'estimated_cost': estimated_cost,
        'water_quality_expected': 'Potable' if 'drinking' in intended_use.lower() else 'Non-potable suitable'
    }

def calculate_comprehensive_feasibility(location_data, user_input):
    """Enhanced feasibility calculation with safety checks and categorization."""
    
    # Extract parameters
    rainfall_mm = location_data['Rainfall_mm']
    roof_area = user_input.rooftop_area
    open_space = user_input.open_space_area or 0
    runoff_coeff = location_data.get('Runoff_Coefficient', 0.8)
    household_size = user_input.household_size
    soil_type = location_data.get('Soil_Type', 'Loamy')
    gw_depth = location_data.get('Groundwater_Depth_m', 10)
    infiltration_rate = location_data.get('Infiltration_Rate_mm_per_hr', 15)
    
    # Calculate runoff potential
    runoff_data = calculate_runoff_potential(roof_area, rainfall_mm, runoff_coeff)
    
    # Check artificial recharge safety
    safety_check = validate_artificial_recharge_safety(location_data)
    
    # Determine category
    category_info = determine_category(roof_area, open_space, rainfall_mm, soil_type, gw_depth, infiltration_rate)
    
    # Calculate structure dimensions
    structure_dims = calculate_structure_dimensions(runoff_data['annual_liters'], infiltration_rate, open_space)
    
    # Estimate costs and payback
    cost_analysis = estimate_costs_and_payback('storage_tank', structure_dims, runoff_data['annual_liters'])
    
    # Get purification recommendations
    purification = get_purification_recommendations(
        user_input.intended_use or 'general', 
        user_input.roof_type, 
        location_data
    )
    
    # Calculate household demand
    daily_demand = household_size * 135  # liters per day
    annual_demand = daily_demand * 365
    
    # Overall feasibility score
    if annual_demand > 0:
        feasibility_percentage = min((runoff_data['annual_liters'] / annual_demand) * 100, 100)
    else:
        # If there is no demand (e.g., household size is 0), feasibility is not applicable.
        feasibility_percentage = 0.0
    
    if feasibility_percentage >= 80:
        feasibility_status = "Fully Feasible"
    elif feasibility_percentage >= 50:
        feasibility_status = "Partially Feasible" 
    elif feasibility_percentage >= 20:
        feasibility_status = "Limited Feasible"
    else:
        feasibility_status = "Not Feasible"
    
    return {
        'runoff_data': runoff_data,
        'safety_check': safety_check,
        'category': category_info,
        'structure_dimensions': structure_dims,
        'cost_analysis': cost_analysis,
        'purification': purification,
        'annual_demand': annual_demand,
        'feasibility_percentage': round(feasibility_percentage, 1),
        'feasibility_status': feasibility_status
    }

# --- Flask Routes ---

@app.route('/')
def index_page():
    """Serves the main index.html page."""
    return render_template('index.html')

@app.route('/location-input')
def location_input_page():
    """Serves the location input page."""
    return render_template('location-input.html')

@app.route('/subsidy-checker.html')
def subsidy_checker_page():
    """Serves the static subsidy checker HTML file."""
    return render_template('subsidy-checker.html')

@app.route('/submit_form', methods=['POST'])
def submit_form():
    # Retrieve form data including new fields
    name = request.form.get('name')
    location_name = request.form.get('location_name')
    user_lat = request.form.get('user_lat')
    user_lon = request.form.get('user_lon')
    household_size = request.form.get('household_size')
    rooftop_area = request.form.get('rooftop_area')
    open_space_area = request.form.get('open_space_area')  # NEW
    roof_type = request.form.get('roof_type')
    property_type = request.form.get('property_type')  # NEW
    existing_water_sources = request.form.get('existing_water_sources')  # NEW
    budget_preference = request.form.get('budget_preference')  # NEW
    intended_use = request.form.get('intended_use')  # NEW
    
    # Convert to appropriate types
    user_lat = float(user_lat) if user_lat else None
    user_lon = float(user_lon) if user_lon else None
    household_size = int(household_size) if household_size else 0
    rooftop_area = float(rooftop_area) if rooftop_area else 0.0
    open_space_area = float(open_space_area) if open_space_area else 0.0
    
    # Create a new UserInput object with enhanced fields
    new_entry = UserInput(
        name=name,
        location_name=location_name,
        user_lat=user_lat,
        user_lon=user_lon,
        household_size=household_size,
        rooftop_area=rooftop_area,
        open_space_area=open_space_area,
        roof_type=roof_type,
        property_type=property_type,
        existing_water_sources=existing_water_sources,
        budget_preference=budget_preference,
        intended_use=intended_use
    )
    
    db.session.add(new_entry)
    db.session.commit()
    
    # Reverting to a standard redirect, which works best with a native form submission
    # and is more reliable in avoiding browser navigation quirks.
    return redirect(url_for('results_page', entry_id=new_entry.id))

@app.route('/results/<int:entry_id>')
def results_page(entry_id):
    # Retrieve user data from the database
    user_data = UserInput.query.get_or_404(entry_id)
    
    try:
        # Determine the nearest mock location using GPS or manual name
        if user_data.user_lat and user_data.user_lon:
            nearest_city_data = get_nearest_location(user_data.user_lat, user_data.user_lon)
        else:
            nearest_city_data = get_mock_location_data(user_data.location_name, user_data.user_lat, user_data.user_lon)
            # If location is found manually, distance is not calculated, so set to 0.
            if nearest_city_data:
                nearest_city_data['distance'] = 0
            
    except FileNotFoundError:
        error_message = "Server configuration error: The location data file could not be found."
        print(f"ERROR: {error_message}")
        return error_message, 500
    
    if not nearest_city_data:
        return "Error: Could not find data for your location.", 404
    
    # Perform comprehensive feasibility analysis
    comprehensive_analysis = calculate_comprehensive_feasibility(nearest_city_data, user_data)
    
    # Pass all data to the HTML template
    return render_template('results.html',
                         user_data=user_data,
                         location_data=nearest_city_data,
                         analysis=comprehensive_analysis)

@app.route('/download_report/<int:entry_id>')
def download_report(entry_id):
    # Retrieve user data and perform analysis (same logic as results_page)
    user_data = UserInput.query.get_or_404(entry_id)
    
    if user_data.user_lat and user_data.user_lon:
        location_data = get_nearest_location(user_data.user_lat, user_data.user_lon)
    else:
        location_data = get_mock_location_data(user_data.location_name, user_data.user_lat, user_data.user_lon)
        if location_data:
            location_data['distance'] = 0

    if not location_data:
        return "Error: Could not find data for your location.", 404

    analysis = calculate_comprehensive_feasibility(location_data, user_data)

    # --- PDF Generation with FPDF2 (No external dependencies) - Updated Syntax ---
    class PDF(FPDF):
        def header(self):
            self.set_font('Helvetica', 'B', 12)
            self.cell(0, 10, 'Rooftop Rainwater Harvesting Report', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
            self.ln(5)

        def footer(self):
            self.set_y(-15)
            self.set_font('Helvetica', 'I', 8)
            self.cell(0, 10, f'Page {self.page_no()}', align='C')

        def section_title(self, title):
            self.set_font('Helvetica', 'B', 14)
            self.set_text_color(0, 77, 76)
            self.cell(0, 10, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='L')
            self.line(self.get_x(), self.get_y(), self.get_x() + 190, self.get_y())
            self.ln(4)
        
        def write_key_value_table(self, data):
            self.set_font('Helvetica', '', 11)
            self.set_text_color(51, 51, 51)
            key_col_width = 50
            val_col_width = self.w - self.l_margin - self.r_margin - key_col_width
            line_height = self.font_size * 1.5
            for key, value in data.items():
                self.set_font('Helvetica', 'B')
                self.cell(key_col_width, line_height, key, border=0)
                self.set_font('Helvetica', '')
                self.multi_cell(val_col_width, line_height, str(value), border=0, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.ln(5)

    pdf = PDF()
    pdf.add_page()
    pdf.set_font('Times', 'B', 24)
    pdf.set_text_color(0, 77, 76)
    pdf.cell(0, 10, 'Rooftop Rainwater Harvesting Report', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    pdf.set_font('Times', '', 11)
    pdf.set_text_color(51, 51, 51)
    pdf.cell(0, 10, f'Report generated on: {datetime.now().strftime("%d %B %Y")}', new_x=XPos.LMARGIN, new_y=YPos.NEXT, align='C')
    pdf.ln(10)

    pdf.section_title('User Details')
    pdf.write_key_value_table({
        "Name": user_data.name, "Location": user_data.location_name,
        "Rooftop Area": f"{user_data.rooftop_area:.1f} m²", "Open Space Area": f"{user_data.open_space_area:.1f} m²",
        "Household Size": f"{user_data.household_size} people", "Property Type": user_data.property_type
    })

    pdf.section_title('Feasibility Assessment')
    pdf.write_key_value_table({
        "Harvest Potential": f"{analysis['runoff_data']['annual_liters']:,.0f} Liters/year",
        "Household Demand": f"{analysis['annual_demand']:,.0f} Liters/year",
        "Feasibility Status": f"{analysis['feasibility_status']} ({analysis['feasibility_percentage']}% of demand met)"
    })

    # The .output(dest='S') method returns a string; encode to bytes for Flask response.
    pdf_bytes = bytes(pdf.output(dest='S'))
    return pdf_bytes, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': f'attachment; filename=RWH_Report_{user_data.name.replace(" ", "_")}.pdf'
    }

@app.route('/api/calculate', methods=['POST'])
def api_calculate():
    """API endpoint for rapid calculations without database storage."""
    data = request.get_json()
    
    # Mock location data for API
    mock_location = {
        'Rainfall_mm': data.get('rainfall', 800),
        'Runoff_Coefficient': 0.8,
        'Groundwater_Depth_m': data.get('gw_depth', 10),
        'Soil_Type': data.get('soil_type', 'Loamy'),
        'Infiltration_Rate_mm_per_hr': data.get('infiltration', 15),
        'Water_Quality': data.get('water_quality', 'Good')
    }
    
    # Create mock user input
    class MockUser:
        def __init__(self, data):
            self.rooftop_area = data.get('roof_area', 100)
            self.open_space_area = data.get('open_space', 50)
            self.household_size = data.get('household_size', 4)
            self.roof_type = data.get('roof_type', 'Concrete')
            self.intended_use = data.get('intended_use', 'general')
    
    mock_user = MockUser(data)
    
    # Calculate comprehensive feasibility
    result = calculate_comprehensive_feasibility(mock_location, mock_user)
    
    return jsonify(result)

if __name__ == '__main__':
    with app.app_context():
        # Create the database tables if they don't exist
        db.create_all()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
