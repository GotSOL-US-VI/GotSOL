'use client';

import { ReactNode } from 'react';

interface AppModalProps {
  title: string;
  children: ReactNode;
  show: boolean;
  hide: () => void;
  submit?: () => void;
  submitLabel?: string;
}

export function AppModal({ title, children, show, hide, submit, submitLabel = 'Submit' }: AppModalProps) {
  if (!show) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <div className="py-4 space-y-4">{children}</div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={hide}>
            Cancel
          </button>
          {submit && (
            <button className="btn btn-primary" onClick={submit}>
              {submitLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
} 