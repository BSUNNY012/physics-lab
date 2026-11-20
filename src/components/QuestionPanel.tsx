import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  isValidAnalyzedPhysicsProblem,
  parseAnalyzeQuestionHttpResponse,
} from '../ai/analyzeResponse';
import {
  buildSimulationPatchFromAnalysis,
  SCENE_ANALYZER_SAMPLES,
  type AnalyzedPhysicsProblem,
  type ValueSourceKind,
} from '../ai/sceneSchema';
import { SAMPLE_PHYSICS_QUESTION } from '../physics/calculations';
import type { LabSceneParams, PhysicsPresetId } from '../types/simulation';

interface QuestionPanelProps {
  expanded: boolean;
  onToggleExpand: () => void;
  currentParams: LabSceneParams;
  hasQuestionBaseline: boolean;
  onGenerateScene: (
    analysis: AnalyzedPhysicsProblem,
    preset: PhysicsPresetId,
    patch: Partial<LabSceneParams>,
    questionText: string
  ) => void;
  onResetToQuestion: () => void;
  onLoadSampleScene: () => void;
}

interface UploadedDiagram {
  name: string;
  mimeType: string;
  dataUrl: string;
  base64: string;
}

const SOURCE_LABELS: Record<ValueSourceKind, { label: string; cls: string }> = {
  explicit_text: { label: 'Text', cls: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  diagram: { label: 'Diagram', cls: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
  calculated: { label: 'Calc', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  assumed: { label: 'Assumed', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
};

export const QuestionPanel: React.FC<QuestionPanelProps> = ({
  expanded,
  onToggleExpand,
  currentParams,
  hasQuestionBaseline,
  onGenerateScene,
  onResetToQuestion,
  onLoadSampleScene,
}) => {
  const [questionText, setQuestionText] = useState<string>(SAMPLE_PHYSICS_QUESTION);
  const [uploadedImage, setUploadedImage] = useState<UploadedDiagram | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<AnalyzedPhysicsProblem | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, or WEBP).');
      e.target.value = '';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage('Image is larger than 12 MB. Please choose a smaller screenshot.');
      e.target.value = '';
      return;
    }

    const applyDataUrl = (dataUrl: string, mimeType: string) => {
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
      if (!base64) {
        setErrorMessage('Could not read the selected image file.');
        return;
      }
      setUploadedImage({
        name: file.name,
        mimeType,
        dataUrl,
        base64,
      });
      setErrorMessage(null);
      setStatusMessage(null);
    };

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setErrorMessage('Could not read the selected image file.');
        return;
      }
      // Compress large photos (> 3 MB) so base64 JSON stays well within server/proxy limits
      if (file.size > 3 * 1024 * 1024) {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1600;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            applyDataUrl(dataUrl, file.type || 'image/png');
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedUrl = canvas.toDataURL('image/jpeg', 0.88);
          applyDataUrl(compressedUrl, 'image/jpeg');
        };
        img.onerror = () => applyDataUrl(dataUrl, file.type || 'image/png');
        img.src = dataUrl;
        return;
      }
      applyDataUrl(dataUrl, file.type || 'image/png');
    };
    reader.onerror = () => {
      setErrorMessage('Failed to load the selected image.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!questionText.trim() && !uploadedImage) {
      setErrorMessage('Enter a physics question or upload a problem image first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/analyze-question', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          questionText: questionText.trim(),
          imageBase64: uploadedImage?.base64,
          imageMimeType: uploadedImage?.mimeType,
        }),
      });

      const contentType = res.headers.get('content-type');
      const rawBody = await res.text();
      const parsed = parseAnalyzeQuestionHttpResponse(res.status, contentType, rawBody, {
        redirected: res.redirected,
        url: res.url,
      });

      setAnalysis(parsed);

      if (parsed.imageReadabilityError) {
        setErrorMessage(parsed.imageReadabilityError);
      } else if (parsed.engineSupport === 'unsupported') {
        setErrorMessage(parsed.supportNote);
      } else {
        setStatusMessage(
          'Analysis ready. Review extracted objects, values, and assumptions, then click Generate 3D Simulation.'
        );
      }
    } catch (err) {
      let msg = 'Unable to analyze the physics problem right now.';
      if (err instanceof DOMException && err.name === 'AbortError') {
        msg = 'The analysis request timed out after 60 seconds. Please check your connection and try again.';
      } else if (err instanceof TypeError) {
        msg = 'Network error reaching /api/analyze-question. Verify the server is running and you are online.';
      } else if (err instanceof Error && err.message.trim() !== '') {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      window.clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const handleVariableChange = (idx: number, rawValue: string) => {
    if (!analysis) return;
    const trimmed = rawValue.trim();
    const num = trimmed === '' ? null : Number(trimmed);
    if (trimmed !== '' && !Number.isFinite(num)) return;

    setAnalysis({
      ...analysis,
      extractedVariables: analysis.extractedVariables.map((v, i) =>
        i === idx ? { ...v, value: num } : v
      ),
    });
  };

  const handleToggleAssumption = (idx: number) => {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      assumptions: analysis.assumptions.map((a, i) =>
        i === idx ? { ...a, enabled: !a.enabled } : a
      ),
    });
  };

  const handleGenerateSimulation = () => {
    if (!analysis) return;
    if (!isValidAnalyzedPhysicsProblem(analysis)) {
      setErrorMessage('Analyzed scene data is incomplete or invalid. Please re-analyze the question.');
      return;
    }
    const result = buildSimulationPatchFromAnalysis(analysis, currentParams);
    if (result.validationError) {
      setErrorMessage(result.validationError);
      return;
    }

    setErrorMessage(null);
    onGenerateScene(analysis, result.preset, result.patch, questionText);
    setStatusMessage(
      `3D simulation generated (${analysis.title}). Parameters loaded into Object Properties.`
    );
    if (expanded) {
      onToggleExpand();
    }
  };

  const handleSelectSample = (text: string) => {
    setQuestionText(text);
    setUploadedImage(null);
    setAnalysis(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleClear = () => {
    setQuestionText('');
    setUploadedImage(null);
    setAnalysis(null);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  return (
    <section
      aria-label="Physics Question Analyzer"
      className="shrink-0 bg-[#0D131F] border-b border-slate-800/90 z-20"
    >
      {/* Compact Header Strip */}
      <div className="h-9 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>Physics Question Analyzer</span>
          </button>
          {!expanded && (
            <span className="text-xs text-slate-400 truncate">
              {questionText.trim() || 'Paste a JEE physics problem or upload a diagram'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasQuestionBaseline && (
            <button
              type="button"
              onClick={onResetToQuestion}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-200 hover:text-cyan-300 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Reset to Question</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              handleSelectSample(SAMPLE_PHYSICS_QUESTION);
              onLoadSampleScene();
            }}
            className="px-2.5 py-1 rounded text-[11px] font-medium text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            Load Sample Preset
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {expanded && (
        <div className="px-4 pb-3 pt-1.5 border-t border-slate-800/60 space-y-2.5 max-h-[54vh] overflow-y-auto lab-scroll">
          {/* Quick Problem Samples */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mr-1">
              Quick Problems:
            </span>
            {SCENE_ANALYZER_SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample.text)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                  questionText.trim() === sample.text.trim()
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#111928] text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            <div className="flex-1 min-w-0">
              <label htmlFor="physics-question-textarea" className="sr-only">
                Physics problem description
              </label>
              <textarea
                id="physics-question-textarea"
                rows={2}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Paste a physics question here (e.g., uniform rod hinged at one end, pulley system, rolling cylinder, or block on rough surface)..."
                className="w-full bg-[#080C14] border border-slate-800 focus:border-cyan-500/60 rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none resize-none leading-relaxed"
              />
            </div>

            {uploadedImage && (
              <div className="w-full md:w-48 bg-[#080C14] border border-slate-800 rounded-md p-1.5 flex items-center gap-2 shrink-0">
                <img
                  src={uploadedImage.dataUrl}
                  alt={`Uploaded problem diagram: ${uploadedImage.name}`}
                  className="w-10 h-10 object-cover rounded border border-slate-700/70 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium text-slate-200 truncate">
                    {uploadedImage.name}
                  </div>
                  <div className="text-[10px] text-slate-500">Diagram attached</div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedImage(null)}
                  aria-label="Remove uploaded image"
                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap md:flex-col justify-between gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Physics...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze Question</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Upload physics diagram image"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-[#131B2B] hover:bg-[#192438] border border-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Upload Image</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear problem input"
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-rose-300 bg-[#131B2B] hover:bg-[#192438] border border-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start justify-between gap-2 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss error"
                className="text-rose-300/70 hover:text-rose-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && !errorMessage && (
            <p className="text-[11px] text-cyan-300/95 bg-cyan-500/8 border border-cyan-500/20 rounded px-2.5 py-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{statusMessage}</span>
            </p>
          )}

          {/* Structured Question Analysis Review */}
          {analysis && (
            <div
              data-testid="question-analysis-summary"
              className="bg-[#090E17] border border-slate-800/90 rounded-lg p-3 space-y-3"
            >
              {/* Summary Header */}
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <h2 className="text-xs font-semibold text-slate-100">
                      Question Analysis: {analysis.title}
                    </h2>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {analysis.sceneType.replace(/_/g, ' ')}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        analysis.engineSupport === 'full'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : analysis.engineSupport === 'partial'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {analysis.engineSupport === 'full'
                        ? 'Full Engine Match'
                        : analysis.engineSupport === 'partial'
                        ? 'Assumptions / Clarification'
                        : 'Unsupported System'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {analysis.summary}
                  </p>
                </div>

                {analysis.engineSupport !== 'unsupported' && !analysis.imageReadabilityError && (
                  <button
                    type="button"
                    onClick={handleGenerateSimulation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Generate 3D Simulation</span>
                  </button>
                )}
              </div>

              {/* Missing Info Warnings */}
              {analysis.missingInformation.length > 0 && (
                <div className="bg-amber-500/8 border border-amber-500/30 rounded-md p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Missing Information / Editable Defaults Applied</span>
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-amber-200/90 pl-5 list-disc">
                    {analysis.missingInformation.map((item) => (
                      <li key={item.id}>
                        <span className="font-medium text-amber-200">{item.field}:</span>{' '}
                        {item.prompt}
                        {item.suggestedDefault !== undefined && (
                          <span className="font-mono text-amber-300/90 ml-1">
                            (default: {item.suggestedDefault} {item.unit ?? ''})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diagram Insights */}
              {analysis.diagramInsights.length > 0 && (
                <div className="bg-violet-500/8 border border-violet-500/25 rounded-md p-2 text-[11px]">
                  <div className="font-semibold text-violet-300 mb-1">Diagram Interpretation</div>
                  <ul className="space-y-0.5 text-slate-300 pl-4 list-disc">
                    {analysis.diagramInsights.map((insight, i) => (
                      <li key={i}>{insight}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 3-Column Compact Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Detected Objects & Connections */}
                <div className="bg-[#0D131F] border border-slate-800/80 rounded-md p-2.5 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Detected Objects &amp; Connections
                  </div>
                  <div className="space-y-1.5">
                    {analysis.objects.map((obj) => (
                      <div
                        key={obj.id}
                        className="flex items-center justify-between gap-2 text-[11px] bg-[#080C14] border border-slate-800/70 rounded px-2 py-1"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-200 truncate">{obj.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {obj.type.replace(/_/g, ' ')}
                            {obj.mass !== undefined ? ` · m=${obj.mass}kg` : ''}
                            {obj.length !== undefined ? ` · L=${obj.length}m` : ''}
                            {obj.radius !== undefined ? ` · r=${obj.radius}m` : ''}
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono border shrink-0 ${
                            SOURCE_LABELS[obj.source].cls
                          }`}
                        >
                          {SOURCE_LABELS[obj.source].label}
                        </span>
                      </div>
                    ))}
                    {analysis.connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="text-[11px] text-slate-400 bg-[#080C14]/70 border border-slate-800/60 rounded px-2 py-1"
                      >
                        <span className="text-cyan-400 font-mono text-[10px] mr-1.5">
                          [{conn.type.replace(/_/g, ' ')}]
                        </span>
                        {conn.description}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable Extracted Values */}
                <div className="bg-[#0D131F] border border-slate-800/80 rounded-md p-2.5 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Extracted Parameters (Editable)
                  </div>
                  <div className="space-y-1.5">
                    {analysis.extractedVariables.map((variable, idx) => (
                      <div
                        key={`${variable.key}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <label
                          htmlFor={`extracted-var-${idx}`}
                          className="text-slate-300 truncate flex-1"
                          title={variable.label}
                        >
                          {variable.label}
                        </label>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            id={`extracted-var-${idx}`}
                            type="text"
                            inputMode="decimal"
                            value={variable.value === null ? '' : String(variable.value)}
                            placeholder="—"
                            onChange={(e) => handleVariableChange(idx, e.target.value)}
                            className="w-16 bg-[#080C14] border border-slate-700 focus:border-cyan-400 rounded px-1.5 py-0.5 text-right font-mono-tabular text-[11px] text-slate-100 outline-none"
                          />
                          <span className="w-9 text-[10px] font-mono text-slate-400 truncate">
                            {variable.unit}
                          </span>
                          <span
                            className={`px-1 py-0.5 rounded text-[9px] font-mono border ${
                              SOURCE_LABELS[variable.source].cls
                            }`}
                          >
                            {SOURCE_LABELS[variable.source].label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assumptions, Equations & Unknowns */}
                <div className="bg-[#0D131F] border border-slate-800/80 rounded-md p-2.5 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                    Assumptions &amp; Equations
                  </div>
                  <div className="space-y-1">
                    {analysis.assumptions.map((assumption, idx) => (
                      <label
                        key={assumption.id}
                        className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={assumption.enabled}
                          disabled={!assumption.editable}
                          onChange={() => handleToggleAssumption(idx)}
                          className="accent-cyan-400 mt-0.5 w-3.5 h-3.5 shrink-0 cursor-pointer"
                        />
                        <span className="leading-snug">{assumption.statement}</span>
                      </label>
                    ))}
                  </div>

                  {analysis.equations.length > 0 && (
                    <div className="pt-1.5 border-t border-slate-800/70 space-y-0.5">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">
                        Governing Equations
                      </div>
                      {analysis.equations.slice(0, 3).map((eq, i) => (
                        <div key={i} className="text-[11px] font-mono text-cyan-300/90 truncate">
                          {eq}
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis.unknowns.length > 0 && (
                    <div className="pt-1 border-t border-slate-800/70 text-[11px] text-slate-400">
                      <span className="text-slate-500 font-mono text-[10px] mr-1">FIND:</span>
                      <span className="text-slate-200">{analysis.unknowns.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
