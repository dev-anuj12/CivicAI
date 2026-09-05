import { CivicCategoryMeta, CivicReport, NagpurLocation } from '../types';

export const CIVIC_LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCvbaP5UODeePMWgTjJjo8Rfg8dJu6GBIpNAT2GTMOTIdQvmxIXyvZ92ZkRVv-0HVJTb1PFXAz_2eMEikvY7mTOLTCryfJdlM2ESJ7zQq9gO1BUYN4pFBz7ikOAGppc7W2cCKQzgcVdZAd8PIUbz3ntlmeAeyt0mZ9Y_xvPWmMXFOvnzMkfCBDWVjBjB7m3l2dyLpS-cy1jczQFmpOP81ARcxch_ZJdBrsqaPwQj1KUwXPJivcZj-UC';

export const MAP_RADAR_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBnRlVvvl_VmTUeUuT3uN7D8VrEsaKFl3i_MUP4mw-XxFUXLImxv1OyFpAzatjmmHHgOroI1E8_eIYxS55UF_WHRaav0nUMbCqGbnKGL_BKn5hBYcFy2uH_EbMj6pyItXEETd-najhoCvhlzR05FwMFp8CY6II4boxXb5yl808GrdkqdYnEdMHk45_wmumlebgMwt9mjHvQ8tGZQTfeHoY5bFzVMBcVWJ0XZp4ASjAi1RJfoDGEUdow';

export const MAP_KDK_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDmH51YjZ2iQEKOZDouJ2c6WM4usfiyKIbSBpLeuk1Kab0ONl7y7nmgWdH3WOKJvhkuH0TUvI3m-yMJZdrZelQMM6TxBOxNQU0_xjY3wLWgJq0_BVNdZN4qelfLMmyI_1xyIjpZ0YpYOtDbaXBqtu0H44sGKcWLNlIu6tWc85LOdlAtLf_TEcb6ezAaaQFrYE_JRi6LerCcHj97xUK9Rj2MxU0_tWA-uR-R4TMskRsd480LEYjLYr8Z';

export const MAP_NAGPUR_RADAR_URL = MAP_RADAR_URL;
export const MAP_ADMIN_ZONES_URL = MAP_RADAR_URL;

// All 9 Municipal Civic Domains Specification
export const CIVIC_CATEGORIES: CivicCategoryMeta[] = [
  {
    id: 'Roads & Transportation',
    name: 'Roads & Transportation',
    icon: 'minor_crash',
    department: 'Road & Highway Infrastructure Division',
    description: 'Potholes, cracked asphalt, broken footpaths, and road construction hazards.',
    sampleSubcategories: ['Pothole Crater', 'Damaged Asphalt', 'Cracked Surface', 'Broken Footpath', 'Road Work Obstruction'],
    fields: [
      {
        name: 'potholeDepth',
        label: 'Approximate Crater Depth',
        type: 'select',
        options: ['Minor (< 5 cm)', 'Moderate (5 - 15 cm)', 'Severe (> 15 cm deep crater)', 'Full Road Collapse'],
      },
      {
        name: 'laneObstruction',
        label: 'Traffic Lane Impact',
        type: 'select',
        options: ['Shoulder Only', 'Single Lane Blocked', 'Both Lanes Impassable', 'Full Corridor Gridlock'],
      },
    ],
  },
  {
    id: 'Water & Drainage',
    name: 'Water & Drainage',
    icon: 'water_drop',
    department: 'Water Supply & Sewage Board',
    description: 'Pipeline leakages, open manholes, storm drain blockage, and sewage overflow.',
    sampleSubcategories: ['Water Pipeline Leak', 'Flooded Roadway', 'Blocked Storm Drain', 'Open Manhole', 'Sewage Spill'],
    fields: [
      {
        name: 'waterFlowRate',
        label: 'Leakage Severity / Water Level',
        type: 'select',
        options: ['Minor Seepage', 'Continuous Pipe Gush', 'Street Submerged (Ankle Deep)', 'Severe Road Flooding (Knee Deep)'],
      },
      {
        name: 'openManholeHazard',
        label: 'Is there an uncovered manhole or drain?',
        type: 'select',
        options: ['No', 'Yes - Open Storm Drain', 'Yes - Dangerous Deep Manhole Chamber'],
      },
    ],
  },
  {
    id: 'Electricity & Lighting',
    name: 'Electricity & Lighting',
    icon: 'light',
    department: 'Municipal Electrical Board',
    description: 'Broken streetlights, hanging power cables, and damaged electrical feeder pillars.',
    sampleSubcategories: ['Broken Streetlight', 'Non-functional Lamp Cluster', 'Exposed Live Wires', 'Damaged Transformer'],
    fields: [
      {
        name: 'wireHazard',
        label: 'Exposed Electrical Wires / Shock Danger',
        type: 'select',
        options: ['None Visible', 'Hanging Wires Overhead', 'Exposed Cable Touching Ground (Urgent)'],
      },
      {
        name: 'poleCount',
        label: 'Affected Streetlights',
        type: 'select',
        options: ['Single Fixture', '2 - 4 Streetlights', 'Entire Street / Colony Blackout'],
      },
    ],
  },
  {
    id: 'Sanitation & Waste',
    name: 'Sanitation & Waste',
    icon: 'delete_sweep',
    department: 'Solid Waste Management Division',
    description: 'Garbage accumulation, overflowing municipal bins, and unauthorized dumping.',
    sampleSubcategories: ['Overflowing Garbage Bin', 'Illegal Dumping Site', 'Unclean Public Area', 'Animal Waste / Debris'],
    fields: [
      {
        name: 'wasteVolume',
        label: 'Estimated Waste Volume',
        type: 'select',
        options: ['Small Pile (< 1 m³)', 'Medium Heap (1 - 5 m³)', 'Heavy Dumper Load (> 5 m³)'],
      },
      {
        name: 'bioHazard',
        label: 'Biohazard / Debris Type',
        type: 'select',
        options: ['General Domestic Waste', 'Construction Debris / Malba', 'Rotting Organic Waste / Hazardous'],
      },
    ],
  },
  {
    id: 'Public Infrastructure',
    name: 'Public Infrastructure',
    icon: 'account_balance',
    department: 'Public Works Department (PWD)',
    description: 'Damaged bus shelters, broken park benches, cracked foot-over-bridges, and civic facilities.',
    sampleSubcategories: ['Broken Bus Shelter', 'Damaged Park Facility', 'Cracked Footbridge', 'Unsafe Boundary Wall'],
    fields: [
      {
        name: 'facilityType',
        label: 'Public Facility Category',
        type: 'select',
        options: ['Transit Shelter', 'Public Park / Playground', 'Public Lavatory', 'Pedestrian Walkway'],
      },
    ],
  },
  {
    id: 'Construction',
    name: 'Construction',
    icon: 'construction',
    department: 'Municipal Town Planning & Vigilance',
    description: 'Unsafe excavation, abandoned construction debris, missing barricades, and encroachment.',
    sampleSubcategories: ['Unsafe Trench / Pit', 'Abandoned Building Debris', 'Missing Safety Barricade'],
    fields: [
      {
        name: 'safetyBarricade',
        label: 'Safety Perimeter Present?',
        type: 'select',
        options: ['Proper Warning Signage Present', 'Inadequate Warning', 'No Barricade / High Danger Pit'],
      },
    ],
  },
  {
    id: 'Traffic & Signage',
    name: 'Traffic & Signage',
    icon: 'traffic',
    department: 'Traffic Engineering & Control Department',
    description: 'Damaged traffic signals, missing directional boards, and hazardous road markers.',
    sampleSubcategories: ['Damaged Traffic Light', 'Missing Direction Board', 'Broken Divider / Guardrail'],
    fields: [
      {
        name: 'signalStatus',
        label: 'Traffic Signal Operational State',
        type: 'select',
        options: ['Blackout / Off', 'Blinking Fault', 'Physical Collision Damage'],
      },
    ],
  },
  {
    id: 'Environment',
    name: 'Environment',
    icon: 'forest',
    department: 'Environmental Protection & Forestry Department',
    description: 'Fallen trees blocking roads, water body pollution, and open waste burning.',
    sampleSubcategories: ['Fallen Tree Hazard', 'Water Body Dumping', 'Open Waste Burning', 'Hazardous Chemical Odor'],
    fields: [
      {
        name: 'urgencyLevel',
        label: 'Immediate Public Impact',
        type: 'select',
        options: ['Corridor Obstructed', 'Air Quality Deterioration', 'Drain / Stream Contamination'],
      },
    ],
  },
  {
    id: 'Other Civic Issues',
    name: 'Other Civic Issues',
    icon: 'help_outline',
    department: 'General Municipal Administration',
    description: 'Any other civic or municipal issue not covered under standard categories.',
    sampleSubcategories: ['Public Property Vandalism', 'Stray Animal Concern', 'Unclassified Grievance'],
    fields: [
      {
        name: 'priorityHint',
        label: 'Suggested Urgency',
        type: 'select',
        options: ['Standard Municipal SLA (48h)', 'Expedited (24h)', 'Urgent (Same Day)'],
      },
    ],
  },
];

// Sample landmarks for quick geofencing simulator
export const NAGPUR_LOCATIONS: NagpurLocation[] = [
  {
    road: 'Main Arterial Avenue',
    area: 'Central Commercial District',
    coords: '21.145800° N, 79.088200° E',
    ward: 'Ward 24 (Central Zone)',
  },
  {
    road: 'Transit Flyover Junction',
    area: 'Metro Interchange Corridor',
    coords: '21.146600° N, 79.082200° E',
    ward: 'Ward 12 (Transit Hub)',
  },
  {
    road: 'Hospital & Academic Boulevard',
    area: 'Civic Healthcare Campus',
    coords: '21.132800° N, 79.096400° E',
    ward: 'Ward 31 (Health Sector)',
  },
];

// Fresh start: ZERO fake mock reports! Real reports are stored and fetched dynamically.
export const INITIAL_REPORTS: CivicReport[] = [];
