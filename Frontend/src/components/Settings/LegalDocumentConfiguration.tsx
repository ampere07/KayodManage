import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  History,
  FileWarning,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import {
  useLegalDocuments,
  useUpdateLegalDocument,
  useResetLegalDocument,
  LEGAL_DOCUMENTS_KEY,
} from '../../hooks/useLegalDocuments';
import type {
  LegalBlock,
  LegalBlockType,
  LegalDocument,
  LegalSection,
} from '../../types/configuration.types';
import { useSocket } from '../../context/SocketContext';

/**
 * LegalDocumentConfiguration — edit the five agreements the Kayod app shows.
 *
 * ── What this is for, and the caution that comes with it ─────────────────────
 *
 * These are executed contracts, not marketing copy. Editing them changes what
 * users are shown at sign-up, at booking, and at payout — which is why the
 * editor is built around three ideas rather than being a free text box:
 *
 *   1. Structure is preserved. Clause numbering is derived from the section
 *      number, so an editor cannot renumber prose into disagreeing with the
 *      citation a support agent quotes. Blocks are typed, and the API rejects
 *      anything the app's renderer would silently drop.
 *   2. Substantive changes are versioned. The version field is what a recorded
 *      acceptance is stamped with; a typo fix leaves it alone (the revision
 *      still climbs), an amendment bumps it. The Terms themselves say
 *      amendments take effect on posting with notice, so the two need to be
 *      separable.
 *   3. There is always a way back. "Restore shipped version" returns a document
 *      to the text compiled into the app — the version counsel executed.
 *
 * The shipped text also travels with the app as an offline fallback, so a
 * document edited here and a client that cannot reach the API will disagree
 * until it reconnects. That is deliberate — the alternative is a legal screen
 * that shows nothing — and the app labels the fallback when it uses it.
 */

const BLOCK_LABELS: Record<LegalBlockType, string> = {
  p: 'Paragraph',
  clauses: 'Numbered clauses',
  bullets: 'Bulleted list',
  sub: 'Sub-heading',
  table: 'Table',
};

const emptyBlock = (type: LegalBlockType): LegalBlock => {
  switch (type) {
    case 'p':
      return { type: 'p', text: '' };
    case 'clauses':
      return { type: 'clauses', items: [''] };
    case 'bullets':
      return { type: 'bullets', items: [''] };
    case 'sub':
      return { type: 'sub', title: '', blocks: [{ type: 'p', text: '' }] };
    case 'table':
      return { type: 'table', head: ['', '', ''], rows: [['', '', '']] };
  }
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// ─── Small inputs ────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="mb-4">
    <label className="block text-[11px] font-black uppercase tracking-widest text-gray-700 mb-1">
      {label}
    </label>
    {hint ? <p className="text-xs text-gray-400 mb-2">{hint}</p> : null}
    {children}
  </div>
);

const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  />
);

const TextArea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}> = ({ value, onChange, rows = 3, placeholder }) => (
  <textarea
    value={value}
    rows={rows}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  />
);

const IconButton: React.FC<{
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, title, disabled, danger, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`p-1.5 rounded-md border border-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
      danger
        ? 'text-red-500 hover:bg-red-50 hover:border-red-200'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

// ─── Block editor ────────────────────────────────────────────────────────────

/**
 * One block. Recursive, because a "sub" block carries its own blocks —
 * Schedule A §3 and Privacy Policy §2 are both a lead-in paragraph followed by
 * titled sub-parts with their own lists.
 *
 * `clauseNumber` is the section number, shown as read-only "5.1", "5.2" markers
 * so an editor sees the citation their text will be quoted under without being
 * able to type a number that disagrees with its position.
 */
const BlockEditor: React.FC<{
  block: LegalBlock;
  clauseNumber: number | null;
  onChange: (next: LegalBlock) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}> = ({ block, clauseNumber, onChange, onRemove, onMove, canMoveUp, canMoveDown }) => {
  const updateItems = (items: string[]) =>
    onChange({ ...block, items } as LegalBlock);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {BLOCK_LABELS[block.type]}
        </span>
        <div className="flex items-center gap-1">
          <IconButton onClick={() => onMove(-1)} title="Move up" disabled={!canMoveUp}>
            <ChevronUp className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton onClick={() => onMove(1)} title="Move down" disabled={!canMoveDown}>
            <ChevronDown className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton onClick={onRemove} title="Delete block" danger>
            <Trash2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>

      {block.type === 'p' && (
        <TextArea
          value={block.text}
          rows={4}
          onChange={(text) => onChange({ ...block, text })}
        />
      )}

      {(block.type === 'clauses' || block.type === 'bullets') && (
        <div className="space-y-2">
          {block.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-2 w-9 shrink-0 text-xs font-semibold text-gray-400">
                {block.type === 'clauses' && clauseNumber
                  ? `${clauseNumber}.${index + 1}`
                  : '•'}
              </span>
              <div className="flex-1">
                <TextArea
                  value={item}
                  rows={3}
                  onChange={(text) => {
                    const next = [...block.items];
                    next[index] = text;
                    updateItems(next);
                  }}
                />
              </div>
              <IconButton
                onClick={() => updateItems(block.items.filter((_, i) => i !== index))}
                title="Delete item"
                disabled={block.items.length <= 1}
                danger
              >
                <Trash2 className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            onClick={() => updateItems([...block.items, ''])}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {block.type === 'clauses' ? 'clause' : 'item'}
          </button>
        </div>
      )}

      {block.type === 'sub' && (
        <div>
          <Field label="Sub-heading">
            <TextInput
              value={block.title}
              placeholder="3.1  Category A – Outcome-Based Services"
              onChange={(title) => onChange({ ...block, title })}
            />
          </Field>
          <div className="pl-4 border-l-2 border-gray-100">
            <BlockList
              blocks={block.blocks}
              // Sub-parts carry prose and bullets, never numbered clauses —
              // matching the client renderer, which passes no section number
              // into a sub-block for the same reason.
              clauseNumber={null}
              onChange={(blocks) => onChange({ ...block, blocks })}
            />
          </div>
        </div>
      )}

      {block.type === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {block.head.map((cell, index) => (
                  <th key={index} className="p-1 align-top">
                    <TextInput
                      value={cell}
                      onChange={(text) => {
                        const head = [...block.head];
                        head[index] = text;
                        onChange({ ...block, head });
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="p-1 align-top">
                      <TextArea
                        value={cell}
                        rows={2}
                        onChange={(text) => {
                          const rows = clone(block.rows);
                          rows[rowIndex][cellIndex] = text;
                          onChange({ ...block, rows });
                        }}
                      />
                    </td>
                  ))}
                  <td className="p-1 align-top">
                    <IconButton
                      onClick={() =>
                        onChange({
                          ...block,
                          rows: block.rows.filter((_, i) => i !== rowIndex),
                        })
                      }
                      title="Delete row"
                      disabled={block.rows.length <= 1}
                      danger
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...block,
                // New rows match the header width. A ragged table renders cells
                // under the wrong heading, and the API rejects one anyway.
                rows: [...block.rows, block.head.map(() => '')],
              })
            }
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add row
          </button>
        </div>
      )}
    </div>
  );
};

const BlockList: React.FC<{
  blocks: LegalBlock[];
  clauseNumber: number | null;
  onChange: (blocks: LegalBlock[]) => void;
}> = ({ blocks, clauseNumber, onChange }) => {
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {blocks.map((block, index) => (
        <BlockEditor
          key={index}
          block={block}
          clauseNumber={clauseNumber}
          canMoveUp={index > 0}
          canMoveDown={index < blocks.length - 1}
          onMove={(direction) => move(index, direction)}
          onRemove={() => onChange(blocks.filter((_, i) => i !== index))}
          onChange={(next) => {
            const updated = [...blocks];
            updated[index] = next;
            onChange(updated);
          }}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2 mt-1">
        <span className="text-xs text-gray-400">Add block:</span>
        {(Object.keys(BLOCK_LABELS) as LegalBlockType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange([...blocks, emptyBlock(type)])}
            className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Section editor ──────────────────────────────────────────────────────────

const SectionEditor: React.FC<{
  section: LegalSection;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (next: LegalSection) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}> = ({ section, isOpen, onToggle, onChange, onRemove, onMove, canMoveUp, canMoveDown }) => (
  <div className="rounded-xl border border-gray-200 mb-3 bg-gray-50/50">
    <div className="flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 flex items-center gap-2 text-left"
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 rotate-90" />
        )}
        <span className="text-sm font-semibold text-gray-900">
          {section.number ? `${section.number}. ` : ''}
          {section.title || <span className="text-red-500">Untitled section</span>}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">{section.id}</span>
      </button>
      <IconButton onClick={() => onMove(-1)} title="Move up" disabled={!canMoveUp}>
        <ChevronUp className="w-3.5 h-3.5" />
      </IconButton>
      <IconButton onClick={() => onMove(1)} title="Move down" disabled={!canMoveDown}>
        <ChevronDown className="w-3.5 h-3.5" />
      </IconButton>
      <IconButton onClick={onRemove} title="Delete section" danger>
        <Trash2 className="w-3.5 h-3.5" />
      </IconButton>
    </div>

    {isOpen && (
      <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-white rounded-b-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field
            label="Number"
            hint="0 leaves the section unnumbered."
          >
            <TextInput
              value={String(section.number ?? 0)}
              onChange={(value) =>
                onChange({ ...section, number: Number(value.replace(/\D/g, '')) || 0 })
              }
            />
          </Field>
          <Field label="Title">
            <TextInput
              value={section.title}
              onChange={(title) => onChange({ ...section, title })}
            />
          </Field>
          <Field
            label="Section id"
            hint="Deep-link target. Renaming it breaks links that open this clause."
          >
            <TextInput
              value={section.id}
              onChange={(id) => onChange({ ...section, id })}
            />
          </Field>
        </div>

        <BlockList
          blocks={section.blocks}
          clauseNumber={section.number || null}
          onChange={(blocks) => onChange({ ...section, blocks })}
        />
      </div>
    )}
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────────

const LegalDocumentConfiguration: React.FC = () => {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { documents, sourceVersion, isLoading } = useLegalDocuments();
  const updateMutation = useUpdateLegalDocument();
  const resetMutation = useResetLegalDocument();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<LegalDocument | null>(null);
  const [baseline, setBaseline] = useState<LegalDocument | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const isDirty = useMemo(
    () => !!form && !!baseline && JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    if (documents.length === 0) return;
    if (!selectedId) setSelectedId(documents[0].documentId);
  }, [documents, selectedId]);

  useEffect(() => {
    const server = documents.find((doc) => doc.documentId === selectedId);
    if (!server) return;
    // Never clobber an in-progress edit with a background refetch: legal text is
    // long-form, and losing ten minutes of it to a poll is unforgivable.
    setForm((current) =>
      current === null || current.documentId !== selectedId || !isDirtyRef.current
        ? clone(server)
        : current
    );
    setBaseline(clone(server));
  }, [documents, selectedId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data?.type === 'legal-documents') {
        queryClient.invalidateQueries({ queryKey: [LEGAL_DOCUMENTS_KEY] });
      }
    };
    socket.on('configuration:updated', handler);
    return () => {
      socket.off('configuration:updated', handler);
    };
  }, [socket, queryClient]);

  // Mirrors the API's validator so an editor sees the problem before saving
  // rather than as a rejected request. The API remains the authority.
  const validationError = useMemo(() => {
    if (!form) return null;
    if (!form.title.trim()) return 'The document needs a title.';
    if (!form.shortTitle.trim()) return 'The document needs a short title.';
    if (!form.intro.trim()) return 'The document needs an introduction.';
    if (form.sections.length === 0) return 'A document needs at least one section.';

    const ids = new Set<string>();
    for (const section of form.sections) {
      if (!section.id.trim()) return 'Every section needs an id.';
      if (ids.has(section.id)) return `Two sections share the id "${section.id}".`;
      ids.add(section.id);
      if (!section.title.trim()) return `Section "${section.id}" needs a title.`;
      if (section.blocks.length === 0)
        return `Section "${section.id}" needs at least one block.`;
    }
    return null;
  }, [form]);

  const handleSave = () => {
    if (!form || !isDirty || validationError) return;
    updateMutation.mutate({
      documentId: form.documentId,
      data: {
        title: form.title,
        shortTitle: form.shortTitle,
        subtitle: form.subtitle,
        intro: form.intro,
        sections: form.sections,
        version: form.version,
      },
    });
  };

  const handleDiscard = () => {
    if (baseline) setForm(clone(baseline));
  };

  const handleReset = () => {
    if (!form) return;
    const confirmed = window.confirm(
      `Restore "${form.shortTitle}" to the version that shipped with the app?\n\n` +
        'This discards every admin edit to this document and returns it to the ' +
        'text compiled into the current release.'
    );
    if (confirmed) resetMutation.mutate(form.documentId);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    if (!form) return;
    const target = index + direction;
    if (target < 0 || target >= form.sections.length) return;
    const sections = [...form.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setForm({ ...form, sections });
  };

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const canSave = isDirty && !validationError && !updateMutation.isPending;
  const isEdited = !!sourceVersion && form.sourceVersion !== form.version;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 h-[65px] border-b border-gray-100">
        <div className="text-xs text-gray-400">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          ) : (
            <span>
              {form.updatedAt
                ? `Revision ${form.revision} · updated ${new Date(form.updatedAt).toLocaleString()}`
                : 'Not yet edited'}
              {form.updatedBy ? ` by ${form.updatedBy}` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Restore shipped version
          </button>
          <button
            onClick={handleDiscard}
            disabled={!isDirty || updateMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Document picker */}
        <div className="w-56 shrink-0 border-r border-gray-100 overflow-y-auto py-3">
          {documents.map((doc) => {
            const isActive = doc.documentId === selectedId;
            return (
              <button
                key={doc.documentId}
                onClick={() => setSelectedId(doc.documentId)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold border-l-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 border-l-2 border-transparent'
                }`}
              >
                <div className="truncate">{doc.shortTitle}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {doc.sections.length} sections · v{doc.version}
                </div>
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6 max-w-4xl">
            {validationError && (
              <div className="mb-6 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {validationError}
              </div>
            )}

            {isEdited && (
              <div className="mb-6 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <FileWarning className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  This document has been edited away from the version that
                  shipped with the app (v{form.sourceVersion}). Users who cannot
                  reach the server will see the shipped text instead, labelled
                  as such.
                </span>
              </div>
            )}

            <Field label="Title" hint="The full title, as printed on the document.">
              <TextInput
                value={form.title}
                onChange={(title) => setForm({ ...form, title })}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Short title" hint="Used on list rows and consent links.">
                <TextInput
                  value={form.shortTitle}
                  onChange={(shortTitle) => setForm({ ...form, shortTitle })}
                />
              </Field>
              <Field
                label="Version"
                hint="Bump this for a substantive amendment. Acceptances are recorded against it; a typo fix should leave it alone."
              >
                <TextInput
                  value={form.version}
                  onChange={(version) => setForm({ ...form, version })}
                />
              </Field>
            </div>

            <Field label="Subtitle" hint="Optional line under the title.">
              <TextInput
                value={form.subtitle}
                onChange={(subtitle) => setForm({ ...form, subtitle })}
              />
            </Field>

            <Field
              label="Introduction"
              hint="The unnumbered preamble shown above the sections."
            >
              <TextArea
                value={form.intro}
                rows={6}
                onChange={(intro) => setForm({ ...form, intro })}
              />
            </Field>

            <div className="mt-8 mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-700">
                Sections
              </h3>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    sections: [
                      ...form.sections,
                      {
                        id: `section-${form.sections.length + 1}`,
                        number: form.sections.length + 1,
                        title: '',
                        blocks: [{ type: 'p', text: '' }],
                      },
                    ],
                  })
                }
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add section
              </button>
            </div>

            {form.sections.map((section, index) => (
              <SectionEditor
                key={`${section.id}-${index}`}
                section={section}
                isOpen={openSection === section.id}
                onToggle={() =>
                  setOpenSection((prev) => (prev === section.id ? null : section.id))
                }
                canMoveUp={index > 0}
                canMoveDown={index < form.sections.length - 1}
                onMove={(direction) => moveSection(index, direction)}
                onRemove={() =>
                  setForm({
                    ...form,
                    sections: form.sections.filter((_, i) => i !== index),
                  })
                }
                onChange={(next) => {
                  const sections = [...form.sections];
                  sections[index] = next;
                  setForm({ ...form, sections });
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalDocumentConfiguration;
