import { useEffect } from 'react';

export interface ShortcutHandlers {
  onSearchFocus?: () => void; // F2
  onFinalizePayment?: () => void; // F4
  onHoldBill?: () => void; // F10
  onEscape?: () => void; // Escape
}

/**
 * Global Keyboard Navigation Hook for Cashier POS and Terminal (Prompt 26)
 * Enables 100% keyboard-only operation:
 * - F2: Jump to item search
 * - F4: Finalize & Open Payment
 * - F10: Hold / Suspend bill
 * - Esc: Close modal / drawer
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't override if inside an input or textarea unless it is a functional key like F2/F4/F10/Escape
      const key = event.key;

      if (key === 'F2') {
        event.preventDefault();
        handlers.onSearchFocus?.();
      } else if (key === 'F4') {
        event.preventDefault();
        handlers.onFinalizePayment?.();
      } else if (key === 'F10') {
        event.preventDefault();
        handlers.onHoldBill?.();
      } else if (key === 'Escape') {
        handlers.onEscape?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
