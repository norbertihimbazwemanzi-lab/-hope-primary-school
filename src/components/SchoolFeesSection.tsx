import React, { useState, useEffect } from 'react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { Check, X, Edit3, Plus, Trash2, ArrowRight, ShieldCheck, CreditCard } from 'lucide-react';

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
  const [feesBadge, setFeesBadge] = useState<string>(settings.feesBadge || 'OFFICIAL FEE SCHEDULE');
  const [feesSubtitle, setFeesSubtitle] = useState<string>(
    settings.feesSubtitle ||
      'Transparent tuition and term schedule approved for all academic terms at Mugina Hope Academy.'
  );
  const [firstTermPrice, setFirstTermPrice] = useState<string>(settings.feesFirstTerm || '92000.0');
  const [secondTermPrice, setSecondTermPrice] = useState<string>(settings.feesSecondTerm || '92000.0');
  const [thirdTermPrice, setThirdTermPrice] = useState<string>(settings.feesThirdTerm || '92000.0');
  const [currency, setCurrency] = useState<string>(settings.feesCurrency || 'Rwf');
  const [period, setPeriod] = useState<string>(settings.feesPeriod || '/ Term');
  const [includedList, setIncludedList] = useState<string[]>(
    settings.feesIncluded || [
      'Core Classroom Tuition & CBC Teaching',
      'Daily Learning Materials (Books & Stationery)',
      'Science & Practical Laboratory Sessions',
      'ICT Technology & Computer Lab Access',
      'Physical Education, Sports & Co-Curriculars',
      'Continuous Assessment & Term Report Booklets',
    ]
  );
  const [notIncludedList, setNotIncludedList] = useState<string[]>(
    settings.feesNotIncluded || [
      'Official School Uniform & Sports Kit (Purchased at Bursar Desk)',
      'Daily School Van Transport (Optional by settlement/route)',
      'Mid-Day Hot Lunch & Nutrition Program (Optional term subscription)',
      'National Primary Leaving Examination (PLE) Registration (P6 Candidate Class)',
    ]
  );

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setFeesBadge(updated.feesBadge || 'OFFICIAL FEE SCHEDULE');
      setFeesSubtitle(
        updated.feesSubtitle ||
          'Transparent tuition and term schedule approved for all academic terms at Mugina Hope Academy.'
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
    setFeesBadge(current.feesBadge || 'OFFICIAL FEE SCHEDULE');
    setFeesSubtitle(
      current.feesSubtitle ||
        'Transparent tuition and term schedule approved for all academic terms at Mugina Hope Academy.'
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
    setIncludedList([...includedList, 'New Included Provision']);
  };

  const handleRemoveIncluded = (idx: number) => {
    setIncludedList(includedList.filter((_, i) => i !== idx));
  };

  const handleAddNotIncluded = () => {
    setNotIncludedList([...notIncludedList, 'New Optional/Separate Item']);
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
  const activeIncluded = settings.feesIncluded || includedList;
  const activeNotIncluded = settings.feesNotIncluded || notIncludedList;

  const termCards = [
    {
      termName: 'First Term (Term 1)',
      periodDates: 'January – April',
      price: activeFirstTerm,
      status: 'Academic Term 1',
    },
    {
      termName: 'Second Term (Term 2)',
      periodDates: 'May – July',
      price: activeSecondTerm,
      status: 'Academic Term 2',
    },
    {
      termName: 'Third Term (Term 3)',
      periodDates: 'September – November',
      price: activeThirdTerm,
      status: 'Academic Term 3',
    },
  ];

  return (
    <section className={`w-full py-12 px-4 sm:px-6 lg:px-8 bg-white border-t border-b border-slate-200/80 ${className}`}>
      {/* Admin Live Edit Quick Access Bar */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-slate-900 text-white rounded-lg p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-blue-900 text-white rounded-md shrink-0">
                <Edit3 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-white block">
                  School Fee Structure Editor
                </span>
                <span className="text-[11px] text-slate-400">
                  Logged in as {sessionUser?.name || 'Administrator'}. Changes sync permanently to Firestore.
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 font-semibold text-xs rounded-md shadow-xs transition-colors self-end sm:self-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Fee Schedule</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Label & Subtitle - Clean Editorial Typography */}
      {showTitle && (
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-md border border-slate-300 bg-slate-50 text-slate-700 text-xs font-semibold tracking-wider uppercase mb-3">
            {settings.feesBadge || 'OFFICIAL FEE SCHEDULE'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Tuition & Academic Term Fees
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            {settings.feesSubtitle ||
              'Transparent tuition and term schedule approved for all academic terms at Mugina Hope Academy.'}
          </p>
        </div>
      )}

      {/* 3 Term Cards - Clean Educational Table Grid */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {termCards.map((card, index) => (
            <div
              key={index}
              className="bg-slate-50 rounded-lg border border-slate-200 p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 mb-4">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {card.termName}
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded-sm border border-slate-200">
                    {card.periodDates}
                  </span>
                </div>

                {/* Price Display */}
                <div className="mb-5">
                  <span className="text-xs font-medium text-slate-500 block mb-0.5">Approved Term Fee</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-slate-700">{activeCurrency}</span>
                    <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                      {card.price}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{activePeriod}</span>
                  </div>
                </div>

                {/* What's Included */}
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                    Included in Term Tuition
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {activeIncluded.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What's Not Included */}
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Additional Requirements
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-500">
                    {activeNotIncluded.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              {onOpenApply && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <button
                    onClick={onOpenApply}
                    className="w-full py-2 px-3 bg-blue-950 hover:bg-blue-900 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Apply for {card.termName}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Official Bursar & Bank Channels Note */}
        <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-slate-700 shrink-0" />
            <span>
              <strong>Bank of Kigali (BK):</strong> Account 00040-0694852-33 &nbsp;|&nbsp; <strong>MTN MoMo Pay Merchant:</strong> 788258
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Official bank slips or transaction confirmations must be presented to Bursar for verified receipt.
          </span>
        </div>
      </div>

      {/* Admin Live Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-900 rounded-md">
                  <Edit3 className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  Edit School Fees Schedule
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-md flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveFees} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Term 1 Rate (Rwf)</label>
                  <input
                    type="text"
                    value={firstTermPrice}
                    onChange={(e) => setFirstTermPrice(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Term 2 Rate (Rwf)</label>
                  <input
                    type="text"
                    value={secondTermPrice}
                    onChange={(e) => setSecondTermPrice(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Term 3 Rate (Rwf)</label>
                  <input
                    type="text"
                    value={thirdTermPrice}
                    onChange={(e) => setThirdTermPrice(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Inclusions */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Included Items ({includedList.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddIncluded}
                    className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-blue-900 bg-blue-50 rounded-md border border-blue-200"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>
                {includedList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...includedList];
                        updated[idx] = e.target.value;
                        setIncludedList(updated);
                      }}
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveIncluded(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Exclusions */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Additional Requirements ({notIncludedList.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddNotIncluded}
                    className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-blue-900 bg-blue-50 rounded-md border border-blue-200"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>
                {notIncludedList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const updated = [...notIncludedList];
                        updated[idx] = e.target.value;
                        setNotIncludedList(updated);
                      }}
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNotIncluded(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Fees</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
