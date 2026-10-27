import React, { useState, useEffect } from 'react';
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  getCurrentSessionUser,
  WebsiteSettings,
} from '../services/adminStore';
import { uploadSchoolAsset } from '../services/storageService';
import { Edit3, Check, X, Plus, Trash2, Mail, Phone, Upload, Shield } from 'lucide-react';

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
  const [staffBadge, setStaffBadge] = useState<string>(settings.staffBadge || 'FACULTY & LEADERSHIP');
  const [staffSubtitle, setStaffSubtitle] = useState<string>(
    settings.staffSubtitle ||
      'Meet our dedicated team of educators and administrative leaders ensuring academic excellence and moral formation in Kamonyi District.'
  );
  const [staffList, setStaffList] = useState<StaffShowcaseMember[]>(settings.staffShowcase || []);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [uploadingStaffId, setUploadingStaffId] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      const updated = e.detail || getWebsiteSettings();
      setSettings(updated);
      setStaffBadge(updated.staffBadge || 'FACULTY & LEADERSHIP');
      setStaffSubtitle(
        updated.staffSubtitle ||
          'Meet our dedicated team of educators and administrative leaders ensuring academic excellence and moral formation in Kamonyi District.'
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
    setStaffBadge(current.staffBadge || 'FACULTY & LEADERSHIP');
    setStaffSubtitle(
      current.staffSubtitle ||
        'Meet our dedicated team of educators and administrative leaders ensuring academic excellence and moral formation in Kamonyi District.'
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
      role: 'Class Teacher',
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
    setSaveSuccessMsg('School staff directory saved permanently to database!');
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
      role: 'Dean Of Studies (DOS)',
      email: 'dos@muginahopeschool.com',
      phone: '+250 788 345 678',
      imageUrl: '/images/staff_eric_dos.png',
      order: 2,
    },
    {
      id: 'staff-lead-3',
      name: 'UWIMBABAZI Christine',
      role: 'Dean Of Discipline (DOD)',
      email: 'dod@muginahopeschool.com',
      phone: '+250 788 567 890',
      imageUrl: '/images/staff_christine_dod.png',
      order: 3,
    },
    {
      id: 'staff-lead-4',
      name: 'NSENGIMANA Bonaventure',
      role: 'Accountant & Bursar',
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
    <section className={`w-full py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-b border-slate-200/80 ${className}`}>
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
                  Staff Leadership Directory Editor
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
              <span>Edit Staff Directory</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Label & Subtitle - Clean Editorial Typography */}
      {showTitle && (
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold tracking-wider uppercase mb-3">
            {settings.staffBadge || 'FACULTY & LEADERSHIP'}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
            School Leadership & Key Staff
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            {settings.staffSubtitle ||
              'Meet our dedicated team of educators and administrative leaders ensuring academic excellence and moral formation in Kamonyi District.'}
          </p>
        </div>
      )}

      {/* 4 Clean Rectangular Cards - Professional Academic Directory Layout */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {currentMembers.map((member, index) => {
            return (
              <div
                key={member.id || index}
                className="bg-white rounded-lg border border-slate-200 shadow-xs hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col"
              >
                {/* Rectangular Portrait Photo */}
                <div className="w-full aspect-[4/5] bg-slate-100 overflow-hidden relative border-b border-slate-100">
                  <img
                    src={
                      ((member.name.toLowerCase().includes('enos') || member.role.toLowerCase().includes('manager')) && settings.schoolManagerPhotoUrl)
                        ? settings.schoolManagerPhotoUrl
                        : member.imageUrl === '/images/staff_enos_manager.png'
                        ? (settings.schoolManagerPhotoUrl || '/images/hero_mugina_hope_campus_1791823254957.jpg')
                        : member.imageUrl
                    }
                    alt={member.name}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/images/hero_mugina_hope_campus_1791823254957.jpg';
                    }}
                  />
                </div>

                {/* Card Body: Name & Role */}
                <div className="p-4 sm:p-5 text-center flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug tracking-tight mb-1">
                      {member.name}
                    </h3>
                    <p className="text-xs font-medium text-blue-900 mb-2">
                      {member.role}
                    </p>
                  </div>

                  {/* Contact Info */}
                  {(member.email || member.phone) && (
                    <div className="pt-3 border-t border-slate-100 space-y-1">
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="text-[11px] text-slate-600 hover:text-blue-900 flex items-center justify-center gap-1.5 transition-colors truncate"
                        >
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </a>
                      )}
                      {member.phone && (
                        <a
                          href={`tel:${member.phone.replace(/\s+/g, '')}`}
                          className="text-[11px] text-slate-600 hover:text-blue-900 flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{member.phone}</span>
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

      {/* Admin Live Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-50 text-blue-900 rounded-md">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">
                    Edit Staff Directory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Changes save permanently to the database and sync across all devices.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-md flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveStaff} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section Header Tag
                  </label>
                  <input
                    type="text"
                    value={staffBadge}
                    onChange={(e) => setStaffBadge(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section Description
                  </label>
                  <input
                    type="text"
                    value={staffSubtitle}
                    onChange={(e) => setStaffSubtitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Staff Members List */}
              <div className="space-y-4 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Staff Profiles ({staffList.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStaffMember}
                    className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Staff Member</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {staffList.map((member, index) => (
                    <div
                      key={member.id || index}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Staff #{index + 1}</span>
                        {staffList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStaffMember(index)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => handleStaffChange(index, 'name', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">Designation / Role</label>
                          <input
                            type="text"
                            value={member.role}
                            onChange={(e) => handleStaffChange(index, 'role', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">Official Email</label>
                          <input
                            type="email"
                            value={member.email || ''}
                            onChange={(e) => handleStaffChange(index, 'email', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-600 mb-1">Official Phone</label>
                          <input
                            type="text"
                            value={member.phone || ''}
                            onChange={(e) => handleStaffChange(index, 'phone', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="flex-1">
                          <label className="block text-[11px] text-slate-600 mb-1">Portrait Image URL</label>
                          <input
                            type="text"
                            value={member.imageUrl}
                            onChange={(e) => handleStaffChange(index, 'imageUrl', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden"
                          />
                        </div>
                        <div className="pt-5">
                          <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-2.5 py-1.5 rounded-md whitespace-nowrap">
                            <Upload className="w-3 h-3 text-slate-500" />
                            <span>{uploadingStaffId === member.id ? 'Uploading...' : 'Upload Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingStaffId === member.id}
                              onChange={(e) => handleStaffPhotoUpload(index, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-md transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Staff Directory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
