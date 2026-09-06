import React, { useMemo, useState } from 'react';
import { CivicReport, DepartmentStats, IncidentSeverity, IncidentStatus } from '../types';
import { calculateDepartmentAnalytics, calculateOverallKPIs } from '../services/supabaseClient';
import { CivicGisMap } from './CivicGisMap';

interface DepartmentAnalyticsViewProps {
  reports: CivicReport[];
  onSelectReport?: (report: CivicReport) => void;
  onShowToast: (msg: string, icon?: string) => void;
  isLoading?: boolean;
}

export const DepartmentAnalyticsView: React.FC<DepartmentAnalyticsViewProps> = ({
  reports,
  onSelectReport,
  onShowToast,
  isLoading = false,
}) => {
  // State
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [sortField, setSortField] = useState<keyof DepartmentStats>('totalComplaints');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedWardForMap, setSelectedWardForMap] = useState<string>('all');

  // Compute department aggregations dynamically from real reports
  const allDepartmentStats = useMemo(() => {
    return calculateDepartmentAnalytics(reports);
  }, [reports]);

  // Compute Overall or Selected Department KPIs
  const kpis = useMemo(() => {
    return calculateOverallKPIs(reports, selectedDepartment);
  }, [reports, selectedDepartment]);

  // Filtered reports based on selected department
  const departmentFilteredReports = useMemo(() => {
    if (selectedDepartment === 'all') return reports;
    return reports.filter((r) => r.department === selectedDepartment);
  }, [reports, selectedDepartment]);

  // Category distribution for the selected department
  const categoryDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    departmentFilteredReports.forEach((r) => {
      counts.set(r.category, (counts.get(r.category) || 0) + 1);
    });

    const list = Array.from(counts.entries()).map(([category, count]) => ({
      category,
      count,
      percent: departmentFilteredReports.length > 0 ? Math.round((count / departmentFilteredReports.length) * 100) : 0,
    }));

    return list.sort((a, b) => b.count - a.count);
  }, [departmentFilteredReports]);

  // Priority distribution for the selected department
  const priorityDistribution = useMemo(() => {
    const critical = departmentFilteredReports.filter((r) => r.priority === 'CRITICAL').length;
    const high = departmentFilteredReports.filter((r) => r.priority === 'HIGH').length;
    const medium = departmentFilteredReports.filter((r) => r.priority === 'MEDIUM').length;
    const low = departmentFilteredReports.filter((r) => r.priority === 'LOW').length;
    const total = departmentFilteredReports.length || 1;

    return {
      critical,
      high,
      medium,
      low,
      criticalPct: Math.round((critical / total) * 100),
      highPct: Math.round((high / total) * 100),
      mediumPct: Math.round((medium / total) * 100),
      lowPct: Math.round((low / total) * 100),
    };
  }, [departmentFilteredReports]);

  // Area / Ward Ranking for the selected department
  const wardRanking = useMemo(() => {
    const wardMap = new Map<string, { total: number; open: number; resolved: number }>();

    departmentFilteredReports.forEach((r) => {
      const ward = r.ward || 'Central Municipal Zone';
      if (!wardMap.has(ward)) {
        wardMap.set(ward, { total: 0, open: 0, resolved: 0 });
      }
      const item = wardMap.get(ward)!;
      item.total++;
      if (r.status === 'RESOLVED') item.resolved++;
      else item.open++;
    });

    return Array.from(wardMap.entries())
      .map(([ward, data]) => ({
        ward,
        ...data,
        rate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [departmentFilteredReports]);

  // Table filtering and sorting
  const filteredTableStats = useMemo(() => {
    return allDepartmentStats
      .filter((dept) => {
        if (!searchTableQuery.trim()) return true;
        return dept.department.toLowerCase().includes(searchTableQuery.toLowerCase());
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [allDepartmentStats, searchTableQuery, sortField, sortAsc]);

  const handleSort = (field: keyof DepartmentStats) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Header & Department Filter Bar */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-50 text-teal-700 font-bold">
              <span className="material-symbols-outlined text-[24px]">analytics</span>
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Municipal Department Analytics</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real database performance benchmarking, resolution velocities, and SLA compliance across municipal authorities.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Department Selector / Filter */}
        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <div className="w-full sm:w-72">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Active Department Filter
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-teal-700 absolute left-3 top-2.5 pointer-events-none">
                corporate_fare
              </span>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedWardForMap('all');
                  if (e.target.value !== 'all') {
                    onShowToast(`Filtered by ${e.target.value}`, 'filter_alt');
                  } else {
                    onShowToast('Showing all municipal departments', 'globe');
                  }
                }}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-bold pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 transition-colors cursor-pointer"
              >
                <option value="all">🏢 All Departments ({allDepartmentStats.length})</option>
                {allDepartmentStats.map((dept) => (
                  <option key={dept.department} value={dept.department}>
                    {dept.department} ({dept.totalComplaints} tickets)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Department KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400">Total Workload</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{kpis.totalComplaints}</div>
          <span className="text-[10px] text-slate-500 mt-1">Reported complaints</span>
        </div>

        {/* Open */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-indigo-500">Open / New</span>
          <div className="text-2xl font-extrabold text-indigo-700 mt-2">{kpis.openComplaints}</div>
          <span className="text-[10px] text-indigo-400 mt-1">Pending assignment</span>
        </div>

        {/* In Progress */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-500">In Progress</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-2">{kpis.inProgressComplaints}</div>
          <span className="text-[10px] text-amber-500 mt-1">Crew dispatched</span>
        </div>

        {/* Resolved */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-500">Resolved</span>
          <div className="text-2xl font-extrabold text-emerald-700 mt-2">{kpis.resolvedComplaints}</div>
          <span className="text-[10px] text-emerald-500 mt-1">Closed tickets</span>
        </div>

        {/* Resolution Rate */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-teal-600">Resolution Rate</span>
          <div className="text-2xl font-extrabold text-teal-800 mt-2">{kpis.overallResolutionRate}%</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${kpis.overallResolutionRate}%` }}
            />
          </div>
        </div>

        {/* Avg Resolution Time */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-cyan-600">Avg Resolution</span>
          <div className="text-2xl font-extrabold text-cyan-800 mt-2">{kpis.avgResolutionFormatted}</div>
          <span className="text-[10px] text-cyan-600 mt-1">From log to fix</span>
        </div>

        {/* Critical */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-500">Critical Priority</span>
          <div className="text-2xl font-extrabold text-rose-700 mt-2">{kpis.criticalComplaints}</div>
          <span className="text-[10px] text-rose-400 mt-1">24h SLA response</span>
        </div>

        {/* Overdue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-red-600">Overdue SLA</span>
          <div className="text-2xl font-extrabold text-red-700 mt-2">{kpis.overdueComplaints}</div>
          <span className="text-[10px] text-red-500 mt-1">Exceeded timeline</span>
        </div>
      </div>

      {/* 1. Department Comparison Chart & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Comparison Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-[20px]">bar_chart</span>
                <h3 className="text-base font-bold text-slate-900">Department Workload & Resolution Comparison</h3>
              </div>
              <span className="text-xs text-slate-500">Real-time DB</span>
            </div>

            {/* Department Visual Bars */}
            <div className="space-y-4 pt-2">
              {allDepartmentStats.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No department data recorded in database.</div>
              ) : (
                allDepartmentStats.map((dept) => {
                  const isSelected = selectedDepartment === dept.department;
                  const total = dept.totalComplaints || 1;
                  const openPct = Math.round((dept.open / total) * 100);
                  const progressPct = Math.round((dept.inProgress / total) * 100);
                  const resolvedPct = Math.round((dept.resolved / total) * 100);

                  return (
                    <div
                      key={dept.department}
                      onClick={() => {
                        setSelectedDepartment(isSelected ? 'all' : dept.department);
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/70 border-teal-300 ring-2 ring-teal-500/20 shadow-xs'
                          : 'bg-slate-50/50 border-slate-200/80 hover:bg-slate-100/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{dept.department}</span>
                          {dept.overdueComplaints > 0 && (
                            <span className="bg-red-100 text-red-700 font-bold text-[10px] px-2 py-0.2 rounded-full">
                              {dept.overdueComplaints} Overdue
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <span className="text-slate-600">{dept.totalComplaints} complaints</span>
                          <span className="text-teal-700 font-bold">{dept.resolutionRate}% Resolved</span>
                          <span className="text-slate-400 font-normal">⏱️ {dept.avgResolutionTimeFormatted}</span>
                        </div>
                      </div>

                      {/* Multi-Segment Stacked Progress Bar */}
                      <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-600 h-full transition-all duration-500"
                          style={{ width: `${resolvedPct}%` }}
                          title={`Resolved: ${dept.resolved} (${resolvedPct}%)`}
                        />
                        <div
                          className="bg-amber-500 h-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                          title={`In Progress: ${dept.inProgress} (${progressPct}%)`}
                        />
                        <div
                          className="bg-indigo-500 h-full transition-all duration-500"
                          style={{ width: `${openPct}%` }}
                          title={`Open: ${dept.open} (${openPct}%)`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chart Legend */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600" />
                <span>Resolved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500" />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-indigo-500" />
                <span>Open / New</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 italic">Click a department bar to isolate metrics</span>
          </div>
        </div>

        {/* Right Col: Priority & Category Distribution */}
        <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex flex-col justify-between gap-6">
          {/* Priority Breakdown */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-rose-600 text-[20px]">crisis_alert</span>
              <h3 className="text-sm font-bold text-slate-900">
                Priority Distribution {selectedDepartment !== 'all' && `(${selectedDepartment})`}
              </h3>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-rose-700 font-bold">Critical Severity (24h SLA)</span>
                  <span className="font-bold text-slate-800">
                    {priorityDistribution.critical} ({priorityDistribution.criticalPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-600 h-full rounded-full" style={{ width: `${priorityDistribution.criticalPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-orange-700 font-bold">High Priority (48h SLA)</span>
                  <span className="font-bold text-slate-800">
                    {priorityDistribution.high} ({priorityDistribution.highPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: `${priorityDistribution.highPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-amber-700 font-bold">Medium Priority (72h SLA)</span>
                  <span className="font-bold text-slate-800">
                    {priorityDistribution.medium} ({priorityDistribution.mediumPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${priorityDistribution.mediumPct}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-emerald-700 font-bold">Low Priority</span>
                  <span className="font-bold text-slate-800">
                    {priorityDistribution.low} ({priorityDistribution.lowPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${priorityDistribution.lowPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Area / Ward Incident Ranking */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-teal-700">location_on</span>
                Ward Hotspot Ranking
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Top Zones</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {wardRanking.length === 0 ? (
                <div className="text-slate-400 text-xs text-center py-4">No ward records found</div>
              ) : (
                wardRanking.slice(0, 5).map((w, idx) => (
                  <div
                    key={w.ward}
                    onClick={() => {
                      setSelectedWardForMap(w.ward);
                      onShowToast(`Focused map on ${w.ward}`, 'my_location');
                    }}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-teal-50/60 border border-slate-200/60 transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate max-w-[120px]">{w.ward}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{w.total} tickets</span>
                      <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {w.rate}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized GIS Map for Selected Department */}
      <CivicGisMap
        reports={departmentFilteredReports}
        selectedDepartment={selectedDepartment}
        selectedWard={selectedWardForMap}
        onSelectReport={onSelectReport}
        title={
          selectedDepartment === 'all'
            ? 'Interactive Municipal Civic GIS Map'
            : `${selectedDepartment} Spatial Incident Map`
        }
        subtitle={
          selectedDepartment === 'all'
            ? 'Geospatial complaint density across all 9 municipal divisions'
            : `Showing live geo-tagged complaint clusters assigned to ${selectedDepartment}`
        }
      />

      {/* 2. Department Performance Table */}
      <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Header & Search */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="text-base font-bold text-slate-900">Department Performance & SLA Scorecard</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparative metrics calculated from verified database audit timestamps.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-2.5 pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Search department..."
              value={searchTableQuery}
              onChange={(e) => setSearchTableQuery(e.target.value)}
              className="w-full bg-white text-slate-900 text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700"
                  onClick={() => handleSort('department')}
                >
                  Department Name {sortField === 'department' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('totalComplaints')}
                >
                  Total Tickets {sortField === 'totalComplaints' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('open')}
                >
                  Open {sortField === 'open' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('inProgress')}
                >
                  In Progress {sortField === 'inProgress' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('resolved')}
                >
                  Resolved {sortField === 'resolved' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('resolutionRate')}
                >
                  Resolution Rate {sortField === 'resolutionRate' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('avgResolutionTimeHours')}
                >
                  Avg Turnaround {sortField === 'avgResolutionTimeHours' && (sortAsc ? '▲' : '▼')}
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:text-teal-700 text-right"
                  onClick={() => handleSort('overdueComplaints')}
                >
                  Overdue SLA {sortField === 'overdueComplaints' && (sortAsc ? '▲' : '▼')}
                </th>
                <th className="py-3.5 px-4 text-center">Health Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTableStats.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                    No departments found matching your search.
                  </td>
                </tr>
              ) : (
                filteredTableStats.map((dept) => {
                  const isSelected = selectedDepartment === dept.department;
                  const isGoodHealth = dept.resolutionRate >= 70 && dept.overdueComplaints === 0;
                  const isWarningHealth = dept.overdueComplaints > 0 || dept.resolutionRate < 50;

                  return (
                    <tr
                      key={dept.department}
                      onClick={() => {
                        setSelectedDepartment(isSelected ? 'all' : dept.department);
                      }}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isSelected ? 'bg-teal-50/40 font-bold' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-teal-700">corporate_fare</span>
                          <span className="font-bold text-slate-900">{dept.department}</span>
                          {isSelected && (
                            <span className="bg-teal-700 text-white text-[9px] font-bold px-1.5 py-0.2 rounded">
                              ACTIVE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">{dept.totalComplaints}</td>
                      <td className="py-3.5 px-4 text-right text-indigo-700 font-bold">{dept.open}</td>
                      <td className="py-3.5 px-4 text-right text-amber-700 font-bold">{dept.inProgress}</td>
                      <td className="py-3.5 px-4 text-right text-emerald-700 font-bold">{dept.resolved}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-slate-900">{dept.resolutionRate}%</span>
                          <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-teal-600 h-full rounded-full" style={{ width: `${dept.resolutionRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                        {dept.avgResolutionTimeFormatted}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {dept.overdueComplaints > 0 ? (
                          <span className="bg-red-100 text-red-700 font-bold text-[10px] px-2 py-0.5 rounded-full">
                            {dept.overdueComplaints} Breached
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isGoodHealth ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Compliant
                          </span>
                        ) : isWarningHealth ? (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Action Req.
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Moderate
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
