import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet.heat';
import { CivicReport, IncidentCategory, IncidentSeverity, IncidentStatus } from '../types';
import { CIVIC_CATEGORIES } from '../data/mockData';

interface CivicGisMapProps {
  reports: CivicReport[];
  selectedDepartment?: string;
  selectedWard?: string;
  onSelectReport?: (report: CivicReport) => void;
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

export const CivicGisMap: React.FC<CivicGisMapProps> = ({
  reports,
  selectedDepartment = 'all',
  selectedWard = 'all',
  onSelectReport,
  title = 'Interactive Civic Issue GIS Map',
  subtitle = 'Real-time geospatial intelligence, marker clustering, and incident density analytics',
  isLoading = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatLayerRef = useRef<any>(null);

  // Local Filters
  const [filterDepartment, setFilterDepartment] = useState<string>(selectedDepartment);
  const [filterWard, setFilterWard] = useState<string>(selectedWard);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeReportInModal, setActiveReportInModal] = useState<CivicReport | null>(null);

  // Sync props with local state
  useEffect(() => {
    setFilterDepartment(selectedDepartment);
  }, [selectedDepartment]);

  useEffect(() => {
    setFilterWard(selectedWard);
  }, [selectedWard]);

  // Extract dynamic departments and wards from real reports
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.department) set.add(r.department.trim());
    });
    return Array.from(set).sort();
  }, [reports]);

  const availableWards = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.ward) set.add(r.ward.trim());
    });
    return Array.from(set).sort();
  }, [reports]);

  // Filter reports
  const filteredReports = useMemo(() => {
    const now = Date.now();

    return reports.filter((r) => {
      if (filterDepartment !== 'all' && r.department !== filterDepartment) return false;
      if (filterWard !== 'all' && r.ward !== filterWard) return false;
      if (filterCategory !== 'all' && r.category !== filterCategory) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false;

      if (filterDateRange !== 'all') {
        const reportDate = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        if (reportDate === 0) return true;
        const diffHours = (now - reportDate) / (1000 * 3600);
        if (filterDateRange === 'today' && diffHours > 24) return false;
        if (filterDateRange === '7days' && diffHours > 24 * 7) return false;
        if (filterDateRange === '30days' && diffHours > 24 * 30) return false;
      }

      return true;
    });
  }, [reports, filterDepartment, filterWard, filterCategory, filterStatus, filterPriority, filterDateRange]);

  // Reports with valid GPS coordinates
  const validCoordinateReports = useMemo(() => {
    return filteredReports.filter(
      (r) =>
        r.latitude != null &&
        r.longitude != null &&
        !isNaN(r.latitude) &&
        !isNaN(r.longitude) &&
        r.latitude >= -90 &&
        r.latitude <= 90 &&
        r.longitude >= -180 &&
        r.longitude <= 180 &&
        !(r.latitude === 0 && r.longitude === 0)
    );
  }, [filteredReports]);

  const missingCoordinateCount = filteredReports.length - validCoordinateReports.length;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: India / Central urban zone (or first valid coordinate)
      const initialLat = validCoordinateReports[0]?.latitude || 21.1458;
      const initialLng = validCoordinateReports[0]?.longitude || 79.0882;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
      });

      // CartoDB Positron / OSM clean tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Add Zoom Control to bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Create Cluster Group
      const clusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          let c = 'bg-teal-700 text-white ring-4 ring-teal-700/20';
          if (count > 25) c = 'bg-rose-700 text-white ring-4 ring-rose-700/30';
          else if (count > 10) c = 'bg-amber-600 text-white ring-4 ring-amber-600/30';

          return L.divIcon({
            html: `<div class="${c} w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-lg border-2 border-white">${count}</div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40),
          });
        },
      });

      map.addLayer(clusterGroup);
      clusterGroupRef.current = clusterGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers and Heatmap whenever filtered reports or viewMode change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map) return;

    // Clear existing layers
    if (clusterGroup) {
      clusterGroup.clearLayers();
    }
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (validCoordinateReports.length === 0) return;

    if (viewMode === 'markers' && clusterGroup) {
      const markers: L.Marker[] = [];

      validCoordinateReports.forEach((report) => {
        const lat = report.latitude!;
        const lng = report.longitude!;

        // Priority colors
        let pinBg = '#0d9488'; // teal default
        let pinIcon = 'report';
        let ringColor = 'rgba(13, 148, 136, 0.4)';

        if (report.priority === 'CRITICAL') {
          pinBg = '#e11d48'; // crimson
          pinIcon = 'warning';
          ringColor = 'rgba(225, 29, 72, 0.5)';
        } else if (report.priority === 'HIGH') {
          pinBg = '#f97316'; // orange
          pinIcon = 'priority_high';
          ringColor = 'rgba(249, 115, 22, 0.4)';
        } else if (report.priority === 'MEDIUM') {
          pinBg = '#eab308'; // amber
          pinIcon = 'error_outline';
          ringColor = 'rgba(234, 179, 8, 0.4)';
        } else if (report.priority === 'LOW') {
          pinBg = '#10b981'; // emerald
          pinIcon = 'check_circle';
          ringColor = 'rgba(16, 185, 129, 0.4)';
        }

        const customIcon = L.divIcon({
          className: 'civic-marker-div',
          html: `
            <div style="position: relative; width: 34px; height: 34px;">
              <div style="
                background: ${pinBg};
                width: 32px;
                height: 32px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2.5px solid white;
                box-shadow: 0 4px 14px ${ringColor};
                cursor: pointer;
                transition: transform 0.15s ease;
              ">
                <span class="material-symbols-outlined" style="
                  transform: rotate(45deg);
                  color: white;
                  font-size: 16px;
                  font-weight: bold;
                ">${pinIcon}</span>
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32],
        });

        const marker = L.marker([lat, lng], { icon: customIcon });

        // Build rich popup content
        const createdDate = report.createdAt
          ? new Date(report.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : report.timestamp || 'Recent';

        const resolvedDate = report.resolvedAt
          ? new Date(report.resolvedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
          : report.status === 'RESOLVED'
          ? 'Completed'
          : 'Pending Resolution';

        const statusBg =
          report.status === 'RESOLVED'
            ? 'background:#d1fae5;color:#065f46;'
            : report.status === 'IN PROGRESS'
            ? 'background:#fef3c7;color:#92400e;'
            : 'background:#e0e7ff;color:#3730a3;';

        const priorityBg =
          report.priority === 'CRITICAL'
            ? 'background:#ffe4e6;color:#9f1239;'
            : report.priority === 'HIGH'
            ? 'background:#ffedd5;color:#9a3412;'
            : report.priority === 'MEDIUM'
            ? 'background:#fef9c3;color:#854d0e;'
            : 'background:#d1fae5;color:#065f46;';

        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-size: 12px; width: 280px; padding: 2px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9;">
              <span style="font-weight: 800; color: #0f766e; font-size: 13px; font-family: monospace;">${report.id}</span>
              <span style="padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; ${statusBg}">
                ${report.status}
              </span>
            </div>

            <div style="font-weight: 700; color: #0f172a; font-size: 13px; line-height: 1.3; margin-bottom: 6px;">
              ${report.title}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; font-size: 11px;">
              <div>
                <span style="color: #64748b; font-size: 10px; display: block;">Category</span>
                <strong style="color: #334155;">${report.category}</strong>
              </div>
              <div>
                <span style="color: #64748b; font-size: 10px; display: block;">Priority</span>
                <span style="padding: 1px 6px; border-radius: 6px; font-size: 10px; font-weight: 700; ${priorityBg}">
                  ${report.priority}
                </span>
              </div>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; margin-bottom: 8px; font-size: 11px;">
              <div style="color: #64748b; font-size: 10px;">Department</div>
              <div style="font-weight: 700; color: #0f766e;">🏢 ${report.department}</div>
              <div style="color: #64748b; font-size: 10px; margin-top: 4px;">Area / Ward</div>
              <div style="font-weight: 600; color: #1e293b;">📍 ${report.ward || 'Municipal Area'} • ${report.location}</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; color: #64748b; margin-bottom: 8px;">
              <div>Created: <strong style="color:#334155;">${createdDate}</strong></div>
              <div>Resolved: <strong style="color:#334155;">${resolvedDate}</strong></div>
            </div>

            <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-bottom: 8px;">
              GPS: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E
            </div>

            ${
              onSelectReport
                ? `<button id="btn-popup-manage-${report.id}" style="
                    width: 100%;
                    padding: 6px 12px;
                    background: #0f766e;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                  ">
                    Manage Complaint →
                  </button>`
                : ''
            }
          </div>
        `;

        marker.bindPopup(popupHtml, { maxWidth: 300 });

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-popup-manage-${report.id}`);
          if (btn && onSelectReport) {
            btn.onclick = () => {
              onSelectReport(report);
            };
          }
        });

        markers.push(marker);
      });

      clusterGroup.addLayers(markers);
    } else if (viewMode === 'heatmap') {
      // Create Heatmap points [lat, lng, intensity]
      const heatPoints: [number, number, number][] = validCoordinateReports.map((r) => {
        let intensity = 0.5;
        if (r.priority === 'CRITICAL') intensity = 1.0;
        else if (r.priority === 'HIGH') intensity = 0.8;
        else if (r.priority === 'MEDIUM') intensity = 0.5;
        else intensity = 0.3;

        return [r.latitude!, r.longitude!, intensity];
      });

      // @ts-ignore leaflet.heat plugin extends L
      if (typeof (L as any).heatLayer === 'function') {
        const heat = (L as any).heatLayer(heatPoints, {
          radius: 28,
          blur: 18,
          maxZoom: 17,
          gradient: {
            0.2: '#0284c7', // blue
            0.4: '#10b981', // green
            0.6: '#eab308', // yellow
            0.8: '#f97316', // orange
            1.0: '#e11d48', // red
          },
        });
        heat.addTo(map);
        heatLayerRef.current = heat;
      }
    }

    // Auto-fit bounds around filtered markers
    if (validCoordinateReports.length > 0) {
      const bounds = L.latLngBounds(validCoordinateReports.map((r) => [r.latitude!, r.longitude!]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [validCoordinateReports, viewMode, onSelectReport]);

  // Recenter Map Helper
  const handleRecenter = () => {
    if (!mapInstanceRef.current || validCoordinateReports.length === 0) return;
    const bounds = L.latLngBounds(validCoordinateReports.map((r) => [r.latitude!, r.longitude!]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  // Reset Filters Helper
  const handleResetFilters = () => {
    setFilterDepartment('all');
    setFilterWard('all');
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterDateRange('all');
  };

  return (
    <div
      className={`bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'w-full'
      }`}
    >
      {/* Map Header & Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">map</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
              <span className="bg-teal-100 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                {validCoordinateReports.length} Live Pins
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('markers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'markers'
                    ? 'bg-white text-teal-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                <span>Clusters</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('heatmap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'heatmap'
                    ? 'bg-white text-rose-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
                <span>Heatmap</span>
              </button>
            </div>

            {/* Recenter button */}
            <button
              type="button"
              onClick={handleRecenter}
              title="Recenter Map"
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">my_location</span>
            </button>

            {/* Fullscreen button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 shadow-xs transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                {isFullscreen ? 'close_fullscreen' : 'fullscreen'}
              </span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2 focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments ({availableDepartments.length})</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Area / Ward Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Ward / Zone
            </label>
            <select
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2 focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Wards ({availableWards.length})</option>
              {availableWards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2 focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {CIVIC_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2 focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="CRITICAL">Critical (Crimson)</option>
              <option value="HIGH">High (Orange)</option>
              <option value="MEDIUM">Medium (Amber)</option>
              <option value="LOW">Low (Emerald)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2 focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="REPORTED">REPORTED</option>
              <option value="UNDER REVIEW">UNDER REVIEW</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN PROGRESS">IN PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Timeframe
            </label>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value as any)}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2 focus:ring-2 focus:ring-teal-600 focus:outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Past 24 Hours</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Missing Coordinates Notification Banner */}
      {missingCoordinateCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-700">info</span>
            <span>
              <strong>{missingCoordinateCount}</strong> complaint{missingCoordinateCount > 1 ? 's have' : ' has'} pending GPS coordinates and will be tagged once on-site inspection completes.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] text-amber-800 underline font-semibold hover:text-amber-950"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Map Container & Overlays */}
      <div className="relative flex-1 min-h-[480px] sm:min-h-[560px] w-full bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full min-h-[480px] sm:min-h-[560px] z-10" />

        {/* Map Legend */}
        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200/80 text-xs flex flex-col gap-1.5 pointer-events-auto">
          <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">Priority Severity</span>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-600 ring-2 ring-rose-300" />
            <span className="font-medium text-slate-800 text-[11px]">Critical (24h SLA)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 ring-2 ring-orange-300" />
            <span className="font-medium text-slate-800 text-[11px]">High (48h SLA)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-200" />
            <span className="font-medium text-slate-800 text-[11px]">Medium (72h SLA)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-300" />
            <span className="font-medium text-slate-800 text-[11px]">Low (Resolved / Normal)</span>
          </div>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-30 bg-slate-900/20 backdrop-blur-xs flex items-center justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3">
              <span className="w-5 h-5 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-800">Synchronizing Spatial GIS Data...</span>
            </div>
          </div>
        )}

        {/* Empty State Overlay */}
        {!isLoading && validCoordinateReports.length === 0 && (
          <div className="absolute inset-0 z-20 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[32px]">wrong_location</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">No Incidents Found On Map</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              No complaints with verified geographic coordinates match your currently selected filters.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
