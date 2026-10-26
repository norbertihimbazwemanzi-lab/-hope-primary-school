import React, { useState, useEffect } from 'react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { uploadSchoolAsset } from '../services/storageService';
import { Edit3, Check, X, Plus, Trash2, Mail, Phone, Upload, CheckCircle2, Shield } from 'lucide-react';

export interface StaffShowcaseMember {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  imageUrl: string;
  order?: number;
}

interface SchoolStaffSectionProps {
  className?: string;
  showTitle?: boolean;
}

export const SchoolStaffSection: React.FC<SchoolStaffSectionProps> = ({
  className = '',
  showTitle = true,
}) => {
  const [settings, setSettings] = useState<WebsiteSettings>(getWebsiteSettings());
  const [sessionUser, setSessionUser] = useState(getCurrentSessionUser());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [staffBadge, setStaffBadge] = useState<string>(settings.staffBadge || 'SCHOOL STAFF');
  const [staffSubtitle, setStaffSubtitle] = useState<string>(
    settings.staffSubtitle ||
      'Meet our dedicated team of educators and support staff who ensure our students thrive in a nurturing environment.'
  );
  const [staffList, setStaffList] = useState<StaffShowcaseMember[]>(settings.staffShowcase || []);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setStaffBadge(updated.staffBadge || 'SCHOOL STAFF');
      setStaffSubtitle(
        updated.staffSubtitle ||
          'Meet our dedicated team of educators and support staff who ensure our students thrive in a nurturing environment.'
      );
      setStaffList(updated.staffShowcase || []);
    };
    window.addEventListener('mugina-settings-updated', handleUpdate);
    return () => window.removeEventListener('mugina-settings-updated', handleUpdate);
  }, []);

  useEffect(() => {
    setSessionUser(getCurrentSessionUser());
  }, []);

  const isAdmin = sessionUser?.role === 'Admin' || sessionUser?.role === 'DOS';

  const handleOpenEdit = () => {
    const current = getWebsiteSettings();
    setStaffBadge(current.staffBadge || 'SCHOOL STAFF');
    setStaffSubtitle(
      current.staffSubtitle ||
        'Meet our dedicated team of educators and support staff who ensure our students thrive in a nurturing environment.'
    );
    setStaffList([...(current.staffShowcase || [])]);
    setIsEditModalOpen(true);
  };

  const handleStaffChange = (index: number, field: keyof StaffShowcaseMember, value: string) => {
    const next = [...staffList];
    next[index] = { ...next[index], [field]: value };
    setStaffList(next);
  };

  const handleAddStaffMember = () => {
    const newMember: StaffShowcaseMember = {
      id: `staff-${Date.now()}`,
      name: 'New Staff Member',
      role: 'Educator',
      email: 'staff@muginahopeschool.com',
      phone: '+250 788 000 000',
      imageUrl: '/images/hero_mugina_hope_campus_1791823254957.jpg',
      order: staffList.length + 1,
    };
    setStaffList([...staffList, newMember]);
  };

  const handleRemoveStaffMember = (index: number) => {
    const next = staffList.filter((_, idx) => idx !== index);
    setStaffList(next);
  };

  const handleStaffPhotoUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const member = staffList[index];
    if (file && member) {
      setUploadingStaffId(member.id);
      try {
        const uploadRes = await uploadSchoolAsset(file, `staff_photo_${member.id}`, 'branding');
        handleStaffChange(index, 'imageUrl', uploadRes.url);
      } catch (err) {
        console.warn('Error uploading staff photo:', err);
      } finally {
        setUploadingStaffId(null);
      }
    }
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSettings: WebsiteSettings = {
      ...settings,
      staffBadge,
      staffSubtitle,
      staffShowcase: staffList,
    };
    saveWebsiteSettings(updatedSettings);
    setSettings(updatedSettings);
    setSaveSuccessMsg('School staff updated and saved permanently to database!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
      setIsEditModalOpen(false);
    }, 1200);
  };

  const defaultShowcaseMembers: StaffShowcaseMember[] = [
    {
      id: 'staff-lead-1',
      name: 'HAKIZIMANA Enos',
      role: 'School Manager',
      email: 'manager@muginahopeschool.com',
      phone: '+250 788 258 786',
      imageUrl: '/images/staff_enos_manager.png',
      order: 1,
    },
    {
      id: 'staff-lead-2',
      name: 'MBONIGABA Eric',
      role: 'Dean Of Studies',
      email: 'dos@muginahopeschool.com',
      phone: '+250 788 345 678',
      imageUrl: '/images/staff_eric_dos.png',
      order: 2,
    },
    {
      id: 'staff-lead-3',
      name: 'UWIMBABAZI Christine',
      role: 'Dean Of Discipline',
      email: 'dod@muginahopeschool.com',
      phone: '+250 788 567 890',
      imageUrl: '/images/staff_christine_dod.png',
      order: 3,
    },
    {
      id: 'staff-lead-4',
      name: 'NSENGIMANA Bonaventure',
      role: 'Accountant',
      email: 'finance@muginahopeschool.com',
      phone: '+250 788 444 555',
      imageUrl: '/images/staff_bonaventure_accountant.png',
      order: 4,
    },
  ];

  const currentMembers =
    settings.staffShowcase && settings.staffShowcase.length > 0
      ? settings.staffShowcase
      : defaultShowcaseMembers;

  return (
    <section className={`w-full py-8 sm:py-12 px-3 xs:px-4 sm:px-6 lg:px-8 bg-slate-50/60 ${className}`}>
      {/* Admin Live Edit Quick Access Bar */}
      {isAdmin && (
        <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-3 sm:p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border border-blue-700">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-400 text-blue-950 rounded-xl font-bold shrink-0">
                <Edit3 className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  Staff Leadership Section Editor
                </span>
                <span className="text-xs text-blue-100">
                  Logged in as {sessionUser?.name || 'Staff'}. Edits save permanently to the database for all visitors and devices.
                </span>
              </div>
            </div>
            <button
              onClick={handleOpenEdit}
              className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-blue-950 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 shrink-0 self-end sm:self-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Staff</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Pill & Subtitle - Exact Matching Capture_cd3b07eb.PNG */}
      {showTitle && (
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-bold tracking-wider uppercase shadow-xs mb-3">
            {settings.staffBadge || 'SCHOOL STAFF'}
          </div>
          <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed">
            {settings.staffSubtitle ||
              'Meet our dedicated team of educators and support staff who ensure our students thrive in a nurturing environment.'}
          </p>
        </div>
      )}

      {/* 4 Rectangular Cards - Exact Layout Matching Capture_cd3b07eb.PNG */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {currentMembers.map((member, index) => {
            return (
              <div
                key={member.id || index}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group"
              >
                {/* Rectangular Portrait Photo */}
                <div className="w-full aspect-[4/5] bg-slate-100 overflow-hidden relative">
                  <img
                    src={member.imageUrl}
                    alt={member.name}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/public/assets/aistudio/Capture_cd3b07eb.PNG';
                    }}
                  />
                </div>

                {/* Card Body: Name & Role */}
                <div className="p-5 text-center flex-1 flex flex-col justify-center">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg leading-snug tracking-tight font-display mb-1">
                    {member.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    {member.role}
                  </p>

                  {/* Optional contact info */}
                  {(member.email || member.phone) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="text-[11px] text-blue-600 hover:text-blue-800 block truncate transition-colors"
                        >
                          {member.email}
                        </a>
                      )}
                      {member.phone && (
                        <a
                          href={`tel:${member.phone.replace(/\s+/g, '')}`}
                          className="text-[11px] text-slate-500 hover:text-blue-600 block transition-colors"
                        >
                          {member.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
                    Edit School Staff
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

            <form onSubmit={handleSaveStaff} className="space-y-6 text-xs">
              {/* Header Badge & Subtitle Fields */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Section Header & Subtitle
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold block mb-1 text-slate-700">Pill Badge Text</label>
                    <input
                      type="text"
                      value={staffBadge}
                      onChange={(e) => setStaffBadge(e.target.value)}
                      placeholder="e.g. SCHOOL STAFF"
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-bold block mb-1 text-slate-700">Subtitle Description</label>
                    <input
                      type="text"
                      value={staffSubtitle}
                      onChange={(e) => setStaffSubtitle(e.target.value)}
                      placeholder="Meet our dedicated team..."
                      className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Staff Members List */}
              <div className="space-y-4">
                {staffList.map((staff, idx) => (
                  <div
                    key={staff.id || idx}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                        Member #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStaffMember(idx)}
                        className="cursor-pointer text-rose-600 hover:text-rose-800 text-xs font-semibold inline-flex items-center gap-1"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold block mb-1 text-slate-700">Full Name</label>
                        <input
                          type="text"
                          value={staff.name}
                          onChange={(e) => handleStaffChange(idx, 'name', e.target.value)}
                          placeholder="e.g. HAKIZIMANA Enos"
                          className="w-full bg-white border border-slate-300 p-2 rounded-lg font-bold text-slate-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="font-bold block mb-1 text-slate-700">Role / Position</label>
                        <input
                          type="text"
                          value={staff.role}
                          onChange={(e) => handleStaffChange(idx, 'role', e.target.value)}
                          placeholder="e.g. School Manager, Dean Of Studies"
                          className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                          required
                        />
                      </div>

                      <div>
                        <label className="font-bold block mb-1 text-slate-700">Email Address (Optional)</label>
                        <input
                          type="email"
                          value={staff.email || ''}
                          onChange={(e) => handleStaffChange(idx, 'email', e.target.value)}
                          placeholder="e.g. manager@muginahopeschool.com"
                          className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="font-bold block mb-1 text-slate-700">Phone Number (Optional)</label>
                        <input
                          type="text"
                          value={staff.phone || ''}
                          onChange={(e) => handleStaffChange(idx, 'phone', e.target.value)}
                          placeholder="e.g. +250 788 258 786"
                          className="w-full bg-white border border-slate-300 p-2 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
                      <div className="sm:col-span-3 flex items-center gap-2">
                        <img
                          src={staff.imageUrl}
                          alt={staff.name}
                          className="w-12 h-14 rounded-lg object-cover border border-slate-300 shadow-xs"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = '/public/assets/aistudio/Capture_cd3b07eb.PNG';
                          }}
                        />
                        <span className="text-[11px] text-slate-500 font-medium">Portrait</span>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="font-bold block mb-1 text-slate-700 text-[11px]">
                          Upload Photo (PNG/JPG)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleStaffPhotoUpload(idx, e)}
                          className="w-full bg-white border border-slate-300 p-1.5 rounded-lg text-xs cursor-pointer"
                        />
                        {uploadingStaffId === staff.id && (
                          <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                            Uploading photo to storage...
                          </span>
                        )}
                      </div>

                      <div className="sm:col-span-4">
                        <label className="font-bold block mb-1 text-slate-700 text-[11px]">
                          Or Image URL
                        </label>
                        <input
                          type="text"
                          value={staff.imageUrl}
                          onChange={(e) => handleStaffChange(idx, 'imageUrl', e.target.value)}
                          placeholder="e.g. /images/staff_enos_manager.png"
                          className="w-full bg-white border border-slate-300 p-2 rounded-lg font-mono text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleAddStaffMember}
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 text-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Another Staff Member</span>
                </button>

                <div className="flex items-center gap-2">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
