import React, { useState, useEffect } from 'react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { Check, X, Edit3, CheckCircle2, Plus, Trash2, ArrowRight, Download, HelpCircle } from 'lucide-react';

interface SchoolFeesSectionProps {
  className?: string;
  showTitle?: boolean;
  onOpenApply?: () => void;
  onOpenTour?: () => void;
}

export const SchoolFeesSection: React.FC<SchoolFeesSectionProps> = ({
  className = '',
  showTitle = true,
  onOpenApply,
  onOpenTour,
}) => {
  const [settings, setSettings] = useState<WebsiteSettings>(getWebsiteSettings());
  const [sessionUser, setSessionUser] = useState(getCurrentSessionUser());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Form State
  const [feesBadge, setFeesBadge] = useState<string>(settings.feesBadge || 'SCHOOL FEES');
  const [feesSubtitle, setFeesSubtitle] = useState<string>(
    settings.feesSubtitle ||
      'Discover the fee structure for each academic term at RUNDA TECHNICAL SECONDARY SCHOOL for seasoned students (L4, L5).'
  );
  const [firstTermPrice, setFirstTermPrice] = useState<string>(settings.feesFirstTerm || '92000.0');
  const [secondTermPrice, setSecondTermPrice] = useState<string>(settings.feesSecondTerm || '92000.0');
  const [thirdTermPrice, setThirdTermPrice] = useState<string>(settings.feesThirdTerm || '92000.0');
  const [currency, setCurrency] = useState<string>(settings.feesCurrency || 'Rwf');
  const [period, setPeriod] = useState<string>(settings.feesPeriod || '/ Term');
  const [includedList, setIncludedList] = useState<string[]>(
    settings.feesIncluded || [
      'Tuition Fees',
      'Administrative Charges',
      'Classroom Materials (Books, Stationery)',
      'ICT and Technical Education Resources',
      'Laboratory Fees (For Science students)',
      'Sports and Physical Education Fees',
      'Co-curricular activities',
    ]
  );
  const [notIncludedList, setNotIncludedList] = useState<string[]>(
    settings.feesNotIncluded || [
      'Uniform (Students must purchase separately)',
      'School Transport (If applicable)',
      'External Examination Fees (e.g., National Exams)',
      'Extra-Curricular Activity Fees (e.g., Clubs, Workshops)',
    ]
  );

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setFeesBadge(updated.feesBadge || 'SCHOOL FEES');
      setFeesSubtitle(
        updated.feesSubtitle ||
          'Discover the fee structure for each academic term at RUNDA TECHNICAL SECONDARY SCHOOL for seasoned students (L4, L5).'
      );
      setFirstTermPrice(updated.feesFirstTerm || '92000.0');
      setSecondTermPrice(updated.feesSecondTerm || '92000.0');
      setThirdTermPrice(updated.feesThirdTerm || '92000.0');
      setCurrency(updated.feesCurrency || 'Rwf');
      setPeriod(updated.feesPeriod || '/ Term');
      if (updated.feesIncluded) setIncludedList(updated.feesIncluded);
      if (updated.feesNotIncluded) setNotIncludedList(updated.feesNotIncluded);
    };
    window.addEventListener('mugina-settings-updated', handleUpdate);
    return () => window.removeEventListener('mugina-settings-updated', handleUpdate);
  }, []);

  useEffect(() => {
    setSessionUser(getCurrentSessionUser());
  }, []);

  const isAdmin = sessionUser?.role === 'Admin' || sessionUser?.role === 'Finance' || sessionUser?.role === 'DOS';

  const handleOpenEdit = () => {
    const current = getWebsiteSettings();
    setFeesBadge(current.feesBadge || 'SCHOOL FEES');
    setFeesSubtitle(
      current.feesSubtitle ||
        'Discover the fee structure for each academic term at RUNDA TECHNICAL SECONDARY SCHOOL for seasoned students (L4, L5).'
    );
    setFirstTermPrice(current.feesFirstTerm || '92000.0');
    setSecondTermPrice(current.feesSecondTerm || '92000.0');
    setThirdTermPrice(current.feesThirdTerm || '92000.0');
    setCurrency(current.feesCurrency || 'Rwf');
    setPeriod(current.feesPeriod || '/ Term');
    setIncludedList([...(current.feesIncluded || includedList)]);
    setNotIncludedList([...(current.feesNotIncluded || notIncludedList)]);
    setIsEditModalOpen(true);
  };

  const handleAddIncluded = () => {
    setIncludedList([...includedList, 'New Included Item']);
  };

  const handleRemoveIncluded = (idx: number) => {
    setIncludedList(includedList.filter((_, i) => i !== idx));
  };

  const handleAddNotIncluded = () => {
    setNotIncludedList([...notIncludedList, 'New Non-Included Item']);
  };

  const handleRemoveNotIncluded = (idx: number) => {
    setNotIncludedList(notIncludedList.filter((_, i) => i !== idx));
  };

  const handleSaveFees = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: WebsiteSettings = {
      ...settings,
      feesBadge,
      feesSubtitle,
      feesFirstTerm: firstTermPrice,
      feesSecondTerm: secondTermPrice,
      feesThirdTerm: thirdTermPrice,
      feesCurrency: currency,
      feesPeriod: period,
      feesIncluded: includedList.filter((item) => item.trim().length > 0),
      feesNotIncluded: notIncludedList.filter((item) => item.trim().length > 0),
    };
    saveWebsiteSettings(updatedSettings);
    setSettings(updatedSettings);
    setSaveSuccessMsg('School fees updated and saved permanently to database!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsEditModalOpen(false);
    }, 1200);
  };

  const activeFirstTerm = settings.feesFirstTerm || '92000.0';
  const activeSecondTerm = settings.feesSecondTerm || '92000.0';
  const activeThirdTerm = settings.feesThirdTerm || '92000.0';
  const activeCurrency = settings.feesCurrency || 'Rwf';
  const activePeriod = settings.feesPeriod || '/ Term';
  const activeIncluded = settings.feesIncluded || [
    'Tuition Fees',
    'Administrative Charges',
    'Classroom Materials (Books, Stationery)',
    'ICT and Technical Education Resources',
    'Laboratory Fees (For Science students)',
    'Sports and Physical Education Fees',
    'Co-curricular activities',
  ];
  const activeNotIncluded = settings.feesNotIncluded || [
    'Uniform (Students must purchase separately)',
    'School Transport (If applicable)',
    'External Examination Fees (e.g., National Exams)',
    'Extra-Curricular Activity Fees (e.g., Clubs, Workshops)',
  ];

  const termCards = [
    {
      termName: 'First Term',
      price: activeFirstTerm,
      hasRibbon: false,
    },
    {
      termName: 'Second Term',
      price: activeSecondTerm,
      hasRibbon: false,
    },
    {
      termName: 'Third Term',
      price: activeThirdTerm,
      hasRibbon: true,
      ribbonText: 'Third Term',
    },
  ];

  return (
    <section className={`w-full py-12 px-4 sm:px-6 lg:px-8 bg-slate-50/70 ${className}`}>
      {/* Admin Live Edit Quick Access Bar */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 shadow-md flex items-center justify-between gap-4 border border-blue-700">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-400 text-blue-950 rounded-xl font-bold">
                <Edit3 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  School Fees Structure Editor
                </span>
                <span className="text-xs text-blue-100">
                  Logged in as {sessionUser?.name || 'Staff'}. Edits save permanently to the database for all visitors and staff.
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Fees</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Pill Badge & Subtitle - Exact Matching Capture_fff547f5.PNG */}
      {showTitle && (
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold tracking-wider uppercase shadow-xs mb-3">
            {settings.feesBadge || 'SCHOOL FEES'}
          </div>
          <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
            {settings.feesSubtitle ||
              'Discover the fee structure for each academic term at RUNDA TECHNICAL SECONDARY SCHOOL for seasoned students (L4, L5).'}
          </p>
        </div>
      )}

      {/* 3 Term Cards Grid - Exact Layout Matching Capture_fff547f5.PNG */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {termCards.map((card, index) => (
            <div
              key={index}
              className="relative bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 p-6 sm:p-8 flex flex-col overflow-hidden group"
            >
              {/* Corner Diagonal Blue Ribbon for Third Term (Exact Capture_fff547f5.PNG match) */}
              {card.hasRibbon && (
                <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none rounded-tr-2xl">
                  <div className="absolute top-6 -right-9 w-40 bg-[#0052cc] text-white text-[11px] font-bold text-center py-1.5 rotate-45 shadow-md uppercase tracking-wider">
                    {card.ribbonText}
                  </div>
                </div>
              )}

              {/* Term Title */}
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-display mb-2">
                {card.termName}
              </h3>

              {/* Price display */}
              <div className="text-lg sm:text-xl font-bold text-slate-800 mb-6">
                <span>{activeCurrency} </span>
                <span>{card.price} </span>
                <span className="text-slate-500 font-medium text-base">{activePeriod}</span>
              </div>

              {/* What's Included */}
              <div className="mb-6 flex-1">
                <h4 className="font-bold text-slate-900 text-sm mb-3">
                  What&apos;s Included:
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                  {activeIncluded.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* What's Not Included */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm mb-3">
                  What&apos;s Not Included:
                </h4>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600">
                  {activeNotIncluded.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Optional Quick Action */}
              {onOpenApply && (
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <button
                    onClick={onOpenApply}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-blue-900 active:scale-95 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Apply for {card.termName}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADMIN IN-PLACE LIVE EDIT MODAL */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-800 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-900 text-lg font-display">
                    Edit School Fees Structure
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes save permanently to the database and sync across all devices for visitors and staff.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveFees} className="space-y-6 text-xs">
              {/* Header Badge & Subtitle */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Section Header & Subtitle
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Pill Badge Text</label>
                    <input
                      type="text"
                      value={feesBadge}
                      onChange={(e) => setFeesBadge(e.target.value)}
                      placeholder="e.g. SCHOOL FEES"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1 text-slate-700">Subtitle Description</label>
                    <input
                      type="text"
                      value={feesSubtitle}
                      onChange={(e) => setFeesSubtitle(e.target.value)}
                      placeholder="Discover the fee structure..."
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Term Prices & Currency */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Term Pricing Configuration
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Currency</label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="Rwf"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Period</label>
                    <input
                      type="text"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="/ Term"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">First Term</label>
                    <input
                      type="text"
                      value={firstTermPrice}
                      onChange={(e) => setFirstTermPrice(e.target.value)}
                      placeholder="92000.0"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Second Term</label>
                    <input
                      type="text"
                      value={secondTermPrice}
                      onChange={(e) => setSecondTermPrice(e.target.value)}
                      placeholder="92000.0"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Third Term</label>
                    <input
                      type="text"
                      value={thirdTermPrice}
                      onChange={(e) => setThirdTermPrice(e.target.value)}
                      placeholder="92000.0"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* What's Included */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    What&apos;s Included ({includedList.length} items)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddIncluded}
                    className="cursor-pointer text-blue-700 hover:text-blue-900 font-bold inline-flex items-center gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {includedList.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...includedList];
                          next[idx] = e.target.value;
                          setIncludedList(next);
                        }}
                        className="flex-1 bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveIncluded(idx)}
                        className="cursor-pointer text-rose-500 hover:text-rose-700 p-1.5"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* What's Not Included */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    What&apos;s Not Included ({notIncludedList.length} items)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddNotIncluded}
                    className="cursor-pointer text-blue-700 hover:text-blue-900 font-bold inline-flex items-center gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {notIncludedList.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...notIncludedList];
                          next[idx] = e.target.value;
                          setNotIncludedList(next);
                        }}
                        className="flex-1 bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveNotIncluded(idx)}
                        className="cursor-pointer text-rose-500 hover:text-rose-700 p-1.5"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="cursor-pointer px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to Database</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
