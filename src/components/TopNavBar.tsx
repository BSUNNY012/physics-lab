import React, { useState } from 'react';
import {
  Check,
  FolderOpen,
  Redo2,
  Save,
  Settings,
  Undo2,
} from 'lucide-react';

interface TopNavBarProps {
  workspaceName: string;
  onRenameWorkspace: (name: string) => void;
  isSaved: boolean;
  onSave: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSettings: () => void;
  onOpenExperiments: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  workspaceName,
  onRenameWorkspace,
  isSaved,
  onSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSettings,
  onOpenExperiments,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(workspaceName);

  const commitName = () => {
    setIsEditingName(false);
    onRenameWorkspace(draftName);
  };

  return (
    <header className="h-12 shrink-0 bg-[#0B101A] border-b border-slate-800/90 px-4 flex items-center justify-between gap-4 select-none z-30">
      {/* Brand Zone */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center shrink-0">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 text-cyan-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="2.2" />
            <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(30 12 12)" />
            <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(-30 12 12)" />
          </svg>
        </div>
        <span className="font-display font-semibold text-sm tracking-wider text-slate-100 whitespace-nowrap shrink-0">
          PHYSICS LAB
        </span>
      </div>

      {/* Workspace Name & History Controls */}
      <div className="flex items-center gap-3 min-w-0">
        {isEditingName ? (
          <input
            type="text"
            aria-label="Workspace name"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') {
                setDraftName(workspaceName);
                setIsEditingName(false);
              }
            }}
            className="bg-[#111827] border border-cyan-500/60 rounded px-2.5 py-1 text-xs font-medium text-slate-100 outline-none w-48"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(workspaceName);
              setIsEditingName(true);
            }}
            title="Click to rename workspace"
            className="px-2.5 py-1 rounded text-xs font-medium text-slate-200 hover:bg-slate-800/70 border border-transparent hover:border-slate-700/80 transition-colors truncate max-w-[220px] whitespace-nowrap"
          >
            {workspaceName}
          </button>
        )}

        <span className="text-slate-700 hidden sm:inline" aria-hidden="true">
          |
        </span>

        <button
          type="button"
          onClick={onSave}
          aria-label="Save simulation"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 border border-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          {isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Saved</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300">Save</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo"
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right Utility Zone */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenExperiments}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-200 bg-[#121927] hover:bg-[#192336] border border-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span>Saved Lab</span>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Laboratory Settings"
          title="Laboratory Settings"
          className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/70 transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
