import React from 'react';
import {
  Activity,
  Bookmark,
  Box,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Compass,
  Disc,
  GitCommitHorizontal,
  Layers,
  Plus,
  RotateCw,
  Trash2,
} from 'lucide-react';
import type {
  PhysicsPresetId,
  SavedExperiment,
  SidebarSection,
} from '../types/simulation';

interface LeftSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeSection: SidebarSection;
  activePreset: PhysicsPresetId;
  onSelectSection: (section: SidebarSection) => void;
  savedExperiments: SavedExperiment[];
  onLoadExperiment: (exp: SavedExperiment) => void;
  onDeleteExperiment: (id: string) => void;
  onSaveCurrentExperiment: () => void;
}

const NAV_ITEMS: Array<{
  id: SidebarSection;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'workspace', label: 'Workspace', subtitle: 'Active bench', icon: Box },
  { id: 'mechanics', label: 'Mechanics', subtitle: 'Block forces & friction', icon: Compass },
  { id: 'rotational', label: 'Rotational Motion', subtitle: 'Hinged rod & torque', icon: RotateCw },
  { id: 'rolling', label: 'Rolling Motion', subtitle: 'Cylinder incline', icon: Disc },
  { id: 'pulley', label: 'Pulley Systems', subtitle: 'Atwood machine', icon: Layers },
  { id: 'collisions', label: 'Collisions', subtitle: '1D air track', icon: GitCommitHorizontal },
  { id: 'oscillations', label: 'Oscillations', subtitle: 'Pendulum dynamics', icon: Activity },
  { id: 'experiments', label: 'My Experiments', subtitle: 'Saved setups', icon: Bookmark },
];

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeSection,
  activePreset,
  onSelectSection,
  savedExperiments,
  onLoadExperiment,
  onDeleteExperiment,
  onSaveCurrentExperiment,
}) => {
  return (
    <aside
      aria-label="Physics Laboratory Navigation"
      className={`shrink-0 bg-[#0B101A] border-r border-slate-800/90 flex flex-col transition-[width] duration-200 ease-out z-20 ${
        collapsed ? 'w-14' : 'w-60'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-10 px-3 border-b border-slate-800/70 flex items-center justify-between shrink-0">
        {!collapsed && (
          <span className="text-xs font-medium text-slate-400 tracking-wide truncate">
            Modules & Presets
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto lab-scroll py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isCurrentPreset =
            item.id === activePreset ||
            (item.id === 'mechanics' && activePreset === 'block_surface');

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                isActive
                  ? 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/30'
                  : isCurrentPreset
                  ? 'bg-slate-800/50 text-slate-100 border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive || isCurrentPreset ? 'text-cyan-400' : 'text-slate-400'
                }`}
              />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate whitespace-nowrap">
                    {item.label}
                  </div>
                  {item.subtitle && (
                    <div className="text-[11px] text-slate-500 truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
              )}
              {!collapsed && isCurrentPreset && item.id !== activeSection && (
                <CircleDot className="w-3 h-3 text-cyan-400/70 shrink-0" />
              )}
            </button>
          );
        })}

        {/* Saved Experiments Drawer when My Experiments is selected */}
        {!collapsed && activeSection === 'experiments' && (
          <div className="mt-3 pt-3 border-t border-slate-800/80 px-1 space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-slate-400">
                Saved Experiments ({savedExperiments.length})
              </span>
              <button
                type="button"
                onClick={onSaveCurrentExperiment}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Save
              </button>
            </div>
            <div className="space-y-1.5">
              {savedExperiments.map((exp) => (
                <div
                  key={exp.id}
                  className="group bg-[#101724] border border-slate-800/90 rounded-md p-2 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => onLoadExperiment(exp)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-300 truncate transition-colors">
                      {exp.name}
                    </div>
                    <div className="text-[11px] text-slate-500 capitalize truncate">
                      {exp.preset}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteExperiment(exp.id)}
                    aria-label={`Delete experiment ${exp.name}`}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom Active Preset Info */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-500">
          <div className="flex items-center justify-between">
            <span>Active Scene</span>
            <span className="text-slate-300 font-medium capitalize">
              {activePreset === 'block_surface' ? 'Block Forces' : activePreset}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
