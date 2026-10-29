'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Head from 'next/head';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useStore } from '@/context/StoreContext';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import {
  MedicineMaster,
  BatchInventory,
  DoctorProfile,
  BillingQuoteResult,
  CalculatedLineItem,
  PaymentEntry,
  formatPaiseToINR,
  calculateUnitPrice,
  sortBatchesFEFO,
  DiscountAllocationMethod,
  RoundOffMode,
} from '@pulseclinic/types';

interface CartItem {
  medicine: MedicineMaster;
  selectedBatch: BatchInventory;
  availableBatches: BatchInventory[];
  quantityUnits: number;
  discountBps: number;
  customGstRateBps?: number;
  gstInput?: string;
}

export default function NewBillingPage() {
  const { activeStore } = useStore();

  // Search & Catalogue
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MedicineMaster[]>([]);
  const [catalogueMedicines, setCatalogueMedicines] = useState<MedicineMaster[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const displayedMedicines = useMemo(() => {
    if (!searchQuery.trim()) {
      return catalogueMedicines;
    }
    return searchResults;
  }, [searchQuery, catalogueMedicines, searchResults]);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [overallDiscountBps, setOverallDiscountBps] = useState(0);
  const [discountInput, setDiscountInput] = useState('0');
  const [discountAllocationMethod, setDiscountAllocationMethod] = useState<DiscountAllocationMethod>('STORE');

  // Debounce discountInput to allow smooth multi-digit typing without interrupting recalculation
  useEffect(() => {
    const val = parseFloat(discountInput);
    const bps = isNaN(val) ? 0 : Math.round(Math.max(0, Math.min(100, val)) * 100);
    const timer = setTimeout(() => {
      setOverallDiscountBps(bps);
    }, 350);
    return () => clearTimeout(timer);
  }, [discountInput]);

  // Quote State
  const [quote, setQuote] = useState<BillingQuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Customer & Prescriber
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerStateCode, setCustomerStateCode] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  const selectedDoc = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId),
    [doctors, selectedDoctorId]
  );
  const hasDoctorCommission = Boolean(selectedDoc && selectedDoc.commissionEnabled && (selectedDoc.commissionBps || 0) > 0);

  // When no doctor with active commission is selected, revert discount allocation to STORE
  useEffect(() => {
    if (!hasDoctorCommission && discountAllocationMethod !== 'STORE') {
      setDiscountAllocationMethod('STORE');
    }
  }, [hasDoctorCommission, discountAllocationMethod]);

  // Round-off Preference (Store Owner Action)
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>('NONE');

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [cashPaise, setCashPaise] = useState(0);
  const [upiPaise, setUpiPaise] = useState(0);
  const [cardPaise, setCardPaise] = useState(0);
  const [, setCashTenderedRupees] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Sync payment allocations when quote/roundOffMode changes while payment modal is open
  useEffect(() => {
    if (isPaymentModalOpen && quote) {
      if (paymentMode === 'CASH') {
        setCashPaise(quote.netPayablePaise);
        setCashTenderedRupees((quote.netPayablePaise / 100).toString());
      } else if (paymentMode === 'UPI') {
        setUpiPaise(quote.netPayablePaise);
      } else if (paymentMode === 'CARD') {
        setCardPaise(quote.netPayablePaise);
      }
    }
  }, [quote?.netPayablePaise, isPaymentModalOpen, paymentMode]);

  // Finalized Bill / Receipt Modal
  const [finalizedInvoice, setFinalizedInvoice] = useState<any | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load doctors for prescriber dropdown
  const loadDoctors = useCallback(async () => {
    if (!activeStore) return;
    setDoctorsLoading(true);
    try {
      // Call /doctors?limit=100 without isActive query param to ensure compatibility
      const res = await apiGet<{ success: boolean; doctors: DoctorProfile[] }>(
        '/doctors?limit=100',
        activeStore.storeId
      );
      if (res.success && Array.isArray(res.doctors)) {
        const activeDocs = res.doctors.filter((d) => d.isActive !== false);
        setDoctors(activeDocs);
      }
    } catch (err) {
      console.error('Failed to load registered doctors:', err);
    } finally {
      setDoctorsLoading(false);
    }
  }, [activeStore?.storeId]);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  // Load full medicine catalogue for dropdown browsing
  useEffect(() => {
    if (!activeStore) return;
    setCatalogueLoading(true);
    apiGet<{ success: boolean; medicines: MedicineMaster[] }>(
      '/inventory/medicines?limit=100',
      activeStore.storeId
    )
      .then((res) => {
        if (res.success) {
          setCatalogueMedicines(res.medicines || []);
        }
      })
      .catch((err) => console.error('Failed to load catalogue medicines:', err))
      .finally(() => setCatalogueLoading(false));
  }, [activeStore?.storeId]);

  // Click outside to dismiss search/catalogue dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation shortcuts (screen-map 3.1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 or '/' to focus search
      if (e.key === 'F2' || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F4 to open payment modal
      if (e.key === 'F4') {
        e.preventDefault();
        if (cartItems.length > 0 && quote) {
          openPaymentModal();
        }
      }
      // F10 or Ctrl+Enter to finalize
      if (e.key === 'F10' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        if (cartItems.length > 0 && quote) {
          openPaymentModal();
        }
      }
      // Alt+N to focus customer name
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        (document.getElementById('billing-customer-name') as HTMLInputElement)?.focus();
      }
      // Alt+P to focus customer phone
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        (document.getElementById('billing-customer-phone') as HTMLInputElement)?.focus();
      }
      // F3 or Ctrl+S to focus medicine search
      if (e.key === 'F3' || (e.ctrlKey && e.key.toLowerCase() === 's')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        setIsSearchDropdownOpen(true);
      }
      // Alt+Q to focus last item quantity
      if (e.altKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        const qtyInputs = document.querySelectorAll<HTMLInputElement>('[data-qty-input]');
        if (qtyInputs.length > 0) qtyInputs[qtyInputs.length - 1].focus();
      }
      // Esc to close modals / search
      if (e.key === 'Escape') {
        setIsSearchDropdownOpen(false);
        setIsPaymentModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, quote, isSearchDropdownOpen, displayedMedicines]);

  // Medicine Search Debounced
  useEffect(() => {
    if (!activeStore) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiGet<{ success: boolean; medicines: MedicineMaster[] }>(
          `/inventory/medicines?query=${encodeURIComponent(searchQuery.trim())}&limit=20`,
          activeStore.storeId
        );
        if (res.success) {
          setSearchResults(res.medicines || []);
          setIsSearchDropdownOpen(true);
          setSelectedResultIndex(0);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, activeStore?.storeId]);

  // Add medicine to cart with automatic FEFO batch selection
  const handleSelectMedicine = async (medicine: MedicineMaster, keepDropdownOpen = false) => {
    if (!activeStore) return;
    if (!keepDropdownOpen) {
      setIsSearchDropdownOpen(false);
      setSearchQuery('');
    }

    // Fetch batches for this medicine using dedicated FEFO endpoint
    try {
      let batches: BatchInventory[] = [];
      try {
        const res = await apiGet<{ success: boolean; batches: BatchInventory[] }>(
          `/inventory/batches/fefo?medicineId=${medicine.id}`,
          activeStore.storeId
        );
        if (res.success && res.batches && res.batches.length > 0) {
          batches = res.batches;
        }
      } catch (fefoErr) {
        console.warn('FEFO route failed, falling back to batch list:', fefoErr);
      }

      if (batches.length === 0) {
        const fallbackRes = await apiGet<{ success: boolean; batches: BatchInventory[] }>(
          `/inventory/batches?medicineId=${medicine.id}`,
          activeStore.storeId
        );
        const allBatches = fallbackRes.batches || [];
        batches = sortBatchesFEFO(allBatches.filter((b) => b.stockUnits > 0));
      }

      if (batches.length === 0) {
        alert(`No sellable inventory batches available for ${medicine.brandName}.`);
        return;
      }

      const sorted = sortBatchesFEFO(batches);
      const fefoBatch = sorted[0];

      // Check if already in cart
      setCartItems((prev) => {
        const existingIdx = prev.findIndex((item) => item.selectedBatch.id === fefoBatch.id);
        if (existingIdx >= 0) {
          // Increment quantity
          const updated = [...prev];
          const newQty = updated[existingIdx].quantityUnits + (medicine.stripSize || 1);
          if (newQty <= fefoBatch.stockUnits) {
            updated[existingIdx].quantityUnits = newQty;
          } else {
            alert(`Stock limit reached for batch ${fefoBatch.batchNumber}. Available: ${fefoBatch.stockUnits}`);
          }
          return updated;
        }

        const initGstBps = medicine.gstRateBps ?? 0;
        return [
          ...prev,
          {
            medicine,
            selectedBatch: fefoBatch,
            availableBatches: sorted,
            quantityUnits: 0,
            discountBps: 0,
            customGstRateBps: initGstBps,
            gstInput: initGstBps > 0 ? (initGstBps / 100).toString() : '0',
          },
        ];
      });
      // Auto-focus the quantity input of the newly added item
      setTimeout(() => {
        const qtyInputs = document.querySelectorAll<HTMLInputElement>('[data-qty-input]');
        if (qtyInputs.length > 0) {
          const lastInput = qtyInputs[qtyInputs.length - 1];
          lastInput.focus();
          lastInput.select();
        }
      }, 100);
    } catch (err) {
      alert('Failed to load batch stock for selected medicine');
    }
  };

  // Re-calculate live quote whenever cart, doctor, or discounts change
  useEffect(() => {
    if (cartItems.length === 0 || !activeStore || !cartItems.some((i) => i.quantityUnits > 0)) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const payload = {
          items: cartItems.filter((item) => item.quantityUnits > 0).map((item) => ({
            medicineId: item.medicine.id,
            batchId: item.selectedBatch.id,
            quantityUnits: item.quantityUnits,
            discountBps: item.discountBps,
            customGstRateBps: item.customGstRateBps,
          })),
          overallDiscountBps,
          customerStateCode: customerStateCode.trim() || undefined,
          doctorId: selectedDoctorId || undefined,
          discountAllocationMethod,
          roundOffToRupee: false,
          roundOffMode,
        };

        const res = await apiPost<{ success: boolean; quote: BillingQuoteResult }>(
          '/bills/quote',
          payload,
          activeStore.storeId
        );

        if (res.success) {
          setQuote(res.quote);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) setQuoteError(err.message);
        else setQuoteError('Failed to calculate live billing quote.');
      } finally {
        setQuoteLoading(false);
      }
    };

    const timer = setTimeout(fetchQuote, 150);
    return () => clearTimeout(timer);
  }, [cartItems, overallDiscountBps, customerStateCode, selectedDoctorId, discountAllocationMethod, roundOffMode, activeStore?.storeId]);

  const updateCartItemQuantity = (index: number, newQty: number) => {
    setCartItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (newQty < 0) {
        newQty = 0;
      }
      if (newQty > item.selectedBatch.stockUnits) {
        alert(`Cannot exceed available batch stock (${item.selectedBatch.stockUnits} units)`);
        return prev;
      }
      item.quantityUnits = newQty;
      return updated;
    });
  };

  const updateCartItemBatch = (index: number, batchId: string) => {
    setCartItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newBatch = item.availableBatches.find((b) => b.id === batchId);
      if (newBatch) {
        item.selectedBatch = newBatch;
        if (item.quantityUnits > newBatch.stockUnits) {
          item.quantityUnits = newBatch.stockUnits;
        }
      }
      return updated;
    });
  };

  const updateCartItemGst = (index: number, valStr: string) => {
    const clean = valStr.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : clean;
    const num = parseFloat(sanitized);
    const bps = isNaN(num) ? 0 : Math.round(Math.max(0, Math.min(100, num)) * 100);

    setCartItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        gstInput: sanitized,
        customGstRateBps: bps,
      };
      return next;
    });
  };

  const removeCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Payment Modal Helpers
  const openPaymentModal = () => {
    if (!quote) return;
    setPaymentMode('CASH');
    setCashPaise(quote.netPayablePaise);
    setUpiPaise(0);
    setCardPaise(0);
    setCashTenderedRupees((quote.netPayablePaise / 100).toString());
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const switchPaymentMode = (mode: 'CASH' | 'UPI' | 'CARD' | 'SPLIT') => {
    if (!quote) return;
    setPaymentMode(mode);
    setPaymentError(null);
    if (mode === 'CASH') {
      setCashPaise(quote.netPayablePaise);
      setUpiPaise(0);
      setCardPaise(0);
      setCashTenderedRupees((quote.netPayablePaise / 100).toString());
    } else if (mode === 'UPI') {
      setCashPaise(0);
      setUpiPaise(quote.netPayablePaise);
      setCardPaise(0);
    } else if (mode === 'CARD') {
      setCashPaise(0);
      setUpiPaise(0);
      setCardPaise(quote.netPayablePaise);
    } else {
      setCashPaise(0);
      setUpiPaise(0);
      setCardPaise(0);
      setCashTenderedRupees('');
    }
  };


  const handleFinalizeBill = async () => {
    if (!activeStore || !quote) return;

    // Check payment modes sum
    const totalPaid = cashPaise + upiPaise + cardPaise;
    if (totalPaid !== quote.netPayablePaise) {
      setPaymentError(
        `Total payments (₹${(totalPaid / 100).toFixed(2)}) must equal net payable (₹${(quote.netPayablePaise / 100).toFixed(2)})`
      );
      return;
    }

    setPaymentSubmitting(true);
    setPaymentError(null);

    const paymentModes: PaymentEntry[] = [];
    if (cashPaise > 0) paymentModes.push({ mode: 'CASH', amountPaise: cashPaise });
    if (upiPaise > 0) paymentModes.push({ mode: 'UPI', amountPaise: upiPaise });
    if (cardPaise > 0) paymentModes.push({ mode: 'CARD', amountPaise: cardPaise });

    const selectedDoc = doctors.find((d) => d.id === selectedDoctorId);

    try {
      const payload = {
        items: cartItems.filter((it) => it.quantityUnits > 0).map((it) => ({
          medicineId: it.medicine.id,
          batchId: it.selectedBatch.id,
          quantityUnits: it.quantityUnits,
          discountBps: it.discountBps,
          customGstRateBps: it.customGstRateBps,
        })),
        overallDiscountBps,
        discountAllocationMethod,
        paymentModes,
        customer: {
          name: customerName.trim() || undefined,
          phone: customerPhone.trim() || undefined,
          stateCode: customerStateCode.trim() || undefined,
        },
        doctorId: selectedDoctorId || undefined,
        doctorName: selectedDoc?.name || undefined,
        idempotencyKey: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        roundOffToRupee: false,
        roundOffMode,
      };

      const res = await apiPost<{ success: boolean; invoice: any }>('/bills', payload, activeStore.storeId);

      if (res.success) {
        setIsPaymentModalOpen(false);
        setFinalizedInvoice({
          ...res.invoice,
          items: quote.items,
          grossTotalPaise: quote.grossTotalPaise,
          totalDiscountPaise: quote.totalDiscountPaise,
          taxableTotalPaise: quote.taxableTotalPaise,
          cgstTotalPaise: quote.cgstTotalPaise,
          sgstTotalPaise: quote.sgstTotalPaise,
          igstTotalPaise: quote.igstTotalPaise,
          taxTotalPaise: quote.taxTotalPaise,
          grandTotalPaise: quote.grandTotalPaise,
          roundOffPaise: quote.roundOffPaise,
          netPayablePaise: quote.netPayablePaise,
          paymentModes,
          customer: {
            name: customerName,
            phone: customerPhone,
          },
          doctorName: selectedDoc?.name,
          doctorCommissionBps: quote.doctorCommissionBps,
          originalDoctorCommissionPaise: quote.originalDoctorCommissionPaise,
          discountAllocationMethod: quote.discountAllocationMethod,
          nominalStoreDiscountPaise: quote.nominalStoreDiscountPaise,
          nominalDoctorDiscountPaise: quote.nominalDoctorDiscountPaise,
          actualStoreDiscountPaise: quote.actualStoreDiscountPaise,
          actualDoctorDiscountPaise: quote.actualDoctorDiscountPaise,
          unallocatedDiscountPaise: quote.unallocatedDiscountPaise,
          finalDoctorCommissionPaise: quote.finalDoctorCommissionPaise,
        });
        setIsReceiptModalOpen(true);

        // Reset cart
        setCartItems([]);
        setOverallDiscountBps(0);
        setDiscountInput('0');
        setDiscountAllocationMethod('STORE');
        setRoundOffMode('NONE');
        setCustomerName('');
        setCustomerPhone('');
        setSelectedDoctorId('');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) setPaymentError(err.message);
      else setPaymentError('Failed to finalize invoice transaction.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Cashier POS Terminal | New Sanjivani Clinic</title>
        <meta
          name="description"
          content="Fast cashier POS terminal with FEFO batch selection, Schedule H validation, and GST invoice finalization."
        />
      </Head>

      <div style={{ maxWidth: '1440px', margin: '0 auto', color: '#0f172a' }}>
        {/* Top Header & Shortcuts Pill Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            gap: '12px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Cashier POS Terminal
            </h1>
            <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '13px' }}>
              Sequential GST invoicing with FEFO stock deduction and Schedule H compliance.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              {[
                ['F3', 'Search'],
                ['Alt+N', 'Name'],
                ['Alt+P', 'Phone'],
                ['Alt+Q', 'Qty'],
                ['↑↓ Enter', 'Select Medicine'],
                ['Ctrl+Enter', 'Finalize'],
              ].map(([k, v]) => (
                <span key={k} style={{ fontSize: '10px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <kbd style={{ padding: '1px 4px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '10px', fontWeight: 600, color: '#475569', fontFamily: 'inherit' }}>{k}</kbd>
                  {v}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <kbd style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                F2
              </kbd>
              Search
            </span>
            <span
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <kbd style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                F4
              </kbd>
              Payment
            </span>
            <span
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <kbd style={{ backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                F10
              </kbd>
              Finalize
            </span>
          </div>
        </div>

        {/* POS Split Terminal Layout: Left Cart & Search, Right Checkout Summary */}

        {/* POS Split Terminal Layout: Left Cart & Search, Right Checkout Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Medicine Search & Cart Table */}
          <div>
            {/* Search Input Box with Dropdown Toggle */}
            <div ref={searchContainerRef} style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Scan barcode or search medicine brand or generic name"
                aria-expanded={isSearchDropdownOpen}
                aria-autocomplete="list"
                role="combobox"
                placeholder="Scan barcode, type medicine name, or click Browse ▼..."
                value={searchQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onClick={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                  setSelectedResultIndex(0);
                }}
                id="pos-medicine-search-input"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedResultIndex((prev) => {
                      const next = Math.min(prev + 1, displayedMedicines.length - 1);
                      document.querySelector(`[data-medicine-idx="${next}"]`)?.scrollIntoView({ block: 'nearest' });
                      return next;
                    });
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedResultIndex((prev) => {
                      const next = Math.max(prev - 1, 0);
                      document.querySelector(`[data-medicine-idx="${next}"]`)?.scrollIntoView({ block: 'nearest' });
                      return next;
                    });
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsSearchDropdownOpen(false);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isSearchDropdownOpen && displayedMedicines[selectedResultIndex]) {
                      handleSelectMedicine(displayedMedicines[selectedResultIndex], false);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 125px 12px 42px',
                  borderRadius: '10px',
                  border: '2px solid #2563eb',
                  fontSize: '15px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.08)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '18px',
                  color: '#2563eb',
                  pointerEvents: 'none',
                }}
              >
                🔍
              </span>

              {/* Dropdown Toggle Browse Button */}
              <button
                type="button"
                onClick={() => {
                  setIsSearchDropdownOpen((prev) => !prev);
                  searchInputRef.current?.focus();
                }}
                title="Browse and select medicines from dropdown"
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: isSearchDropdownOpen ? '#eff6ff' : '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#2563eb',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <span>{isSearchDropdownOpen ? '▲ Close' : '▼ Browse'}</span>
              </button>

              {/* Search & Catalogue Multi-Select Dropdown */}
              {isSearchDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12)',
                    zIndex: 50,
                    maxHeight: '400px',
                    overflowY: 'auto',
                  }}
                >
                  {/* Sticky Dropdown Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 16px',
                      backgroundColor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                      {searchQuery.trim()
                        ? `Search Results (${displayedMedicines.length})`
                        : `Catalogue Medicines (${displayedMedicines.length})`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Click <strong>+ Add</strong> to select multiple items
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsSearchDropdownOpen(false)}
                        style={{
                          background: '#e2e8f0',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        Done ✕
                      </button>
                    </div>
                  </div>

                  {searchLoading || catalogueLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      Loading catalogue medicines...
                    </div>
                  ) : displayedMedicines.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      {searchQuery.trim()
                        ? `No medicines found matching "${searchQuery}"`
                        : 'No medicines found in store inventory.'}
                    </div>
                  ) : (
                    displayedMedicines.map((med, idx) => {
                      const inCartItem = cartItems.find((it) => it.medicine.id === med.id);
                      const inCartUnits = inCartItem?.quantityUnits || 0;

                      return (
                        <div
                          key={med.id}
                          data-medicine-idx={idx}
                          onClick={() => handleSelectMedicine(med, true)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor:
                              idx === selectedResultIndex
                                ? '#dbeafe'
                                : inCartUnits > 0
                                ? '#f0fdf4'
                                : '#ffffff',
                            borderLeft: idx === selectedResultIndex ? '3px solid #2563eb' : '3px solid transparent',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'background-color 0.1s ease',
                          }}
                          onMouseEnter={() => setSelectedResultIndex(idx)}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                                {med.brandName}
                              </span>
                              {med.scheduleCategory && med.scheduleCategory !== 'NONE' && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    backgroundColor: '#fef3c7',
                                    color: '#b45309',
                                    fontWeight: 700,
                                  }}
                                >
                                  Sch {med.scheduleCategory}
                                </span>
                              )}
                              {inCartUnits > 0 && (
                                <span
                                  style={{
                                    fontSize: '11px',
                                    padding: '1px 7px',
                                    borderRadius: '12px',
                                    backgroundColor: '#dcfce7',
                                    color: '#15803d',
                                    fontWeight: 700,
                                  }}
                                >
                                  ✓ In Cart: {inCartUnits}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                              {med.genericName} • {med.dosageForm} ({med.strength}) • Pack: {med.stripSize || 1}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectMedicine(med, true);
                              }}
                              style={{
                                fontSize: '12px',
                                backgroundColor: inCartUnits > 0 ? '#10b981' : '#2563eb',
                                color: '#ffffff',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }}
                            >
                              {inCartUnits > 0 ? `+ Add More (${inCartUnits})` : '+ Add to Cart'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Cart Table */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              {cartItems.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🛒</div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0' }}>
                    Cart is empty
                  </h3>
                  <p style={{ fontSize: '13px', margin: 0 }}>
                    Type a medicine name in the search bar above or scan a barcode to add items.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          color: '#475569',
                          fontWeight: 600,
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        <th style={{ padding: '12px 14px' }}>Medicine Details</th>
                        <th style={{ padding: '12px 14px' }}>Batch (FEFO)</th>
                        <th style={{ padding: '12px 14px' }}>Unit Price</th>
                        <th style={{ padding: '12px 14px' }}>Quantity</th>
                        <th style={{ padding: '12px 14px' }}>GST %</th>
                        <th style={{ padding: '12px 14px' }}>Line Total</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cartItems.map((item, idx) => {
                        const unitPrice = calculateUnitPrice(
                          item.selectedBatch.mrpPaise,
                          item.medicine.stripSize || 1
                        );
                        const grossLine = unitPrice * item.quantityUnits;

                        return (
                          <tr key={`${item.medicine.id}-${item.selectedBatch.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.medicine.brandName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{item.medicine.genericName}</div>
                            </td>

                            <td style={{ padding: '12px 14px' }}>
                              <select
                                value={item.selectedBatch.id}
                                onChange={(e) => updateCartItemBatch(idx, e.target.value)}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  backgroundColor: '#ffffff',
                                }}
                              >
                                {item.availableBatches.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.batchNumber} (Exp: {b.expiryDate}, Stock: {b.stockUnits})
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td style={{ padding: '12px 14px', color: '#334155' }}>
                              {formatPaiseToINR(unitPrice)}
                            </td>

                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => updateCartItemQuantity(idx, item.quantityUnits - 1)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  -
                                </button>
                                <input
                                  data-qty-input
                                  type="text"
                                  inputMode="numeric"
                                  min="1"
                                  max={item.selectedBatch.stockUnits}
                                  value={item.quantityUnits === 0 ? '' : item.quantityUnits}
                                  placeholder="0"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    updateCartItemQuantity(idx, val === '' ? 0 : parseInt(val, 10));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      searchInputRef.current?.focus();
                                      searchInputRef.current?.select();
                                      setIsSearchDropdownOpen(true);
                                    }
                                  }}
                                  style={{
                                    width: '48px',
                                    padding: '4px',
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '13px',
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateCartItemQuantity(idx, item.quantityUnits + 1)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </td>

                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={
                                    item.gstInput !== undefined
                                      ? item.gstInput
                                      : (item.customGstRateBps ? (item.customGstRateBps / 100).toString() : '0')
                                  }
                                  onChange={(e) => updateCartItemGst(idx, e.target.value)}
                                  style={{
                                    width: '48px',
                                    padding: '4px 6px',
                                    textAlign: 'center',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '13px',
                                  }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>%</span>
                              </div>
                            </td>

                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0f172a' }}>
                              {formatPaiseToINR(grossLine)}
                            </td>

                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => removeCartItem(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                }}
                                title="Remove item"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Prescriber & Customer Card */}
            <div
              style={{
                marginTop: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                Customer & Prescribing Doctor Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Customer Name
                  </label>
                  <input
                    id="billing-customer-name"
                    type="text"
                    placeholder="e.g. Anand Kumar"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Customer Phone
                  </label>
                  <input
                    id="billing-customer-phone"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Customer State (GST)
                  </label>
                  <input
                    type="text"
                    id="pos-customer-state-input"
                    placeholder="Enter state code or name (e.g. 29)"
                    value={customerStateCode}
                    onChange={(e) => setCustomerStateCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                      Prescribing Doctor
                    </label>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                      <button
                        type="button"
                        onClick={loadDoctors}
                        disabled={doctorsLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          cursor: doctorsLoading ? 'wait' : 'pointer',
                          fontWeight: 600,
                          padding: 0,
                          fontSize: '11px',
                        }}
                      >
                        {doctorsLoading ? 'Loading...' : '↻ Refresh List'}
                      </button>
                      <a
                        href="/doctors"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}
                      >
                        + Register Doctor
                      </a>
                    </div>
                  </div>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    id="pos-prescribing-doctor-select"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    <option value="">-- Select Registered Doctor --</option>
                    {doctorsLoading ? (
                      <option value="" disabled>Loading registered doctors...</option>
                    ) : doctors.length === 0 ? (
                      <option value="" disabled>No registered doctors found (Register in Doctors menu)</option>
                    ) : (
                      doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name.startsWith('Dr.') ? d.name : `Dr. ${d.name}`}{d.registrationNumber ? ` (${d.registrationNumber})` : ''}{d.specialization ? ` — ${d.specialization}` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Billing Summary & Checkout */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              position: 'sticky',
              top: '80px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Billing Summary</span>
              {quoteLoading && (
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>• calculating...</span>
              )}
            </div>

            {quoteError && (
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontSize: '12px',
                  marginBottom: '14px',
                }}
              >
                {quoteError}
              </div>
            )}

            {!quote ? (
              <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>
                {quoteLoading ? 'Calculating live quote...' : 'Add items to see invoice quote.'}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Cart Discount</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={discountInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^\d*\.?\d*$/.test(v)) {
                          setDiscountInput(v);
                        }
                      }}
                      onBlur={() => {
                        if (!discountInput || isNaN(parseFloat(discountInput))) {
                          setDiscountInput('0');
                        }
                      }}
                      placeholder="0"
                      id="pos-cart-discount-input"
                      style={{
                        width: '56px',
                        padding: '4px 6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        textAlign: 'right',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>%</span>
                  </div>
                </div>

                {/* Discount Borne By Dropdown (Section 4) */}
                {quote.totalDiscountPaise > 0 && (
                  <div
                    style={{
                      marginBottom: '14px',
                      backgroundColor: '#f8fafc',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label htmlFor="pos-discount-borne-by-select" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                        Discount Borne By
                      </label>
                      <select
                        id="pos-discount-borne-by-select"
                        value={discountAllocationMethod}
                        onChange={(e) => setDiscountAllocationMethod(e.target.value as 'STORE' | 'DOCTOR' | 'BOTH')}
                        style={{
                          padding: '5px 8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          outline: 'none',
                        }}
                      >
                        <option value="STORE">Store (100%)</option>
                        <option value="DOCTOR" disabled={!hasDoctorCommission}>
                          Doctor Commission (100%){!hasDoctorCommission ? ' — (Commission Inactive)' : ''}
                        </option>
                        <option value="BOTH" disabled={!hasDoctorCommission}>
                          Both Equally (50% / 50%){!hasDoctorCommission ? ' — (Commission Inactive)' : ''}
                        </option>
                      </select>
                    </div>
                    {!hasDoctorCommission && (
                      <div style={{ fontSize: '11px', color: '#b45309', marginTop: '6px' }}>
                        ⚠️ Select a prescribing doctor with active commission tracking to allocate discount to doctor commission.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                  <span>Gross Total</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatPaiseToINR(quote.grossTotalPaise)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                  <span>Discount</span>
                  <span style={{ fontWeight: 600, color: '#059669' }}>- {formatPaiseToINR(quote.totalDiscountPaise)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                  <span>Taxable Subtotal</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatPaiseToINR(quote.taxableTotalPaise)}</span>
                </div>

                {quote.isInterState ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                    <span>IGST</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatPaiseToINR(quote.igstTotalPaise)}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                      <span>CGST</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatPaiseToINR(quote.cgstTotalPaise)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                      <span>SGST</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatPaiseToINR(quote.sgstTotalPaise)}</span>
                    </div>
                  </>
                )}

                {quote.roundOffPaise !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#059669' }}>
                    <span>Round-Off (Waived)</span>
                    <span style={{ fontWeight: 600 }}>{formatPaiseToINR(quote.roundOffPaise)}</span>
                  </div>
                )}

                {/* Store Owner Quick Option to waive or keep exact paise */}
                {quote.grandTotalPaise % 100 !== 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      fontSize: '12px',
                    }}
                  >
                    <span style={{ color: '#64748b', fontWeight: 500 }}>Paise:</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setRoundOffMode('NONE')}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: roundOffMode === 'NONE' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: roundOffMode === 'NONE' ? '#eff6ff' : '#ffffff',
                          color: roundOffMode === 'NONE' ? '#1d4ed8' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => setRoundOffMode('DOWN')}
                        title={`Waive ${quote.grandTotalPaise % 100} paise and charge ₹${Math.floor(quote.grandTotalPaise / 100)} only`}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: roundOffMode === 'DOWN' ? '1px solid #059669' : '1px solid #cbd5e1',
                          backgroundColor: roundOffMode === 'DOWN' ? '#f0fdf4' : '#ffffff',
                          color: roundOffMode === 'DOWN' ? '#047857' : '#64748b',
                          cursor: 'pointer',
                        }}
                      >
                        Leave {quote.grandTotalPaise % 100}p (₹{Math.floor(quote.grandTotalPaise / 100)})
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    borderTop: '2px solid #e2e8f0',
                    paddingTop: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '16px',
                  }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Net Payable</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                    {formatPaiseToINR(quote.netPayablePaise)}
                  </span>
                </div>

                {/* Doctor commission is calculated in backend but NOT shown to workers — visible only in Owner Vault */}

                {/* GST Slab Breakdown */}
                {quote.taxSlabs.length > 0 && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      marginBottom: '20px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                      GST Slabs
                    </div>
                    {quote.taxSlabs.map((s) => (
                      <div
                        key={s.gstRateBps}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '11px',
                          color: '#475569',
                          marginBottom: '3px',
                        }}
                      >
                        <span>{(s.gstRateBps / 100).toFixed(0)}% Slab (Taxable: {formatPaiseToINR(s.taxablePaise)})</span>
                        <span style={{ fontWeight: 600 }}>{formatPaiseToINR(s.totalTaxPaise)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={openPaymentModal}
                  id="pos-proceed-payment-btn"
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>Collect Payment (F4)</span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && quote && (() => {
        const totalAllocated = cashPaise + upiPaise + cardPaise;
        const isBalanced = totalAllocated === quote.netPayablePaise;
        const MODES = [
          { key: 'CASH' as const, label: 'Cash', icon: '💵' },
          { key: 'UPI' as const, label: 'UPI', icon: '📱' },
          { key: 'CARD' as const, label: 'Card', icon: '💳' },
          { key: 'SPLIT' as const, label: 'Split', icon: '🔀' },
        ];
        return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsPaymentModalOpen(false);
              }
              if (e.key === 'Enter' && !e.ctrlKey && isBalanced && !paymentSubmitting) {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag !== 'INPUT') {
                  e.preventDefault();
                  handleFinalizeBill();
                }
              }
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Collect Payment & Finalize
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Select payment mode below
                </p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {paymentError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontSize: '13px',
                  marginBottom: '16px',
                }}
              >
                {paymentError}
              </div>
            )}

            {/* Total Due */}
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Payable</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
                  {formatPaiseToINR(quote.netPayablePaise)}
                </div>
              </div>
              {paymentMode === 'SPLIT' && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Allocated</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: isBalanced ? '#059669' : '#dc2626' }}>
                    {formatPaiseToINR(totalAllocated)}
                  </div>
                  {!isBalanced && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px' }}>
                      {totalAllocated < quote.netPayablePaise
                        ? `₹${((quote.netPayablePaise - totalAllocated) / 100).toFixed(2)} remaining`
                        : `₹${((totalAllocated - quote.netPayablePaise) / 100).toFixed(2)} over`}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Store Owner Paise Action (Leave Paise / Exact) */}
            {quote.grandTotalPaise % 100 !== 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#334155' }}>Store Owner Round-Off:</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {roundOffMode === 'DOWN'
                      ? `Waived ${Math.abs(quote.roundOffPaise)} paise (taking integer ₹${Math.floor(quote.grandTotalPaise / 100)})`
                      : 'No round-off (exact paise payable)'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRoundOffMode('NONE')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: roundOffMode === 'NONE' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      backgroundColor: roundOffMode === 'NONE' ? '#eff6ff' : '#ffffff',
                      color: roundOffMode === 'NONE' ? '#1d4ed8' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Exact ({formatPaiseToINR(quote.grandTotalPaise)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoundOffMode('DOWN')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: roundOffMode === 'DOWN' ? '2px solid #059669' : '1px solid #cbd5e1',
                      backgroundColor: roundOffMode === 'DOWN' ? '#f0fdf4' : '#ffffff',
                      color: roundOffMode === 'DOWN' ? '#047857' : '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    Leave {quote.grandTotalPaise % 100}p (₹{Math.floor(quote.grandTotalPaise / 100)})
                  </button>
                </div>
              </div>
            )}

            {/* Mode Selector Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                marginBottom: '20px',
                background: '#f1f5f9',
                borderRadius: '10px',
                padding: '4px',
              }}
            >
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => switchPaymentMode(m.key)}
                  style={{
                    padding: '10px 4px',
                    borderRadius: '8px',
                    border: paymentMode === m.key ? '2px solid #2563eb' : '2px solid transparent',
                    background: paymentMode === m.key ? '#ffffff' : 'transparent',
                    boxShadow: paymentMode === m.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '13px',
                    fontWeight: paymentMode === m.key ? 700 : 500,
                    color: paymentMode === m.key ? '#1e40af' : '#64748b',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Mode-specific content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', minHeight: '80px' }}>
              {/* CASH mode */}
              {paymentMode === 'CASH' && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  fontSize: '14px',
                  color: '#15803d',
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  Full amount {formatPaiseToINR(quote.netPayablePaise)} will be collected as Cash
                  {quote.roundOffPaise < 0 && (
                    <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px', fontWeight: 500 }}>
                      ({Math.abs(quote.roundOffPaise)} paise waived by store owner)
                    </div>
                  )}
                </div>
              )}

              {/* UPI mode */}
              {paymentMode === 'UPI' && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  fontSize: '14px',
                  color: '#1e40af',
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  Full amount {formatPaiseToINR(quote.netPayablePaise)} will be collected via UPI
                </div>
              )}

              {/* CARD mode */}
              {paymentMode === 'CARD' && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#faf5ff',
                  borderRadius: '8px',
                  border: '1px solid #e9d5ff',
                  fontSize: '14px',
                  color: '#7e22ce',
                  fontWeight: 600,
                  textAlign: 'center',
                }}>
                  Full amount {formatPaiseToINR(quote.netPayablePaise)} will be collected via Card / POS
                </div>
              )}

              {/* SPLIT mode */}
              {paymentMode === 'SPLIT' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      💵 Cash Amount (₹)
                    </label>
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="1"
                      value={cashPaise === 0 ? '' : (cashPaise / 100).toString()}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCashPaise(Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).closest('div')?.parentElement?.querySelector<HTMLInputElement>('div:nth-child(2) input')?.focus(); } }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      📱 UPI Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={upiPaise === 0 ? '' : (upiPaise / 100).toString()}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setUpiPaise(Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      💳 Card Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={cardPaise === 0 ? '' : (cardPaise / 100).toString()}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCardPaise(Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && isBalanced && !paymentSubmitting) {
                          e.preventDefault();
                          handleFinalizeBill();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalizeBill}
                disabled={paymentSubmitting || !isBalanced}
                id="pos-finalize-submit-btn"
                style={{
                  padding: '10px 22px',
                  backgroundColor: isBalanced ? '#059669' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: paymentSubmitting || !isBalanced ? 'not-allowed' : 'pointer',
                }}
              >
                {paymentSubmitting ? 'Finalizing...' : `Finalize Invoice (Enter)`}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Invoice Receipt Modal (Prompt 15: 80mm & A4 Preview) */}
      {isReceiptModalOpen && finalizedInvoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '460px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Bill Finalized Successfully!
              </h2>
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '14px',
                  marginTop: '8px',
                  fontFamily: 'monospace',
                }}
              >
                {finalizedInvoice.invoiceNumber}
              </div>
            </div>

            {/* 80mm Compact Thermal Receipt Layout Preview */}
            <div
              id="thermal-receipt-preview"
              className="printable-receipt-card"
              style={{
                border: '1px dashed #cbd5e1',
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'monospace',
                marginBottom: '20px',
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>
                {activeStore?.storeName || 'New Sanjivani Multispeciality Clinic'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                Beside Hero Bike Agency, In Front of Rajesh Mani Inter College,
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                Padrauna Road, Naurangia, Kushinagar 274305
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                Ph: 8114000119 / 8004807785
              </div>
              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Invoice: {finalizedInvoice.invoiceNumber}</span>
                <span>{new Date().toLocaleDateString('en-IN')}</span>
              </div>
              {finalizedInvoice.customer?.name && (
                <div>Customer: {finalizedInvoice.customer.name}</div>
              )}
              {finalizedInvoice.doctorName && (
                <div>Prescriber: {finalizedInvoice.doctorName.startsWith('Dr.') ? finalizedInvoice.doctorName : `Dr. ${finalizedInvoice.doctorName}`}</div>
              )}
              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

              {/* Line Items — show full MRP price per line */}
              {finalizedInvoice.items?.map((it: CalculatedLineItem) => (
                <div key={`${it.medicineId}-${it.batchId}`} style={{ marginBottom: '4px' }}>
                  <div style={{ fontWeight: 600 }}>{it.medicineName}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>
                      {it.quantityUnits} x {formatPaiseToINR(it.unitPricePaise)}
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {formatPaiseToINR(it.grossLinePaise)}
                    </span>
                  </div>
                </div>
              ))}

              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>{formatPaiseToINR(finalizedInvoice.grossTotalPaise)}</span>
              </div>
              {finalizedInvoice.totalDiscountPaise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                  <span>Discount{finalizedInvoice.items?.[0]?.discountBps > 0 ? ` (${(finalizedInvoice.items[0].discountBps / 100).toFixed(finalizedInvoice.items[0].discountBps % 100 === 0 ? 0 : 1)}%)` : ''}:</span>
                  <span>-{formatPaiseToINR(finalizedInvoice.totalDiscountPaise)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Tax (GST):</span>
                <span>{formatPaiseToINR(finalizedInvoice.taxTotalPaise)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14px', marginTop: '4px' }}>
                <span>GRAND TOTAL:</span>
                <span>{formatPaiseToINR(finalizedInvoice.grandTotalPaise)}</span>
              </div>
              {finalizedInvoice.roundOffPaise !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Round Off:</span>
                  <span>{formatPaiseToINR(finalizedInvoice.roundOffPaise)}</span>
                </div>
              )}
              {finalizedInvoice.roundOffPaise !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '14px', marginTop: '2px', color: '#0f172a' }}>
                  <span>NET PAYABLE:</span>
                  <span>{formatPaiseToINR(finalizedInvoice.netPayablePaise)}</span>
                </div>
              )}

              <div style={{ borderBottom: '1px dashed #94a3b8', margin: '8px 0' }} />
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                Thank You For Your Visit! Get Well Soon.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>🖨️</span> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Start New Bill (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
