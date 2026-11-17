import { useMemo, useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { parseFdxXml, parseScriptText } from '../utils/scriptParser';

interface ScriptEditorModalProps {
  isOpen: boolean;
  initialMode: 'paste' | 'import';
  currentTitle: string;
  currentRawText: string;
  onClose: () => void;
  onApplyScript: (rawText: string, titleOverride?: string, isFdx?: boolean) => void;
}

export function ScriptEditorModal({
  isOpen,
  initialMode,
  currentTitle,
  currentRawText,
  onClose,
  onApplyScript,
}: ScriptEditorModalProps) {
  const [title, setTitle] = useState(currentTitle);
  const [draftText, setDraftText] = useState(currentRawText);
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string | null>(null);
  const [isFdxPayload, setIsFdxPayload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewStats = useMemo(() => {
    if (!draftText.trim()) {
      return { lines: 0, characters: 0, scenes: 0 };
    }
    const parsed = isFdxPayload
      ? parseFdxXml(draftText, title || 'Imported Screenplay')
      : parseScriptText(draftText, title || 'Untitled Script');
    return {
      lines: parsed.blocks.filter((b) => b.type === 'dialogue').length,
      characters: parsed.characters.length,
      scenes: parsed.blocks.filter((b) => b.type === 'scene').length,
    };
  }, [draftText, title, isFdxPayload]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setImportError(null);
    const lowerName = file.name.toLowerCase();
    const supported =
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.fountain') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.fdx');

    if (!supported) {
      setImportError(
        'Unsupported file format. Please import .txt, .fountain, .md, or .fdx (Final Draft) files.'
      );
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        setImportError('The selected file is empty.');
        return;
      }
      const cleanName = file.name.replace(/\.[^.]+$/, '');
      setImportedFileName(file.name);
      setTitle(cleanName);
      setIsFdxPayload(lowerName.endsWith('.fdx'));
      setDraftText(text);
    } catch {
      setImportError('Could not read the selected file.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftText.trim()) {
      setImportError('Please paste or import a script before applying.');
      return;
    }
    onApplyScript(draftText, title.trim() || undefined, isFdxPayload);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-editor-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2
              id="script-editor-modal-title"
              className="font-display text-lg font-semibold text-zinc-950"
            >
              {initialMode === 'import'
                ? 'Import or Paste Script'
                : 'Paste & Edit Script'}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Supports Fountain, standard screenplay, stage play (NAME: dialogue), and Final Draft (.fdx)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close script editor"
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-6 py-5 gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="modal-script-title"
                className="block text-xs font-medium text-zinc-700"
              >
                Script Title
              </label>
              <input
                id="modal-script-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., The Rain on 4th Street"
                className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-zinc-700">
                Import File (.txt, .fountain, .md, .fdx)
              </span>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className={`mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-1.5 transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/60'
                    : 'border-zinc-300 bg-zinc-50/70'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-600">
                  <FileText className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                  <span className="truncate">
                    {importedFileName || 'Drop script file here'}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.fountain,.md,.fdx"
                  aria-label="Choose script file to import"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Browse</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              <label
                htmlFor="modal-script-body"
                className="text-xs font-medium text-zinc-700"
              >
                Script Content
              </label>
              <button
                type="button"
                onClick={() => {
                  setDraftText('');
                  setIsFdxPayload(false);
                  setImportedFileName(null);
                  setImportError(null);
                }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                Clear editor
              </button>
            </div>
            <textarea
              id="modal-script-body"
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value);
                setIsFdxPayload(false);
                setImportError(null);
              }}
              rows={13}
              placeholder={`INT. COFFEE SHOP - NIGHT\n\nMARA\n(whispering, urgent)\nDid you bring the envelope?\n\nJULIAN (nervous): It's in my coat pocket.`}
              className="mt-1.5 w-full flex-1 resize-y rounded-lg border border-zinc-200 bg-zinc-50/40 p-3.5 font-mono text-[13px] leading-relaxed text-zinc-900 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/15"
            />
          </div>

          {importError && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {importError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500 tabular-nums">
              <span>{previewStats.characters} {previewStats.characters === 1 ? 'character' : 'characters'}</span>
              <span aria-hidden="true">·</span>
              <span>{previewStats.lines} {previewStats.lines === 1 ? 'dialogue line' : 'dialogue lines'}</span>
              <span aria-hidden="true">·</span>
              <span>{previewStats.scenes} {previewStats.scenes === 1 ? 'scene' : 'scenes'}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
              >
                Apply Script
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
