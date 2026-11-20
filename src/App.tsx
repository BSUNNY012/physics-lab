import { useMemo, useState } from 'react';
import { InspectorPanel } from './components/InspectorPanel';
import { LeftSidebar } from './components/LeftSidebar';
import { PhysicsViewport } from './components/PhysicsViewport';
import { QuestionPanel } from './components/QuestionPanel';
import { SettingsModal } from './components/SettingsModal';
import { TopNavBar } from './components/TopNavBar';
import { calculatePhysicsSnapshot } from './physics/calculations';
import { useLabStore } from './state/useLabStore';

export default function App() {
  const lab = useLabStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [questionExpanded, setQuestionExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const physicsSnapshot = useMemo(
    () =>
      calculatePhysicsSnapshot(
        lab.activePreset,
        lab.params,
        lab.simTime,
        lab.environment.loopDuration,
        lab.rotationalSimState
      ),
    [
      lab.activePreset,
      lab.params,
      lab.simTime,
      lab.environment.loopDuration,
      lab.rotationalSimState,
    ]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-[#080B11] text-slate-100 overflow-hidden">
      <TopNavBar
        workspaceName={lab.workspaceName}
        onRenameWorkspace={lab.renameWorkspace}
        isSaved={lab.isSaved}
        onSave={lab.saveWorkspace}
        canUndo={lab.canUndo}
        canRedo={lab.canRedo}
        onUndo={lab.undo}
        onRedo={lab.redo}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenExperiments={() => {
          setSidebarCollapsed(false);
          lab.selectSidebarSection('experiments');
        }}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <LeftSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          activeSection={lab.activeSection}
          activePreset={lab.activePreset}
          onSelectSection={lab.selectSidebarSection}
          savedExperiments={lab.savedExperiments}
          onLoadExperiment={lab.loadExperiment}
          onDeleteExperiment={lab.deleteExperiment}
          onSaveCurrentExperiment={lab.saveWorkspace}
        />

        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <QuestionPanel
            expanded={questionExpanded}
            onToggleExpand={() => setQuestionExpanded((e) => !e)}
            currentParams={lab.params}
            hasQuestionBaseline={Boolean(lab.questionBaseline)}
            onGenerateScene={lab.applyAnalyzedScene}
            onResetToQuestion={lab.resetToQuestionValues}
            onLoadSampleScene={lab.loadSampleRotationalProblem}
          />

          <PhysicsViewport
            activePreset={lab.activePreset}
            params={lab.params}
            environment={lab.environment}
            simTime={lab.simTime}
            rotationalSimState={lab.rotationalSimState}
            isPlaying={lab.isPlaying}
            simSpeed={lab.simSpeed}
            toolMode={lab.toolMode}
            selectedPart={lab.selectedPart}
            cameraProjection={lab.cameraProjection}
            cameraViewTrigger={lab.cameraViewTrigger}
            physicsSnapshot={physicsSnapshot}
            onSelectTool={lab.setToolMode}
            onSelectPart={lab.setSelectedPart}
            onDragSpherePosition={(pos) =>
              lab.updatePresetParams('rotational', { spherePosition: pos }, false)
            }
            onDragForceAngle={(angleDeg) =>
              lab.updatePresetParams('rotational', { forceAngle: angleDeg }, false)
            }
            onToggleGrid={() =>
              lab.updateEnvironment({ showGrid: !lab.environment.showGrid })
            }
            onToggleAxes={() =>
              lab.updateEnvironment({ showAxes: !lab.environment.showAxes })
            }
            onToggleVectors={() =>
              lab.updateEnvironment({
                showForceVectors: !lab.environment.showForceVectors,
              })
            }
            onToggleVectorLayer={lab.toggleVectorVisibility}
            onResetView={() => lab.triggerCameraView('isometric')}
            onToggleProjection={() =>
              lab.setCameraProjection(
                lab.cameraProjection === 'perspective' ? 'orthographic' : 'perspective'
              )
            }
            onSelectCameraPreset={lab.triggerCameraView}
            onTogglePlay={() => lab.setIsPlaying((p) => !p)}
            onResetSim={lab.resetSimulation}
            onChangeSpeed={lab.setSimSpeed}
            onScrubTime={lab.scrubSimulationTime}
          />
        </main>

        <InspectorPanel
          collapsed={inspectorCollapsed}
          onToggleCollapse={() => setInspectorCollapsed((c) => !c)}
          activePreset={lab.activePreset}
          selectedPart={lab.selectedPart}
          params={lab.params}
          onUpdateParams={(preset, patch) => lab.updatePresetParams(preset, patch)}
          environment={lab.environment}
          onUpdateEnvironment={(patch) => lab.updateEnvironment(patch)}
          onToggleVectorLayer={lab.toggleVectorVisibility}
          hasQuestionBaseline={Boolean(lab.questionBaseline)}
          onResetToQuestion={lab.resetToQuestionValues}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        environment={lab.environment}
        onUpdateEnvironment={(patch) => lab.updateEnvironment(patch)}
        onResetDefaults={lab.resetAllDefaults}
      />
    </div>
  );
}
