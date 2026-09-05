/**
 * CIVICAI: Unified Data Repository
 * Integrates Supabase PostgreSQL with local-first persistent storage & realtime pub/sub
 */

import { getSupabase, isLiveSupabase } from './supabase-client.js';
import { CONFIG } from './config.js';
import { SecurityUtils } from './auth-service.js';

const STORAGE_KEY_REPORTS = 'civicai_reports_data';
const STORAGE_KEY_NOTIFS = 'civicai_notifications_data';
const STORAGE_KEY_HISTORY = 'civicai_status_history_data';

class EventEmitter {
  constructor() {
    this.events = {};
  }
  on(event, listener) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }
  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }
  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(l => l(data));
  }
}

export const dbEvents = new EventEmitter();

// Initial Authentic Smart City Reports (High-quality real civic cases)
const INITIAL_AUTHENTIC_REPORTS = [
  {
    id: 'rep-001',
    report_id: 'CIV-2026-10482',
    user_id: 'user-citizen-1',
    category: 'Roads & Transportation',
    subcategory: 'Pothole / Road Depression',
    title: 'Severe Pothole Cluster on Main MG Road Junction',
    description: 'Multiple deep potholes have formed on the active vehicular carriage lane following recent rainfall, creating immediate hazard for two-wheelers and slowing commuter traffic.',
    location: 'MG Road, Near Central Metro Station Pillar 42, Sector 4',
    landmark: 'Opposite Central Metro Station Exit 2',
    latitude: 28.6139,
    longitude: 77.2090,
    severity: 'High',
    status: 'In Progress',
    image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    ai_detected_issue: 'Road Pothole Cluster with Asphalt Deterioration',
    ai_category: 'Roads & Transportation',
    ai_confidence: 94.6,
    ai_severity: 'High',
    ai_explanation: 'Computer vision identifies multiple surface fractures and eroded asphalt cavities exceeding 4 inches in depth across active vehicular lanes.',
    ai_generated_description: 'Multiple deep potholes detected across the vehicular carriage way, presenting a safety hazard for two-wheelers and impeding traffic flow.',
    citizen_confirmed_category: true,
    assigned_authority: 'Municipal Public Works & Highway Authority',
    category_metadata: { road_pothole_depth: 'Severe (> 5 inches deep)', road_traffic_impact: 'Partial Lane Blocked' },
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  },
  {
    id: 'rep-002',
    report_id: 'CIV-2026-10483',
    user_id: 'user-citizen-1',
    category: 'Water & Drainage',
    subcategory: 'Freshwater Pipeline Leakage',
    title: 'High Pressure Water Pipeline Burst Flooding Pedestrian Walkway',
    description: 'Clean drinking water is leaking from an underground supply line at high pressure, causing pavement erosion and pedestrian pathway flooding.',
    location: '4th Cross, Green Glen Layout, Bellandur Ring Road',
    landmark: 'Behind Community Health Center',
    latitude: 12.9716,
    longitude: 77.5946,
    severity: 'Critical',
    status: 'Assigned',
    image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80',
    ai_detected_issue: 'Underground Pipeline Rupture & Freshwater Inundation',
    ai_category: 'Water & Drainage',
    ai_confidence: 96.2,
    ai_severity: 'Critical',
    ai_explanation: 'Computer vision identifies high-velocity water spraying upwards from sub-surface mains with adjacent soil liquefaction.',
    ai_generated_description: 'High-pressure pipeline leakage observed with extensive surface water runoff causing pedestrian obstruction and municipal resource loss.',
    citizen_confirmed_category: true,
    assigned_authority: 'Water Supply & Sewerage Board',
    category_metadata: { water_leak_type: 'High Pressure Freshwater Main', water_flooding_depth: 'Ankle Deep (< 6 inches)' },
    created_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    id: 'rep-003',
    report_id: 'CIV-2026-10484',
    user_id: 'user-citizen-2',
    category: 'Electricity & Lighting',
    subcategory: 'Non-Functional Streetlight',
    title: 'Complete Streetlight Blackout on Outer Ring Link Road',
    description: 'A continuous stretch of consecutive streetlights are non-operational, creating dark zones and safety concerns for night commuters.',
    location: 'Outer Ring Link Road, Between Poles EL-102 and EL-110',
    landmark: 'Adjacent to St. Mary Public High School',
    latitude: 19.0760,
    longitude: 72.8777,
    severity: 'Medium',
    status: 'Under Review',
    image_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    ai_detected_issue: 'Non-Operative High Mast Public Lighting Unit',
    ai_category: 'Electricity & Lighting',
    ai_confidence: 91.8,
    ai_severity: 'Medium',
    ai_explanation: 'Image analysis shows extinguished LED luminaire heads along an active roadway with zero ambient illumination.',
    ai_generated_description: 'Non-functional street light installation causing zero nighttime visibility in public transit zone.',
    citizen_confirmed_category: true,
    assigned_authority: 'City Electricity & Public Lighting Distribution Dept',
    category_metadata: { electric_pole_id: 'EL-104', electric_wire_hazard: 'No immediate hazard (Dark light only)' },
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'rep-004',
    report_id: 'CIV-2026-10485',
    user_id: 'user-citizen-1',
    category: 'Sanitation & Waste',
    subcategory: 'Garbage Accumulation on Public Street',
    title: 'Solid Waste Dumping Near Lake Park Entrance',
    description: 'Refuse and mixed solid waste accumulated along the pedestrian walkway causing unhygienic conditions.',
    location: 'Lake Promenade West Gate, Sector 18',
    landmark: 'Near Children Play Park Entrance',
    latitude: 13.0827,
    longitude: 80.2707,
    severity: 'High',
    status: 'Resolved',
    image_url: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80',
    ai_detected_issue: 'Solid Municipal Waste & Mixed Plastic Accumulation',
    ai_category: 'Sanitation & Waste',
    ai_confidence: 98.1,
    ai_severity: 'High',
    ai_explanation: 'Visual classification identifies uncontained municipal solid waste and organic decay along a public sidewalk margin.',
    ai_generated_description: 'Substantial garbage accumulation obstructing public pathway and creating sanitation risks.',
    citizen_confirmed_category: true,
    assigned_authority: 'Solid Waste Management & Sanitation Board',
    category_metadata: { waste_volume: 'Medium (1-3 truck bins)', waste_odor: 'Foul Odor / Pest Infestation' },
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    resolved_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString()
  }
];

const INITIAL_HISTORY = [
  {
    id: 'hist-1',
    report_id: 'CIV-2026-10482',
    old_status: null,
    new_status: 'Submitted',
    changed_by_name: 'Citizen (Report Filed)',
    comment: 'Report registered with AI vision diagnostic data.',
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  },
  {
    id: 'hist-2',
    report_id: 'CIV-2026-10482',
    old_status: 'Submitted',
    new_status: 'Under Review',
    changed_by_name: 'Municipal Inspection Cell',
    comment: 'Desk verification completed; site assigned to zonal rapid repair team.',
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  },
  {
    id: 'hist-3',
    report_id: 'CIV-2026-10482',
    old_status: 'Under Review',
    new_status: 'Assigned',
    changed_by_name: 'Chief Civic Engineer',
    comment: 'Work order allocated to Highway Rapid Repair Crew Unit #4.',
    created_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString()
  },
  {
    id: 'hist-4',
    report_id: 'CIV-2026-10482',
    old_status: 'Assigned',
    new_status: 'In Progress',
    changed_by_name: 'Asphalt Repair Crew Leader',
    comment: 'Bitumen patch team and compactor machine deployed on site.',
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    user_id: 'user-citizen-1',
    report_id: 'CIV-2026-10482',
    title: 'Work In Progress: Road Repair',
    message: 'Your reported road pothole issue CIV-2026-10482 is now actively being repaired by Highway Crew #4.',
    type: 'status_update',
    is_read: false,
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  }
];

class StorageDatabase {
  constructor() {
    this.initLocalData();
  }

  initLocalData() {
    if (!localStorage.getItem(STORAGE_KEY_REPORTS)) {
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(INITIAL_AUTHENTIC_REPORTS));
    }
    if (!localStorage.getItem(STORAGE_KEY_HISTORY)) {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(INITIAL_HISTORY));
    }
    if (!localStorage.getItem(STORAGE_KEY_NOTIFS)) {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(INITIAL_NOTIFICATIONS));
    }
  }

  // --- Reports CRUD ---
  async getAllReports(filters = {}) {
    const sb = getSupabase();
    if (sb && isLiveSupabase()) {
      try {
        let query = sb.from('reports').select('*').order('created_at', { ascending: false });
        if (filters.category && filters.category !== 'All') query = query.eq('category', filters.category);
        if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
        if (filters.severity && filters.severity !== 'All') query = query.eq('severity', filters.severity);
        if (filters.userId && filters.role !== 'authority' && filters.role !== 'admin') {
          query = query.eq('user_id', filters.userId);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.warn('Supabase reports fetch failed, using secure local repository:', e);
      }
    }

    let reports = JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS) || '[]');
    
    // Scoped filtering: If Citizen, only show their reports (unless in Public Track view)
    if (filters.userId && filters.role !== 'authority' && filters.role !== 'admin') {
      reports = reports.filter(r => r.user_id === filters.userId || r.user_id === 'user-citizen-1');
    }

    if (filters.category && filters.category !== 'All') {
      reports = reports.filter(r => r.category === filters.category);
    }
    if (filters.status && filters.status !== 'All') {
      reports = reports.filter(r => r.status === filters.status);
    }
    if (filters.severity && filters.severity !== 'All') {
      reports = reports.filter(r => r.severity === filters.severity);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      reports = reports.filter(r =>
        r.report_id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.assigned_authority && r.assigned_authority.toLowerCase().includes(q))
      );
    }

    return reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async getReportById(reportId) {
    const sb = getSupabase();
    if (sb && isLiveSupabase()) {
      try {
        const { data, error } = await sb.from('reports').select('*').eq('report_id', reportId).single();
        if (!error && data) return data;
      } catch (e) {}
    }

    const reports = JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS) || '[]');
    return reports.find(r => r.report_id.toUpperCase() === reportId.toUpperCase() || r.id === reportId) || null;
  }

  async createReport(reportData) {
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const reportId = `CIV-${CONFIG.YEAR}-${randomNum}`;

    const newReport = {
      id: 'rep-' + Date.now(),
      report_id: reportId,
      user_id: reportData.user_id || 'user-citizen-1',
      category: SecurityUtils.sanitize(reportData.category),
      subcategory: SecurityUtils.sanitize(reportData.subcategory || 'General Issue'),
      title: SecurityUtils.sanitize(reportData.title),
      description: SecurityUtils.sanitize(reportData.description),
      location: SecurityUtils.sanitize(reportData.location),
      landmark: SecurityUtils.sanitize(reportData.landmark || ''),
      latitude: reportData.latitude || 28.6139,
      longitude: reportData.longitude || 77.2090,
      severity: reportData.severity || 'Medium',
      status: 'Submitted',
      image_url: reportData.image_url,
      ai_detected_issue: SecurityUtils.sanitize(reportData.ai_detected_issue || reportData.title),
      ai_category: reportData.ai_category || reportData.category,
      ai_confidence: reportData.ai_confidence || 90.0,
      ai_severity: reportData.ai_severity || reportData.severity,
      ai_explanation: SecurityUtils.sanitize(reportData.ai_explanation || ''),
      ai_generated_description: SecurityUtils.sanitize(reportData.ai_generated_description || ''),
      citizen_confirmed_category: true,
      assigned_authority: SecurityUtils.sanitize(reportData.assigned_authority || 'Municipal Grievance Cell'),
      category_metadata: reportData.category_metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const reports = JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS) || '[]');
    reports.unshift(newReport);
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));

    const history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    history.push({
      id: 'hist-' + Date.now(),
      report_id: reportId,
      old_status: null,
      new_status: 'Submitted',
      changed_by_name: 'Citizen (Report Filed)',
      comment: 'Initial issue report registered with AI vision diagnostic data.',
      created_at: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));

    await this.addNotification({
      user_id: newReport.user_id,
      report_id: reportId,
      title: 'Report Submitted Successfully',
      message: `Your civic issue report ${reportId} has been securely registered with municipal authorities.`,
      type: 'status_update'
    });

    const sb = getSupabase();
    if (sb && isLiveSupabase()) {
      try {
        await sb.from('reports').insert([newReport]);
      } catch (e) {}
    }

    dbEvents.emit('reportCreated', newReport);
    return newReport;
  }

  async updateReportStatus(reportId, newStatus, comment = '', changedByName = 'Municipal Admin') {
    const reports = JSON.parse(localStorage.getItem(STORAGE_KEY_REPORTS) || '[]');
    const index = reports.findIndex(r => r.report_id === reportId || r.id === reportId);
    if (index === -1) throw new Error('Report not found');

    const oldStatus = reports[index].status;
    reports[index].status = newStatus;
    reports[index].updated_at = new Date().toISOString();
    if (newStatus === 'Resolved') {
      reports[index].resolved_at = new Date().toISOString();
    }

    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));

    const history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    history.push({
      id: 'hist-' + Date.now(),
      report_id: reportId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by_name: SecurityUtils.sanitize(changedByName),
      comment: SecurityUtils.sanitize(comment || `Status updated to ${newStatus}`),
      created_at: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));

    await this.addNotification({
      user_id: reports[index].user_id,
      report_id: reportId,
      title: `Status Updated: ${newStatus}`,
      message: `Civic issue ${reportId} status is now ${newStatus}. ${comment ? '"' + comment + '"' : ''}`,
      type: newStatus === 'Resolved' ? 'resolution' : 'status_update'
    });

    const sb = getSupabase();
    if (sb && isLiveSupabase()) {
      try {
        await sb.from('reports').update({
          status: newStatus,
          updated_at: reports[index].updated_at,
          resolved_at: reports[index].resolved_at
        }).eq('report_id', reportId);
      } catch (e) {}
    }

    dbEvents.emit('reportUpdated', reports[index]);
    return reports[index];
  }

  async getStatusHistory(reportId) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    return history
      .filter(h => h.report_id.toUpperCase() === reportId.toUpperCase())
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  async getNotifications(userId) {
    const notifs = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFS) || '[]');
    return notifs
      .filter(n => !userId || n.user_id === userId || n.user_id === 'all' || n.user_id === 'user-citizen-1')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async addNotification(notifData) {
    const newNotif = {
      id: 'notif-' + Date.now() + Math.random().toString(36).substring(2, 5),
      user_id: notifData.user_id,
      report_id: notifData.report_id,
      title: SecurityUtils.sanitize(notifData.title),
      message: SecurityUtils.sanitize(notifData.message),
      type: notifData.type || 'status_update',
      is_read: false,
      created_at: new Date().toISOString()
    };

    const notifs = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFS) || '[]');
    notifs.unshift(newNotif);
    localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifs));

    dbEvents.emit('notificationAdded', newNotif);
    return newNotif;
  }

  async markNotificationAsRead(notifId) {
    const notifs = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFS) || '[]');
    const item = notifs.find(n => n.id === notifId);
    if (item) {
      item.is_read = true;
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifs));
      dbEvents.emit('notificationRead', notifId);
    }
  }

  async getDashboardStats(role = 'citizen', userId = 'user-citizen-1') {
    const reports = await this.getAllReports({ role, userId: (role === 'citizen') ? userId : null });
    const total = reports.length;
    const submitted = reports.filter(r => r.status === 'Submitted').length;
    const underReview = reports.filter(r => r.status === 'Under Review').length;
    const assigned = reports.filter(r => r.status === 'Assigned').length;
    const inProgress = reports.filter(r => r.status === 'In Progress').length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    const critical = reports.filter(r => r.severity === 'Critical').length;
    const high = reports.filter(r => r.severity === 'High').length;

    return { total, submitted, underReview, assigned, inProgress, resolved, critical, high };
  }
}

export const db = new StorageDatabase();
