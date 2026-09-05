import React, { useState } from 'react';
import { CivicReport, UserProfile } from '../types';
import { AuthService, MASTER_ADMIN_EMAIL } from '../services/authService';

// =============================================================================
// 1. SECRET ADMIN GATE MODAL (Completely Hidden from Public View)
// =============================================================================
interface SecretAdminGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (adminUser: UserProfile) => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const SecretAdminGateModal: React.FC<SecretAdminGateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [email, setEmail] = useState(MASTER_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = () => {
    setError('');
    setIsVerifying(true);

    setTimeout(() => {
      const res = AuthService.unlockAdminViaCredentials(password, email);
      if (res.success && res.user) {
        onSuccess(res.user);
        onShowToast(`Super Admin Authenticated: ${res.user.fullName} 👑`, 'admin_panel_settings');
        onClose();
      } else {
        setError(res.error || 'Authentication failed. Unauthorized access prohibited.');
      }
      setIsVerifying(false);
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 text-white w-full max-w-sm rounded-[28px] p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="material-symbols-outlined text-[24px]">shield</span>
            <span className="font-bold text-sm uppercase tracking-wider">Super Admin Gate</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="text-xs text-slate-300 leading-relaxed">
          Exclusive master administrator command gate. Enter authorized Super Admin credentials.
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
              Administrator Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="anujvishwakarm1308@gmail.com"
              className="w-full bg-slate-800 text-white text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
              Master Password
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUnlock();
              }}
              placeholder="Enter Super Admin Password"
              className="w-full bg-slate-800 text-white font-mono text-xs p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={isVerifying || !password}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
          >
            {isVerifying ? (
              <span>Verifying...</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                <span>Unlock Gate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// 2. CITIZEN AUTHENTICATION MODAL (Sign In & Sign Up)
// =============================================================================
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  onShowToast: (msg: string, icon?: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess, onShowToast }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (tab === 'signup') {
        const res = await AuthService.signUp(fullName, email, password, phone);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
          onShowToast(`Welcome to CivicAI, ${res.user.fullName}!`, 'verified');
          onClose();
        } else {
          setError(res.error || 'Sign up failed.');
        }
      } else {
        const res = await AuthService.signIn(email, password);
        if (res.success && res.user) {
          onAuthSuccess(res.user);
          onShowToast(`Welcome back, ${res.user.fullName}!`, 'person');
          onClose();
        } else {
          setError(res.error || 'Sign in failed.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white max-w-md w-full rounded-[28px] shadow-2xl p-6 space-y-4 border border-slate-200">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700 text-[24px]">account_circle</span>
            <h3 className="font-bold text-base text-slate-900">
              {tab === 'signin' ? 'Sign In to CivicAI' : 'Create Citizen Account'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'signin' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              tab === 'signup' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign Up (Free)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {tab === 'signup' && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Full Legal Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kulkarni"
                className="w-full bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. citizen@smartcity.gov.in"
              className="w-full bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          {tab === 'signup' && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Mobile Phone (Optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98230 XXXXX"
                className="w-full bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-bold mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full bg-slate-50 text-slate-900 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : tab === 'signin' ? 'Sign In to Account' : 'Register Verified Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// 3. CITIZEN PROFILE MODAL (Real dynamic profile, NO fake Aditi Sharma data)
// =============================================================================
interface ProfileModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  reports: CivicReport[];
  onClose: () => void;
  onSignOut: () => void;
  onOpenAuthModal: () => void;
  onShowToast: (msg: string, icon?: string) => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
  onTrackReport?: (reportId: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  currentUser,
  reports,
  onClose,
  onSignOut,
  onOpenAuthModal,
  onShowToast,
  onUpdateUser,
  onTrackReport,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'reports' | 'security'>('overview');

  // Edit form state
  const [editFullName, setEditFullName] = useState(currentUser?.fullName || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editWard, setEditWard] = useState(currentUser?.ward || 'Central Municipal Ward');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Sync state when modal opens or user changes
  React.useEffect(() => {
    if (currentUser) {
      setEditFullName(currentUser.fullName);
      setEditPhone(currentUser.phone || '');
      setEditWard(currentUser.ward || 'Central Municipal Ward');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormError('');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white max-w-sm w-full rounded-[28px] shadow-2xl p-6 space-y-4 border border-slate-200 text-center">
          <div className="w-14 h-14 rounded-full bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">account_circle</span>
          </div>
          <h3 className="font-bold text-base text-slate-900">Guest Visitor</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sign in to track your personal reports, receive official municipal SMS/Email resolution updates, and manage your account.
          </p>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              Sign In or Register
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const myReports = reports.filter((r) => r.userId === currentUser.id || r.reporterName === currentUser.fullName);
  const myResolved = myReports.filter((r) => r.status === 'RESOLVED');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (newPassword && newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    const res = await AuthService.updateUserProfile(
      currentUser.id,
      {
        fullName: editFullName,
        phone: editPhone,
        ward: editWard,
      },
      currentPassword || undefined,
      newPassword || undefined
    );

    setIsSaving(false);

    if (res.success && res.user) {
      onUpdateUser(res.user);
      onShowToast('Citizen Profile Updated Successfully!', 'verified');
      setActiveTab('overview');
    } else {
      setFormError(res.error || 'Failed to update profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white max-w-lg w-full rounded-[28px] shadow-2xl p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3 border-slate-100">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700 text-[24px]">badge</span>
            <h4 className="font-bold text-base text-slate-900">Citizen Civic Account</h4>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'overview' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'edit' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Edit Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'reports' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Reports ({myReports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
              activeTab === 'security' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Security 🛡️
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="w-14 h-14 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-lg shrink-0">
                {currentUser.fullName.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900 truncate">{currentUser.fullName}</h3>
                <p className="text-xs text-slate-500 font-label-code truncate">{currentUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    <span>Verified Citizen</span>
                  </span>
                  {currentUser.role === 'admin' && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <span className="material-symbols-outlined text-[12px]">admin_panel_settings</span>
                      <span>{currentUser.isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-center">
                <span className="text-[10px] text-slate-400 font-medium block">Total Reports</span>
                <span className="text-xl font-bold text-slate-900">{myReports.length}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-center">
                <span className="text-[10px] text-amber-500 font-medium block">In Progress</span>
                <span className="text-xl font-bold text-amber-600">
                  {myReports.filter((r) => r.status !== 'RESOLVED').length}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-center">
                <span className="text-[10px] text-emerald-500 font-medium block">Resolved</span>
                <span className="text-xl font-bold text-emerald-600">{myResolved.length}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Mobile Phone:</span>
                <span className="font-semibold text-slate-900">{currentUser.phone || 'Not provided'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Registered Ward:</span>
                <span className="font-semibold text-slate-900">{currentUser.ward || 'Central Municipal Ward'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Account Role:</span>
                <span className="font-bold text-teal-800 uppercase">{currentUser.role}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Member Since:</span>
                <span className="font-medium text-slate-700">
                  {new Date(currentUser.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="flex-1 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Edit Details</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reports')}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>View Reports</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EDIT PROFILE */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSaveProfile} className="space-y-3 text-xs animate-in fade-in">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Full Legal Name</label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Mobile Phone</label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 98230 XXXXX"
                className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Registered Municipal Ward</label>
              <input
                type="text"
                value={editWard}
                onChange={(e) => setEditWard(e.target.value)}
                placeholder="e.g. Ward 24 (Central Zone)"
                className="w-full bg-slate-50 text-slate-900 p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>

            {/* Change Password Sub-Section */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2 mt-2">
              <span className="font-bold text-slate-800 block text-xs">Change Password (Optional)</span>
              <div>
                <label className="block text-[11px] text-slate-500 mb-0.5">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required only to set new password"
                  className="w-full bg-white text-slate-900 text-xs p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-white text-slate-900 text-xs p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-0.5">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-white text-slate-900 text-xs p-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-600 font-medium"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{formError}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: MY REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-3 animate-in fade-in">
            {myReports.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <span className="material-symbols-outlined text-[36px] text-slate-300 block mb-1">
                  receipt_long
                </span>
                You haven't submitted any civic issue reports yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {myReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 bg-slate-50 hover:bg-teal-50/60 rounded-xl border border-slate-200/80 transition-colors flex items-center justify-between text-xs cursor-pointer"
                    onClick={() => {
                      onClose();
                      if (onTrackReport) onTrackReport(report.id);
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-label-code font-bold text-teal-800">{report.id}</span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            report.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : report.status === 'IN PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {report.status}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 truncate">{report.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">{report.location}</div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">
                      arrow_forward
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SECURITY & ACCOUNT PROTECTION */}
        {activeTab === 'security' && (
          <div className="space-y-4 text-xs animate-in fade-in">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <span className="material-symbols-outlined text-[20px]">lock</span>
                <span>Single-Owner Account Isolation Active</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Your account is cryptographically isolated. Only your verified email and password credentials can inspect, edit, or manage your profile and filed civic complaints.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-slate-700">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Account Identifier:</span>
                <span className="font-mono text-[11px] text-slate-500 truncate max-w-[170px]">{currentUser.id}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Anti-Brute Force Protection:</span>
                <span className="text-emerald-700 font-bold">5 Attempts = 5 min Lockout</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span>Session Expiration:</span>
                <span className="font-semibold text-slate-800">24-Hour Rotating Token</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Data Encryption:</span>
                <span className="text-teal-800 font-bold">256-Bit SHA-256 Hashed</span>
              </div>
            </div>

            <button
              onClick={() => {
                onSignOut();
                onShowToast('Signed out of CivicAI session.', 'logout');
                onClose();
              }}
              className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-2"
            >
              <span className="material-symbols-outlined text-[16px]">logout</span>
              <span>Sign Out of Session</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


// =============================================================================
// 4. FULLSCREEN LIGHTBOX MODAL
// =============================================================================
interface FullscreenModalProps {
  isOpen: boolean;
  imageUrl: string;
  filename: string;
  onClose: () => void;
}

export const FullscreenModal: React.FC<FullscreenModalProps> = ({ isOpen, imageUrl, filename, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between text-white pt-safe">
        <span className="text-xs font-mono">{filename}</span>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 cursor-pointer"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-2">
        <img alt="Evidence" className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl" src={imageUrl} />
      </div>

      <div className="text-center text-white/70 text-xs pb-safe font-mono">
        Optical Evidence • Cryptographically Verified Geotag
      </div>
    </div>
  );
};
