'use client';

import { useState, useTransition } from 'react';
import { ZoneMapPicker } from '../ZoneMapPicker';
import { updateAreaPolygon } from '../polygon-actions';

interface PolygonEditorProps {
  areaId: string;
  initialPolygon?: { type: string; coordinates: number[][][] } | null;
}

export function PolygonEditor({ areaId, initialPolygon }: PolygonEditorProps) {
  const [polygon, setPolygon] = useState<{ type: string; coordinates: number[][][] } | null>(
    initialPolygon || null
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = () => {
    if (!polygon) {
      setMessage({ type: 'error', text: 'No polygon to save' });
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('areaId', areaId);
        formData.set('polygonJson', JSON.stringify(polygon));
        
        await updateAreaPolygon(formData);
        setMessage({ type: 'success', text: 'Polygon saved successfully!' });
        
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        setMessage({ 
          type: 'error', 
          text: error instanceof Error ? error.message : 'Failed to save polygon' 
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <ZoneMapPicker
        initialPolygon={polygon}
        onPolygonChange={setPolygon}
        mapHeight="500px"
        showAreaCalculation={true}
        allowDrawing={true}
        allowEditing={true}
      />
      
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !polygon}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving...' : 'Save Polygon'}
        </button>
        
        {polygon && (
          <button
            type="button"
            onClick={() => setPolygon(null)}
            disabled={isPending}
            className="rounded-lg border border-[var(--surface-border)] px-4 py-2 text-sm font-medium text-[var(--text-medium)] hover:bg-[var(--surface-secondary)] disabled:opacity-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
