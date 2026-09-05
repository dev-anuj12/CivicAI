/**
 * CIVICAI: Configuration & Civic Taxonomy Engine
 * "One Platform. Every Civic Issue."
 */

export const CONFIG = {
  APP_NAME: 'CivicAI',
  TAGLINE: 'One Platform. Every Civic Issue.',
  CORE_MESSAGE: 'See an Issue. Capture It. Let AI Understand It. Report It. Track It. Resolve It.',
  VERSION: '2.4.0-SIH',
  YEAR: '2026',

  // Supabase Configuration (Custom keys can be configured via Settings or localStorage)
  SUPABASE: {
    URL: localStorage.getItem('civicai_supabase_url') || 'https://xyzcompany.supabase.co',
    ANON_KEY: localStorage.getItem('civicai_supabase_anon_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
  },

  // Gemini AI Vision Configuration (supports BYO-Key or fallback intelligent edge feature engine)
  AI: {
    GEMINI_API_KEY: localStorage.getItem('civicai_gemini_api_key') || '',
    MODEL: 'gemini-1.5-flash',
    HIGH_CONFIDENCE_THRESHOLD: 0.90,
    MODERATE_CONFIDENCE_THRESHOLD: 0.70,
  }
};

// Complete 9 Civic Categories Taxonomy with Subcategories, Adaptive Fields, and Authority Departments
export const CIVIC_TAXONOMY = {
  'Roads & Transportation': {
    id: 'roads',
    name: 'Roads & Transportation',
    icon: 'fa-road',
    color: '#0d9488',
    department: 'Municipal Public Works & Highway Authority',
    description: 'Potholes, damaged roads, cracked asphalt, broken footpaths, and road construction issues.',
    subcategories: [
      'Pothole / Road Depression',
      'Damaged / Cracked Asphalt',
      'Broken Footpath / Pedestrian Walkway',
      'Unfinished Road Construction',
      'Missing / Damaged Guard Rail',
      'Road Caving / Sinking'
    ],
    dynamicFields: [
      {
        id: 'road_pothole_depth',
        label: 'Approximate Depth / Extent',
        type: 'select',
        options: ['Shallow (< 2 inches)', 'Moderate (2-5 inches)', 'Severe (> 5 inches deep)', 'Large Craters / Road Collapse'],
        required: true
      },
      {
        id: 'road_traffic_impact',
        label: 'Traffic Lane Obstruction',
        type: 'select',
        options: ['Minor Shoulder', 'Partial Lane Blocked', 'Full Lane Blocked', 'Both Directions Impassable'],
        required: true
      }
    ]
  },

  'Water & Drainage': {
    id: 'water',
    name: 'Water & Drainage',
    icon: 'fa-faucet-drip',
    color: '#0284c7',
    department: 'Water Supply & Sewerage Board',
    description: 'Pipeline leaks, waterlogging, flooded roads, blocked drains, and sewage overflow.',
    subcategories: [
      'Freshwater Pipeline Leakage',
      'Waterlogging / Flooded Road',
      'Blocked Storm Drain / Gutter',
      'Open / Broken Drain Cover',
      'Sewage Overflow / Contamination',
      'Drinking Water Supply Failure'
    ],
    dynamicFields: [
      {
        id: 'water_leak_type',
        label: 'Water Source / Nature',
        type: 'select',
        options: ['High Pressure Freshwater Main', 'Low Pressure Distribution Line', 'Open Drain Backflow', 'Sewage Manhole Overflow'],
        required: true
      },
      {
        id: 'water_flooding_depth',
        label: 'Standing Water Extent',
        type: 'select',
        options: ['No Standing Water', 'Ankle Deep (< 6 inches)', 'Knee Deep (6-18 inches)', 'Submerged Street / Vehicle Risk'],
        required: true
      }
    ]
  },

  'Electricity & Lighting': {
    id: 'electricity',
    name: 'Electricity & Lighting',
    icon: 'fa-bolt',
    color: '#eab308',
    department: 'City Electricity & Public Lighting Distribution Dept',
    description: 'Broken streetlights, non-functional lighting, dangling cables, and damaged electrical boxes.',
    subcategories: [
      'Non-Functional Streetlight',
      'Broken / Leaning Electric Pole',
      'Dangling / Exposed Live Wire (Urgent)',
      'Damaged Transformer / Junction Box',
      'Dark Public Zone / Lighting Needed',
      'Power Fluctuation / Outage in Public Facility'
    ],
    dynamicFields: [
      {
        id: 'electric_pole_id',
        label: 'Pole Identification No. (If visible)',
        type: 'text',
        placeholder: 'e.g., PL-4029 or nearby building mark',
        required: false
      },
      {
        id: 'electric_wire_hazard',
        label: 'Immediate Shock / Fire Hazard Risk?',
        type: 'select',
        options: ['No immediate hazard (Dark light only)', 'Low risk (Enclosed box)', 'High risk (Exposed wiring near pedestrians)', 'CRITICAL: Sparks or hanging active wire'],
        required: true
      }
    ]
  },

  'Sanitation & Waste': {
    id: 'sanitation',
    name: 'Sanitation & Waste',
    icon: 'fa-trash-can',
    color: '#10b981',
    department: 'Solid Waste Management & Sanitation Board',
    description: 'Garbage accumulation, overflowing dumpsters, illegal dumping, and unhygienic areas.',
    subcategories: [
      'Garbage Accumulation on Public Street',
      'Overflowing Community Dustbin',
      'Illegal Waste Dumping / Debris',
      'Animal Carcass / Biological Waste',
      'Uncleaned Public Urinal / Restroom',
      'Hazardous / Medical Waste in Public Area'
    ],
    dynamicFields: [
      {
        id: 'waste_volume',
        label: 'Estimated Waste Volume',
        type: 'select',
        options: ['Small (< 1 wheelbarrow)', 'Medium (1-3 truck bins)', 'Massive (Commercial dump site)'],
        required: true
      },
      {
        id: 'waste_odor',
        label: 'Odor & Health Hazard Level',
        type: 'select',
        options: ['Mild / Dry Waste', 'Foul Odor / Pest Infestation', 'Severe Health Hazard / Toxic Smell'],
        required: true
      }
    ]
  },

  'Public Infrastructure': {
    id: 'infrastructure',
    name: 'Public Infrastructure',
    icon: 'fa-landmark',
    color: '#8b5cf6',
    department: 'Municipal Infrastructure & Public Assets Maintenance',
    description: 'Damaged public facilities, broken bus shelters, broken park benches, and unsafe public property.',
    subcategories: [
      'Damaged Bus Stop / Transit Shelter',
      'Broken Public Bench / Park Equipment',
      'Damaged Public Boundary Wall',
      'Broken Overhead Bridge Railing',
      'Unsafe Public Staircase / Ramp',
      'Damaged Public Hospital / School Compound'
    ],
    dynamicFields: [
      {
        id: 'infra_facility_type',
        label: 'Type of Public Facility',
        type: 'select',
        options: ['Bus Shelter / Transit Stop', 'Public Park / Playground', 'Footbridge / Subway', 'Community Hall / Public Library', 'Other Public Asset'],
        required: true
      }
    ]
  },

  'Construction': {
    id: 'construction',
    name: 'Construction',
    icon: 'fa-person-digging',
    color: '#f97316',
    department: 'Building Safety & Urban Development Authority',
    description: 'Unsafe construction, abandoned open pits, unbarricaded excavation, and debris obstruction.',
    subcategories: [
      'Unbarricaded Excavation / Pit',
      'Abandoned Construction Debris',
      'Unsafe Scaffolding / Fall Hazard',
      'Illegal Encroachment on Public Pathway',
      'Dust / Construction Material Pollution'
    ],
    dynamicFields: [
      {
        id: 'construction_barricade',
        label: 'Are Warning Signs or Barricades Present?',
        type: 'select',
        options: ['Adequately Barricaded', 'Inadequate / Broken Barricade', 'Zero Barricade / Completely Open Hazard'],
        required: true
      }
    ]
  },

  'Traffic & Signage': {
    id: 'traffic',
    name: 'Traffic & Signage',
    icon: 'fa-traffic-light',
    color: '#ef4444',
    department: 'Traffic Police & Road Safety Department',
    description: 'Damaged traffic signals, missing stop/warning signs, obstructed view, and broken zebra crossings.',
    subcategories: [
      'Malfunctioning Traffic Signal Light',
      'Damaged / Bent Traffic Direction Sign',
      'Missing Stop / Yield / Speed Limit Sign',
      'Faded / Missing Zebra Crossing',
      'Broken Speed Breaker / Rumble Strip',
      'Overgrown Vegetation Blocking Traffic Sign'
    ],
    dynamicFields: [
      {
        id: 'traffic_signal_status',
        label: 'Signal Malfunction Nature',
        type: 'select',
        options: ['Signal Completely Off / Dead', 'Stuck on Single Color', 'Flickering / Timing Chaos', 'Damaged Physical Post'],
        required: true
      }
    ]
  },

  'Environment': {
    id: 'environment',
    name: 'Environment',
    icon: 'fa-tree',
    color: '#059669',
    department: 'Environmental Protection & Forest Conservation Dept',
    description: 'Fallen trees, polluted water bodies, toxic smoke/burning, and green-space destruction.',
    subcategories: [
      'Fallen Tree / Heavy Broken Branch on Road',
      'Pollution in Lake / River / Pond',
      'Open Waste / Plastic Burning',
      'Destruction of Public Green Belt / Park',
      'Chemical / Industrial Effluent Discharge'
    ],
    dynamicFields: [
      {
        id: 'env_hazard_type',
        label: 'Environmental Risk Type',
        type: 'select',
        options: ['Immediate Physical Hazard (Fallen Tree)', 'Air Quality Hazard (Smoke/Fires)', 'Water Body Contamination', 'Loss of Green Cover'],
        required: true
      }
    ]
  },

  'Other Civic Issues': {
    id: 'other',
    name: 'Other Civic Issues',
    icon: 'fa-circle-question',
    color: '#64748b',
    department: 'City Central Civic Grievance Cell',
    description: 'Any other visible public problem or civic concern not listed above.',
    subcategories: [
      'Stray Animal Aggression / Hazard',
      'Noise Pollution in Residential Area',
      'Encroachment of Public Space',
      'General Public Inconvenience',
      'Unclassified Civic Hazard'
    ],
    dynamicFields: [
      {
        id: 'other_custom_note',
        label: 'Key Observations / Details',
        type: 'text',
        placeholder: 'Describe the specific problem context',
        required: true
      }
    ]
  }
};

export const STATUS_FLOW = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved'];
export const SEVERITY_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
