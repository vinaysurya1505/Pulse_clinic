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
  const [customerStateCode, setCustomerStateCode] = useState('29'); // Default Karnataka
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

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cashPaise, setCashPaise] = useState(0);
  const [upiPaise, setUpiPaise] = useState(0);
  const [cardPaise, setCardPaise] = useState(0);
  const [cashTenderedRupees, setCashTenderedRupees] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
      // Esc to close modals / search
      if (e.key === 'Escape') {
        setIsSearchDropdownOpen(false);
        setIsPaymentModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, quote]);

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
            quantityUnits: medicine.stripSize || 1,
            discountBps: 0,
            customGstRateBps: initGstBps,
            gstInput: initGstBps > 0 ? (initGstBps / 100).toString() : '0',
          },
        ];
      });
    } catch (err) {
      alert('Failed to load batch stock for selected medicine');
    }
  };

  // Re-calculate live quote whenever cart, doctor, or discounts change
  useEffect(() => {
    if (cartItems.length === 0 || !activeStore) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const payload = {
          items: cartItems.map((item) => ({
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
  }, [cartItems, overallDiscountBps, customerStateCode, selectedDoctorId, discountAllocationMethod, activeStore?.storeId]);

  const updateCartItemQuantity = (index: number, newQty: number) => {
    setCartItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (newQty <= 0) {
        updated.splice(index, 1);
        return updated;
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
    setCashPaise(quote.netPayablePaise); // Default 100% Cash
    setUpiPaise(0);
    setCardPaise(0);
    setCashTenderedRupees((quote.netPayablePaise / 100).toString());
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  const cashChangePaise = useMemo(() => {
    const tendered = Math.round(parseFloat(cashTenderedRupees || '0') * 100);
    return Math.max(0, tendered - cashPaise);
  }, [cashTenderedRupees, cashPaise]);

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
        items: cartItems.map((it) => ({
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
                }}
                id="pos-medicine-search-input"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedResultIndex((prev) => Math.min(prev + 1, displayedMedicines.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedResultIndex((prev) => Math.max(prev - 1, 0));
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
                          onClick={() => handleSelectMedicine(med, true)}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor:
                              idx === selectedResultIndex
                                ? '#f8fafc'
                                : inCartUnits > 0
                                ? '#f0fdf4'
                                : '#ffffff',
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
                                  type="number"
                                  min="1"
                                  max={item.selectedBatch.stockUnits}
                                  value={item.quantityUnits}
                                  onChange={(e) =>
                                    updateCartItemQuantity(idx, parseInt(e.target.value, 10) || 1)
                                  }
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
                          {d.name.startsWith('Dr.') ? d.name : `Dr. ${d.name}`}{d.registrationNumber ? ` (${d.registrationNumber})` : ''}{d.specialization ? ` — ${d.specialization}` : ''}{d.commissionEnabled ? ` [${((d.commissionBps || 0) / 100).toFixed(0)}% Comm]` : ''}
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

                {/* Doctor Commission Breakdown Area (Section 3 & 4) */}
                {selectedDoc && (
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Doctor Commission
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: hasDoctorCommission ? '#dcfce7' : '#f1f5f9',
                          color: hasDoctorCommission ? '#15803d' : '#64748b',
                        }}
                      >
                        {hasDoctorCommission ? `${((selectedDoc.commissionBps || 0) / 100).toFixed(1)}% Active` : 'Inactive'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155', marginBottom: '3px' }}>
                      <span>Prescribing Doctor:</span>
                      <span style={{ fontWeight: 600 }}>{selectedDoc.name.startsWith('Dr.') ? selectedDoc.name : `Dr. ${selectedDoc.name}`}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155', marginBottom: '3px' }}>
                      <span>Commission Rate:</span>
                      <span style={{ fontWeight: 600 }}>
                        {hasDoctorCommission ? `${((selectedDoc.commissionBps || 0) / 100).toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155', marginBottom: '3px' }}>
                      <span>Original Commission:</span>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        {formatPaiseToINR(quote.originalDoctorCommissionPaise || 0)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#334155', marginBottom: '3px' }}>
                      <span>Doctor-Borne Discount:</span>
                      <span style={{ fontWeight: 600, color: (quote.actualDoctorDiscountPaise || 0) > 0 ? '#dc2626' : '#64748b' }}>
                        - {formatPaiseToINR(quote.actualDoctorDiscountPaise || 0)}
                      </span>
                    </div>

                    {quote.unallocatedDiscountPaise > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#b45309', marginBottom: '3px' }}>
                        <span>Unallocated Excess Discount:</span>
                        <span style={{ fontWeight: 600 }}>{formatPaiseToINR(quote.unallocatedDiscountPaise)}</span>
                      </div>
                    )}

                    <div
                      style={{
                        borderTop: '1px solid #bbf7d0',
                        paddingTop: '6px',
                        marginTop: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#166534',
                      }}
                    >
                      <span>Final Commission Payable:</span>
                      <span>{formatPaiseToINR(quote.finalDoctorCommissionPaise || 0)}</span>
                    </div>
                  </div>
                )}

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

      {/* Split Payment Modal (Prompt 14) */}
      {isPaymentModalOpen && quote && (
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
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Collect Payment & Finalize Invoice
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Split payment modes (Cash, UPI, Card) supported
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

            {/* Total Due Callout */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>TOTAL NET PAYABLE</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                  {formatPaiseToINR(quote.netPayablePaise)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Allocated</div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: cashPaise + upiPaise + cardPaise === quote.netPayablePaise ? '#059669' : '#dc2626',
                  }}
                >
                  {formatPaiseToINR(cashPaise + upiPaise + cardPaise)}
                </div>
              </div>
            </div>

            {/* Payment Modes Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  💵 Cash Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={(cashPaise / 100).toString()}
                  onChange={(e) => setCashPaise(Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                  }}
                />
              </div>

              {cashPaise > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Customer Tendered (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={cashTenderedRupees}
                      onChange={(e) => setCashTenderedRupees(e.target.value)}
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
                      Change to Return
                    </label>
                    <div
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#059669',
                      }}
                    >
                      {formatPaiseToINR(cashChangePaise)}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  📱 UPI / QR Code Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={(upiPaise / 100).toString()}
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
                  💳 Card / POS Swipe Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={(cardPaise / 100).toString()}
                  onChange={(e) => setCardPaise(Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

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
                disabled={paymentSubmitting || cashPaise + upiPaise + cardPaise !== quote.netPayablePaise}
                id="pos-finalize-submit-btn"
                style={{
                  padding: '10px 22px',
                  backgroundColor:
                    cashPaise + upiPaise + cardPaise === quote.netPayablePaise ? '#059669' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor:
                    paymentSubmitting || cashPaise + upiPaise + cardPaise !== quote.netPayablePaise
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                {paymentSubmitting ? 'Finalizing Invoice...' : 'Finalize & Generate Invoice (F10)'}
              </button>
            </div>
          </div>
        </div>
      )}

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
