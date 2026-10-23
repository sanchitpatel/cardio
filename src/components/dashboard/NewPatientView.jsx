import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  UserCirclePlus, 
  ArrowRight, 
  HourglassHigh, 
  Phone, 
  FirstAid, 
  FileText, 
  User, 
  CheckCircle, 
  Ticket, 
  Sparkle, 
  X, 
  WarningCircle, 
  Queue, 
  Users,
  Printer
} from '@phosphor-icons/react';
import { registerNewPatient } from '../../services/clinicService';

export const NewPatientView = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    phone: '',
    concern: '',
    problem_details: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && registrationSuccess) {
        setRegistrationSuccess(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [registrationSuccess]);

  // 1. Patient Name: Alphabets and spaces only, max 50 chars
  const handleNameChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ');
    if (val.length <= 50) {
      setFormData((prev) => ({ ...prev, name: val }));
      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
    }
  };

  // 2. Age: Numbers only, max 3 digits, realistic age (1-120)
  const handleAgeChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 3);
    if (digitsOnly === '' || Number(digitsOnly) <= 120) {
      setFormData((prev) => ({ ...prev, age: digitsOnly }));
      if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
    }
  };

  // 3. Mobile (WhatsApp): Digits only, exactly 10 digits
  const handlePhoneChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digitsOnly }));
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
  };

  // 4. Type of Concern: Alphabets, numbers, spaces, medical punctuation (.,/&()-), max 80 chars
  const handleConcernChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9\s.,/&()-]/g, '');
    if (val.length <= 80) {
      setFormData((prev) => ({ ...prev, concern: val }));
      if (errors.concern) setErrors((prev) => ({ ...prev, concern: '' }));
    }
  };

  // 5. Problem Details: Up to 1000 characters
  const handleProblemDetailsChange = (e) => {
    const val = e.target.value;
    if (val.length <= 1000) {
      setFormData((prev) => ({ ...prev, problem_details: val }));
      if (errors.problem_details) setErrors((prev) => ({ ...prev, problem_details: '' }));
    }
  };

  // Comprehensive Form Validation
  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = 'Patient name is required.';
    } else if (trimmedName.length < 2) {
      newErrors.name = 'Please enter a valid patient name.';
    }

    const ageNum = parseInt(formData.age, 10);
    if (!formData.age) {
      newErrors.age = 'Age is required.';
    } else if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      newErrors.age = 'Please enter a valid age (1-120).';
    }

    const digitsOnly = formData.phone.replace(/\D/g, '');
    if (!digitsOnly) {
      newErrors.phone = 'Mobile number is required.';
    } else if (digitsOnly.length !== 10) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number.';
    }

    const trimmedConcern = formData.concern.trim();
    if (!trimmedConcern) {
      newErrors.concern = 'Type of concern / disease is required.';
    } else if (trimmedConcern.length < 2) {
      newErrors.concern = 'Please enter a valid concern or diagnosis.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const res = await registerNewPatient({
        name: formData.name,
        age: formData.age,
        mobile: formData.phone,
        concern: formData.concern,
        problem_details: formData.problem_details
      });

      if (res.success && res.data) {
        setRegistrationSuccess({
          name: formData.name,
          age: formData.age,
          phone: formData.phone,
          concern: formData.concern,
          problem_details: formData.problem_details,
          date: new Date().toLocaleDateString('en-GB'),
          token_number: res.data.token_number || res.data.tokenNumber || '1',
          patient_id_code: res.data.patient_id_code || res.data.patientIdCode || 'PM-1001',
          message: res.data.message || 'Patient registered successfully!'
        });
        // Reset form inputs
        setFormData({
          name: '',
          age: '',
          phone: '',
          concern: '',
          problem_details: '',
        });
        setErrors({});
      } else {
        setSubmitError('Unable to complete registration. Please check your internet connection and try again.');
      }
    } catch (err) {
      setSubmitError('Unable to complete registration. Please check your internet connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintParcha = () => {
    window.print();
  };

  const handleCloseModal = () => {
    setRegistrationSuccess(null);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-0 sm:pb-4 border-b-0 sm:border-b border-zinc-300/60">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-[#e6ebf2] shadow-[4px_4px_8px_#c2c9d4,-4px_-4px_8px_#ffffff] border border-white/80 flex items-center justify-center text-emerald-700 shrink-0">
              <UserCirclePlus size={34} weight="duotone" className="mt-0.5" />
            </span>
            <span>New Patient Registration</span>
          </h2>
          <p className="text-[12px] sm:text-sm text-zinc-500 mt-1 ml-[60px]">
            Registering a first-time patient - <strong>Automatically assigns token number</strong>.
          </p>
        </div>
      </div>

      {/* Error Banner with Inward Neumorphic Shadow */}
      {submitError && (
        <div className="bg-[#fceeed] border border-rose-300/70 rounded-2xl p-3.5 sm:p-4 shadow-[inset_3px_3px_6px_#f5c6cb,inset_-3px_-3px_6px_#ffffff] flex items-center justify-between gap-3 text-rose-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#e6ebf2] shadow-[inset_1.5px_1.5px_3px_#f5c6cb,inset_-1.5px_-1.5px_3px_#ffffff] border border-rose-300/50 flex items-center justify-center text-rose-600 shrink-0">
              <WarningCircle size={20} weight="fill" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-rose-900">Registration Notice</p>
              <p className="text-[11px] sm:text-xs text-rose-700/90 mt-0.5">{submitError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="w-7 h-7 rounded-lg bg-[#e6ebf2] shadow-[1.5px_1.5px_3px_#f5c6cb,-1.5px_-1.5px_3px_#ffffff] active:shadow-[inset_1px_1px_2px_#f5c6cb] border border-rose-200 text-rose-500 hover:text-rose-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Dismiss message"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {/* Form Container Shell */}
      <form onSubmit={handleSubmit} noValidate className="bg-[#e6ebf2] border border-white/80 rounded-[1rem] p-6 sm:p-9 shadow-[inset_4px_4px_12px_#ffffff,inset_-4px_-4px_12px_rgba(0,0,0,0.14)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Patient Name */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1 sm:mb-2 ml-1">
              Patient Full Name <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                <User size={19} weight="bold" />
              </div>
              <input
                type="text"
                placeholder="e.g. Ananya Sharma"
                value={formData.name}
                onChange={handleNameChange}
                style={{ outline: 'none' }}
                className={`w-full pl-11 pr-4 py-3 bg-[#e6ebf2] rounded-full text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff] focus:shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium ${
                  errors.name ? 'shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1px_rgba(244,63,94,0.4)]' : ''
                }`}
              />
            </div>
            {errors.name && (
              <p className="text-[10.5px] text-rose-600 font-medium ml-3 mt-1 -mb-2 sm:-mb-3">{errors.name}</p>
            )}
          </div>

          {/* Age */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider -mt-1 sm:mt-0 mb-1 sm:mb-2 ml-1">
              Age <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                <HourglassHigh size={19} weight="bold" />
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 28"
                value={formData.age}
                onChange={handleAgeChange}
                style={{ outline: 'none' }}
                className={`w-full pl-11 pr-4 py-3 bg-[#e6ebf2] rounded-full text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff] focus:shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium ${
                  errors.age ? 'shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1px_rgba(244,63,94,0.4)]' : ''
                }`}
              />
            </div>
            {errors.age && (
              <p className="text-[10.5px] text-rose-600 font-medium ml-3 mt-1 -mb-1 sm:-mb-3">{errors.age}</p>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider -mt-1 sm:mt-2 mb-1 sm:mb-2 ml-1">
              Mobile Number <span className="text-emerald-700 font-bold normal-case">(WhatsApp)</span> <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                <Phone size={19} weight="bold" />
              </div>
              <input
                type="tel"
                inputMode="tel"
                placeholder="10-digit number"
                value={formData.phone}
                onChange={handlePhoneChange}
                style={{ outline: 'none' }}
                className={`w-full pl-11 pr-4 py-3 bg-[#e6ebf2] rounded-full text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff] focus:shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium ${
                  errors.phone ? 'shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1px_rgba(244,63,94,0.4)]' : ''
                }`}
              />
            </div>
            {errors.phone && (
              <p className="text-[10.5px] text-rose-600 font-medium ml-3 mt-1 -mb-1 sm:-mb-3">{errors.phone}</p>
            )}
          </div>

          {/* Type of Concern / Disease */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider -mt-1 sm:mt-2 mb-1 sm:mb-2 ml-1">
              Type of Concern / Disease <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 group-focus-within:text-emerald-600 transition-colors">
                <FirstAid size={19} weight="bold" />
              </div>
              <input
                type="text"
                placeholder="e.g. PCOS, Routine Prenatal, Infertility Consult"
                value={formData.concern}
                onChange={handleConcernChange}
                style={{ outline: 'none' }}
                className={`w-full pl-11 pr-4 py-3 bg-[#e6ebf2] rounded-full text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff] focus:shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out font-medium ${
                  errors.concern ? 'shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1px_rgba(244,63,94,0.4)]' : ''
                }`}
              />
            </div>
            {errors.concern && (
              <p className="text-[10.5px] text-rose-600 font-medium ml-3 mt-1 -mb-1 sm:-mb-3">{errors.concern}</p>
            )}
          </div>

          {/* Problem / Detailed Notes */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider -mt-1 sm:mt-2 mb-1 sm:mb-2 ml-1">
              Problem / Clinical Symptoms Details
            </label>
            <div className="relative group">
              <textarea
                rows={3}
                placeholder="Describe primary symptoms, prior history or medication..."
                value={formData.problem_details}
                onChange={handleProblemDetailsChange}
                style={{ outline: 'none' }}
                className="w-full p-4 bg-[#e6ebf2] rounded-2xl text-xs sm:text-sm text-zinc-800 placeholder:text-zinc-400 border-0 outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff] focus:shadow-[inset_4px_4px_8px_#c8d0db,inset_-4px_-4px_8px_#ffffff,0_0_0_1.5px_rgba(16,185,129,0.25)] transition-[box-shadow] duration-150 ease-out resize-none font-medium"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-10 flex items-center justify-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto py-3.5 px-9 bg-gradient-to-b from-emerald-600 to-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-full transition-[box-shadow,transform] duration-200 ease-out flex items-center justify-center gap-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[inset_0_-3px_6px_rgba(0,0,0,0.22),inset_0_2px_5px_rgba(255,255,255,0.45)] active:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.32),inset_0_2px_5px_rgba(255,255,255,0.4)] cursor-pointer border border-emerald-500/40 group active:scale-[0.99]"
          >
            <span>{isSubmitting ? 'Registering...' : 'Register Patient'}</span>
            <div className="w-5 h-5 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out group-hover:translate-x-1.5">
              <ArrowRight size={18} weight="bold" />
            </div>
          </button>
        </div>
      </form>

      {/* Success Confirmation Modal */}
      {mounted && registrationSuccess && createPortal(
        <div 
          onClick={handleCloseModal}
          className="fixed inset-0 z-[999] bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#e6ebf2] border border-white/90 rounded-[2.5rem] p-5 sm:p-7 shadow-[inset_4px_4px_10px_#ffffff,inset_-4px_-4px_10px_#c2c9d4] max-w-xl w-full text-center relative animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
          >
            {/* Close Cross Button */}
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 w-9 h-9 rounded-full bg-[#e6ebf2] shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] active:shadow-[inset_1px_1px_2px_#c2c9d4] border border-white/80 flex items-center justify-center text-zinc-500 hover:text-rose-600 transition-colors cursor-pointer z-20"
              title="Close modal"
            >
              <X size={18} weight="bold" />
            </button>

            {/* Modal Header */}
            <div className="shrink-0 pt-1">
              <div className="mx-auto w-14 h-14 shrink-0 rounded-3xl sm:rounded-3xl bg-emerald-100/80 border border-emerald-300/80 shadow-[inset_0_2px_6px_rgba(16,185,129,0.3),3px_3px_8px_#c2c9d4,-3px_-3px_8px_#ffffff] flex items-center justify-center text-emerald-600 mb-2 sm:mb-3">
                <CheckCircle size={38} weight="fill" />
              </div>

              <h3 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">
                Patient Registered!
              </h3>
              <p className="hidden sm:block text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                Prescription parcha generated & ready for printing
              </p>
            </div>

            {/* Scrollable Middle Section: Consultation Form Preview */}
            <div className="flex-1 overflow-y-auto no-scrollbar my-4 p-2 sm:p-3 bg-[#e6ebf2] rounded-3xl shadow-[inset_3px_3px_6px_#c2c9d4,inset_-3px_-3px_6px_#ffffff] border border-white/70">
              <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px] aspect-[1055/1491] bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden select-none border border-zinc-200/80">
                {/* Pre-printed Letterhead Background Template */}
                <img
                  src="/form.png"
                  alt="Doctor Consultation Form"
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Overlaid Data Entries on Designated Pre-Printed Lines */}
                {/* 0. Top Right: Patient ID */}
                <div
                  className="absolute font-bold text-zinc-800 truncate leading-none text-[8.5px] sm:text-[10.5px] text-right pointer-events-none"
                  style={{ top: '3.6%', right: '5.2%' }}
                >
                  <span className="text-zinc-500 font-semibold text-[7.5px] sm:text-[9.5px] mr-1">Patient ID:</span>
                  <span className="text-emerald-700 font-extrabold">{registrationSuccess.patient_id_code || 'PM-XXXX'}</span>
                </div>

                {/* 1. Date */}
                <div
                  className="absolute font-bold text-zinc-800 truncate leading-none text-[8.5px] sm:text-[10.5px] text-left"
                  style={{ top: '20.6%', left: '15.5%', maxWidth: '35%' }}
                  title={registrationSuccess.date}
                >
                  {registrationSuccess.date}
                </div>

                {/* 2. Token No. */}
                <div
                  className="absolute font-bold text-emerald-700 truncate leading-none text-[10px] sm:text-[11px] text-left"
                  style={{ top: '20.4%', left: '68.5%', maxWidth: '24%' }}
                >
                  #{registrationSuccess.token_number}
                </div>

                {/* 3. Patient Name */}
                <div
                  className="absolute font-semibold text-zinc-800 truncate leading-none text-[11px] sm:text-[12px] text-left"
                  style={{ top: '23.5%', left: '23.5%', maxWidth: '69%' }}
                  title={registrationSuccess.name}
                >
                  {registrationSuccess.name}
                </div>

                {/* 4. Age */}
                <div
                  className="absolute font-bold text-zinc-800 truncate leading-none text-[8.5px] sm:text-[10px] text-left"
                  style={{ top: '27.5%', left: '15.5%', maxWidth: '24%' }}
                >
                  {registrationSuccess.age ? `${registrationSuccess.age} Yrs` : '—'}
                </div>

                {/* 5. Mobile No. */}
                <div
                  className="absolute font-semibold text-zinc-800 truncate leading-none tracking-tight text-[9px] sm:text-[10.5px] text-left"
                  style={{ top: '27.4%', left: '59.0%', maxWidth: '34%' }}
                >
                  +91 {registrationSuccess.phone}
                </div>

                {/* 6. Concern / Problem */}
                <div
                  className="absolute font-semibold text-zinc-800 truncate leading-none text-[9.5px] sm:text-[11px] text-left"
                  style={{ top: '31.0%', left: '29.0%', maxWidth: '64%' }}
                  title={registrationSuccess.concern}
                >
                  {registrationSuccess.concern}
                </div>

                {/* 7. Symptoms Details (Shifted upwards to sit above lines with clear breathing room) */}
                <div
                  className="absolute font-semibold text-zinc-800 overflow-hidden text-[9.5px] sm:text-[11px] text-left"
                  style={{
                    top: '34.0%',
                    left: '29.0%',
                    width: '64%',
                    height: '13.5%',
                    lineHeight: '1.75',
                  }}
                  title={registrationSuccess.problem_details}
                >
                  {registrationSuccess.problem_details || '—'}
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons (Horizontal on all screen sizes) */}
            <div className="shrink-0 flex flex-row items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 py-3 px-2.5 sm:px-4 bg-[#e6ebf2] text-zinc-700 font-bold text-[11.5px] sm:text-sm rounded-full shadow-[3px_3px_6px_#c2c9d4,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#c2c9d4,inset_-2px_-2px_4px_#ffffff] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 sm:gap-2 border border-white/80 cursor-pointer whitespace-nowrap"
              >
                <UserCirclePlus size={18} weight="bold" className="shrink-0" />
                <span>Register Another</span>
              </button>

              <button
                type="button"
                onClick={handlePrintParcha}
                className="flex-1 py-3 px-2.5 sm:px-4 bg-gradient-to-b from-emerald-600 to-emerald-700 text-white font-bold text-[11.5px] sm:text-sm rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),3px_3px_8px_#c5ccd6,-3px_-3px_8px_#ffffff] hover:shadow-[inset_0_-3px_6px_rgba(0,0,0,0.22),inset_0_2px_5px_rgba(255,255,255,0.45)] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 sm:gap-2 border border-emerald-500/40 cursor-pointer whitespace-nowrap"
              >
                <Printer size={18} weight="bold" className="shrink-0" />
                <span>Print (A4)</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Hidden A4 Printable Portal for Physical Printer Output */}
      {mounted && registrationSuccess && createPortal(
        <div id="parcha-print-root" className="hidden">
          <div
            style={{
              position: 'relative',
              width: '210mm',
              height: '297mm',
              overflow: 'hidden',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              backgroundColor: 'transparent',
            }}
          >

            {/* 0. Top Right: Patient ID */}
            <div
              style={{
                position: 'absolute',
                top: '3.6%',
                right: '5.2%',
                fontSize: '11pt',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '0.5px',
                textAlign: 'right',
              }}
            >
              <span style={{ fontSize: '9pt', fontWeight: 600, color: '#475569', marginRight: '4px' }}>
                Patient ID:
              </span>
              <span style={{ color: '#047857', fontWeight: 800 }}>
                {registrationSuccess.patient_id_code || 'PM-XXXX'}
              </span>
            </div>

            {/* 1. Date */}
            <div
              style={{
                position: 'absolute',
                top: '20.6%',
                left: '15.5%',
                fontSize: '12pt',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {registrationSuccess.date}
            </div>

            {/* 2. Token No. */}
            <div
              style={{
                position: 'absolute',
                top: '20.4%',
                left: '68.5%',
                fontSize: '14pt',
                fontWeight: 800,
                color: '#047857',
              }}
            >
              #{registrationSuccess.token_number}
            </div>

            {/* 3. Patient Name */}
            <div
              style={{
                position: 'absolute',
                top: '23.8%',
                left: '23.5%',
                fontSize: '14pt',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              {registrationSuccess.name}
            </div>

            {/* 4. Age */}
            <div
              style={{
                position: 'absolute',
                top: '27.4%',
                left: '15.5%',
                fontSize: '12pt',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {registrationSuccess.age ? `${registrationSuccess.age} Yrs` : ''}
            </div>

            {/* 5. Mobile No. */}
            <div
              style={{
                position: 'absolute',
                top: '27.4%',
                left: '59.0%',
                fontSize: '12pt',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '0.5px',
              }}
            >
              +91 {registrationSuccess.phone}
            </div>

            {/* 6. Concern / Problem */}
            <div
              style={{
                position: 'absolute',
                top: '31.0%',
                left: '29.0%',
                fontSize: '12pt',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              {registrationSuccess.concern}
            </div>

            {/* 7. Symptoms Details (Shifted up to sit comfortably above pre-printed lines) */}
            <div
              style={{
                position: 'absolute',
                top: '33.8%',
                left: '29.0%',
                width: '64%',
                fontSize: '11.5pt',
                fontWeight: 600,
                color: '#0f172a',
                lineHeight: '8.85mm',
                whiteSpace: 'pre-wrap',
              }}
            >
              {registrationSuccess.problem_details || ''}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
