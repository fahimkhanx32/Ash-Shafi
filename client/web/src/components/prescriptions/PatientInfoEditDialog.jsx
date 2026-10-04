import React, { useState, useEffect } from 'react';
import { User, Phone, Droplet, Check, Calendar, Heart } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

export default function PatientInfoEditDialog({
  open,
  onOpenChange,
  initialData = {},
  onSave,
}) {
  const [name, setName] = useState('');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');

  useEffect(() => {
    if (open) {
      setName(initialData.name || '');
      setBloodGroup(initialData.bloodGroup || 'B+');
      setPhone(initialData.phone || '');
      setAge(initialData.age !== undefined && initialData.age !== null ? String(initialData.age) : '28');
    }
  }, [open, initialData]);

  const handleSave = () => {
    const ageNum = parseInt(age, 10);
    onSave?.({
      name: name.trim(),
      bloodGroup,
      phone: phone.trim(),
      age: isNaN(ageNum) ? 28 : ageNum,
      ageFormatted: `${isNaN(ageNum) ? age : ageNum} Y`,
    });
    onOpenChange?.(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-md w-full p-0 overflow-hidden rounded-3xl border border-slate-200/80 shadow-2xl bg-white"
    >
      <DialogCloseButton onClose={() => onOpenChange(false)} />

      {/* Soft Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300 shadow-inner">
            <User size={20} />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-white tracking-wide">
              Edit Patient Demographics
            </DialogTitle>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Update Name, Blood Group, Phone & Age directly on the prescription pad.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4 bg-white">
        {/* Patient Name */}
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <User size={14} className="text-indigo-600" />
            <span>Patient Full Name:</span>
          </label>
          <input
            type="text"
            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
            placeholder="e.g. fahim khan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Blood Group */}
        <div>
          <label className="text-xs font-semibold text-slate-700 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Droplet size={14} className="text-rose-500" />
              <span>Blood Group:</span>
            </span>
            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
              Selected: {bloodGroup}
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {BLOOD_GROUPS.map((bg) => {
              const isSelected = bloodGroup === bg;
              return (
                <button
                  key={bg}
                  type="button"
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-sm shadow-rose-200 border border-rose-500 scale-[1.02]'
                      : 'bg-slate-50/80 text-slate-700 border border-slate-200/80 hover:border-rose-200 hover:bg-rose-50/40 hover:text-rose-700'
                  }`}
                  onClick={() => setBloodGroup(bg)}
                >
                  <Droplet
                    size={11}
                    className={isSelected ? 'text-white fill-white' : 'text-rose-400'}
                  />
                  <span>{bg}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phone & Age Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Phone Number */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Phone size={14} className="text-indigo-600" />
              <span>Phone Number:</span>
            </label>
            <input
              type="tel"
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-mono placeholder:text-slate-400"
              placeholder="01753563877"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Age */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-indigo-600" />
              <span>Age (Years):</span>
            </label>
            <input
              type="number"
              min="0"
              max="130"
              className="w-full h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-sm font-medium text-slate-900 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
              placeholder="28"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DialogFooter className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5 shadow-sm hover:shadow"
        >
          <Check size={14} />
          <span>Update Demographics</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
