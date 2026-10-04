import { StaffProfile } from '../models/staff-profile.model.js';
import { User } from '../../../users/user.model.js';
import { ROLES } from '../../../security/permissions.js';
import { AppError } from '../../../middlewares/error.middleware.js';
import { logger } from '../../../config/logger.js';

const USER_SUMMARY_FIELDS = 'name email username role status isProtected';

/**
 * Escapes user-supplied text before it is used inside a MongoDB
 * regex query, so a search term cannot be abused as a regex-DoS or
 * unexpected-match vector (master prompt section 46/47 — input
 * validation/sanitization, NoSQL-injection protection). `express-
 * mongo-sanitize` (wired in BET-02) strips `$`/dotted-key operator
 * injection from the body/query, but does not itself protect
 * against unescaped user input being used to *build* a regex here.
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateEmployeeId = async () => {
  const year = new Date().getFullYear();
  const prefix = `EMP-${year}-`;

  // Sequential-within-year, collision-checked the same way
  // `modules/roles/services/role.service.js` generates unique
  // custom-role keys — retry with the next candidate rather than
  // relying on a separate counters collection.
  const latest = await StaffProfile.findOne({
    employeeId: new RegExp(`^${escapeRegExp(prefix)}\\d+$`),
  })
    .sort({ employeeId: -1 })
    .select('employeeId')
    .lean();

  let nextSequence = 1;

  if (latest?.employeeId) {
    const currentSequence = Number.parseInt(
      latest.employeeId.slice(prefix.length),
      10,
    );

    if (Number.isFinite(currentSequence)) {
      nextSequence = currentSequence + 1;
    }
  }

  let candidate = `${prefix}${String(nextSequence).padStart(4, '0')}`;

  // Defensive retry loop in case of a race between the read above
  // and the eventual unique-index write.
  // eslint-disable-next-line no-await-in-loop
  while (await StaffProfile.exists({ employeeId: candidate })) {
    nextSequence += 1;
    candidate = `${prefix}${String(nextSequence).padStart(4, '0')}`;
  }

  return candidate;
};

const getEligibleStaffUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found.', 404, { code: 'USER_NOT_FOUND' });
  }

  if (user.role === ROLES.PATIENT) {
    throw new AppError(
      'Patients cannot be given a staff profile.',
      400,
      { code: 'PATIENT_CANNOT_BE_STAFF' },
    );
  }

  const existingProfile = await StaffProfile.findOne({ user: user._id });

  if (existingProfile) {
    throw new AppError(
      'This user already has a staff profile.',
      409,
      { code: 'STAFF_PROFILE_ALREADY_EXISTS' },
    );
  }

  return user;
};

/**
 * Recovery-UI support (follow-up to the AddStaffDialog two-step
 * create-user-then-create-profile flow): finds every non-PATIENT
 * `User` that does NOT yet have a `StaffProfile`. This is exactly
 * `getEligibleStaffUser`'s eligibility condition, just listed in bulk
 * instead of checked for one id — kept as a genuinely separate query
 * here (rather than refactoring `getEligibleStaffUser` to share code)
 * since that one still needs its own 404/409 error semantics for the
 * single-user create path.
 *
 * Previously, if the second call (`POST /staff`) failed after the
 * first (`POST /users`) succeeded, the resulting user was invisible
 * both here and in the ordinary staff list (`GET /staff` only reads
 * `StaffProfile` documents) — there was no way to find or finish
 * setting them up short of a direct DB query. This closes that gap.
 */
export const listOrphanedStaffUsers = async () => {
  const staffProfileUserIds = await StaffProfile.distinct('user');

  const users = await User.find({
    role: { $ne: ROLES.PATIENT },
    _id: { $nin: staffProfileUserIds },
    isDeleted: { $ne: true },
  })
    .select(USER_SUMMARY_FIELDS)
    .sort({ createdAt: -1 })
    .lean();

  return users;
};

export const createStaffProfile = async (payload, actorId) => {
  const {
    userId,
    designation,
    customDesignationLabel,
    department,
    phone,
    gender,
    dateOfBirth,
    address,
    joiningDate,
    employmentType,
    doctorDetails,
    emergencyContact,
  } = payload;

  await getEligibleStaffUser(userId);

  const employeeId = await generateEmployeeId();

  const profile = await StaffProfile.create({
    user: userId,
    employeeId,
    designation,
    customDesignationLabel,
    department,
    phone,
    gender,
    dateOfBirth,
    address,
    joiningDate,
    employmentType,
    doctorDetails,
    emergencyContact,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  });

  logger.info(
    {
      event: 'staff_profile_created',
      staffProfileId: profile._id.toString(),
      userId: String(userId),
      designation,
      actorId: actorId ? String(actorId) : null,
    },
    'Staff profile created.',
  );

  return profile.populate('user', USER_SUMMARY_FIELDS);
};

const buildListFilter = ({
  designation,
  employmentStatus,
  department,
  search,
  includeInactive,
}) => {
  const filter = {};

  if (!includeInactive) {
    filter.isActive = true;
  }

  if (designation) {
    filter.designation = designation;
  }

  if (employmentStatus) {
    filter.employmentStatus = employmentStatus;
  }

  if (department) {
    filter.department = new RegExp(escapeRegExp(department), 'i');
  }

  if (search) {
    filter.$or = [
      { employeeId: new RegExp(escapeRegExp(search), 'i') },
      { department: new RegExp(escapeRegExp(search), 'i') },
    ];
  }

  return filter;
};

export const listStaffProfiles = async ({
  designation,
  employmentStatus,
  department,
  search,
  includeInactive = false,
  page = 1,
  limit = 20,
} = {}) => {
  const filter = buildListFilter({
    designation,
    employmentStatus,
    department,
    search,
    includeInactive,
  });

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  const [items, total] = await Promise.all([
    StaffProfile.find(filter)
      .populate('user', USER_SUMMARY_FIELDS)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    StaffProfile.countDocuments(filter),
  ]);

  // A name/email search touches the referenced `User` document, not
  // this collection, so it is applied as a post-filter on the
  // already-paginated page rather than a cross-collection $lookup —
  // acceptable at this stage given the practice's expected staff
  // headcount; should be revisited with a proper aggregation if
  // staff search performance ever becomes a real bottleneck (master
  // prompt section 65 — performance).
  const filteredItems = search
    ? items.filter((item) => {
        const haystack = `${item.employeeId} ${item.department || ''} ${
          item.user?.name || ''
        } ${item.user?.email || ''} ${item.user?.username || ''}`.toLowerCase();

        return haystack.includes(search.toLowerCase());
      })
    : items;

  return { items: filteredItems, total, page: safePage, limit: safeLimit };
};

export const getStaffProfileById = async (id) => {
  const profile = await StaffProfile.findById(id).populate(
    'user',
    USER_SUMMARY_FIELDS,
  );

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  return profile;
};

export const getStaffProfileByUserId = async (userId) => {
  const profile = await StaffProfile.findOne({ user: userId }).populate(
    'user',
    USER_SUMMARY_FIELDS,
  );

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  return profile;
};

const UPDATABLE_FIELDS = [
  'designation',
  'customDesignationLabel',
  'department',
  'phone',
  'gender',
  'dateOfBirth',
  'address',
  'joiningDate',
  'employmentType',
  'doctorDetails',
  'emergencyContact',
];

// Fields a staff member may change on their own record via
// `PATCH /staff/me` — must stay a subset of `UPDATABLE_FIELDS` above.
// Org-assigned fields (designation, department, employmentType,
// joiningDate, customDesignationLabel) are deliberately excluded;
// those remain admin-only via `updateStaffProfile`.
const SELF_UPDATABLE_FIELDS = ['phone', 'gender', 'dateOfBirth', 'address', 'doctorDetails', 'emergencyContact'];

// `doctorDetails`/`emergencyContact` are nested sub-documents — a
// caller sending just `{ doctorDetails: { nameBangla: '...' } }`
// should fill in that one sub-field, not wipe out the rest (e.g. an
// already-set `registrationNumber`) the way a flat assignment would.
const mergeSubdocument = (profile, field, value) => {
  const current = profile[field]?.toObject ? profile[field].toObject() : profile[field] || {};
  profile[field] = { ...current, ...value };
};

export const updateStaffProfile = async (id, updates, actorId) => {
  const profile = await StaffProfile.findById(id);

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  for (const field of UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      if (field === 'doctorDetails' || field === 'emergencyContact') {
        mergeSubdocument(profile, field, updates[field]);
      } else {
        profile[field] = updates[field];
      }
    }
  }

  profile.updatedBy = actorId ?? null;

  await profile.save();

  logger.info(
    {
      event: 'staff_profile_updated',
      staffProfileId: profile._id.toString(),
      actorId: actorId ? String(actorId) : null,
      fields: Object.keys(updates),
    },
    'Staff profile updated.',
  );

  return profile.populate('user', USER_SUMMARY_FIELDS);
};

// Self-service counterpart to `updateStaffProfile` — looked up by the
// caller's own `userId` (never a `:id` param, so there's no way to
// target anyone else's record) and restricted to
// `SELF_UPDATABLE_FIELDS`. This is what lets a doctor who was just
// created by an admin fill in their own Bangla name/degrees and other
// personal/clinical details once they log in, instead of an admin
// having to enter it for them.
export const updateMyStaffProfile = async (userId, updates, actorId) => {
  const profile = await StaffProfile.findOne({ user: userId });

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  for (const field of SELF_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      if (field === 'doctorDetails' || field === 'emergencyContact') {
        mergeSubdocument(profile, field, updates[field]);
      } else {
        profile[field] = updates[field];
      }
    }
  }

  profile.updatedBy = actorId ?? null;

  await profile.save();

  logger.info(
    {
      event: 'staff_profile_self_updated',
      staffProfileId: profile._id.toString(),
      actorId: actorId ? String(actorId) : null,
      fields: Object.keys(updates),
    },
    'Staff profile updated by owner.',
  );

  return profile.populate('user', USER_SUMMARY_FIELDS);
};

export const setEmploymentStatus = async (id, status, actorId) => {
  const profile = await StaffProfile.findById(id);

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  const previousStatus = profile.employmentStatus;

  profile.employmentStatus = status;
  profile.updatedBy = actorId ?? null;

  await profile.save();

  logger.info(
    {
      event: 'staff_employment_status_changed',
      staffProfileId: profile._id.toString(),
      from: previousStatus,
      to: status,
      actorId: actorId ? String(actorId) : null,
    },
    'Staff employment status changed.',
  );

  return profile.populate('user', USER_SUMMARY_FIELDS);
};

/**
 * Deactivates the HR record only (soft delete, mirrors the pattern
 * already established in `modules/roles/services/role.service.js`
 * for custom roles). Never touches the underlying `User` account —
 * see the model-level comment on `isActive` for why the two are
 * kept independent.
 */
export const deactivateStaffProfile = async (id, actorId) => {
  const profile = await StaffProfile.findById(id);

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  profile.isActive = false;
  profile.updatedBy = actorId ?? null;

  await profile.save();

  logger.info(
    {
      event: 'staff_profile_deactivated',
      staffProfileId: profile._id.toString(),
      actorId: actorId ? String(actorId) : null,
    },
    'Staff profile deactivated.',
  );

  return profile.populate('user', USER_SUMMARY_FIELDS);
};

export const reactivateStaffProfile = async (id, actorId) => {
  const profile = await StaffProfile.findById(id);

  if (!profile) {
    throw new AppError('Staff profile not found.', 404, {
      code: 'STAFF_PROFILE_NOT_FOUND',
    });
  }

  profile.isActive = true;
  profile.updatedBy = actorId ?? null;

  await profile.save();

  logger.info(
    {
      event: 'staff_profile_reactivated',
      staffProfileId: profile._id.toString(),
      actorId: actorId ? String(actorId) : null,
    },
    'Staff profile reactivated.',
  );

  return profile.populate('user', USER_SUMMARY_FIELDS);
};

/**
 * Doctor-facing read views (master prompt BET-05: "Doctors" /
 * "Doctor management"). Deliberately reuses `StaffProfile` rather
 * than introducing a parallel `Doctor` collection — a doctor *is* a
 * staff member with `designation: 'DOCTOR'`; a separate collection
 * would duplicate the same employment/identity data and risk the
 * two drifting apart (master prompt section 48 — avoid unnecessary
 * fragmentation). Clinical scheduling/booking data itself belongs
 * to later tasks (BET-10 appointments); this only exposes the
 * doctor's staff/practice profile.
 */
export const listDoctors = async ({ search, page = 1, limit = 20 } = {}) => {
  return listStaffProfiles({
    designation: 'DOCTOR',
    employmentStatus: 'ACTIVE',
    includeInactive: false,
    search,
    page,
    limit,
  });
};

// What a PATIENT may see of a doctor when choosing who to message or send
// a report to. `userId` is the account id the messaging/report APIs expect
// (as `doctorId` / `targetDoctorId`); the rest is professional info only —
// no email, phone, employee id, address, date of birth, emergency contact
// or employment details.
export const toDoctorDirectoryEntry = (profile) => ({
  userId: profile.user?._id ?? null,
  id: profile._id,
  name: profile.user?.name || '',
  specialization: profile.doctorDetails?.specialization || '',
  qualifications: profile.doctorDetails?.qualifications || [],
  yearsOfExperience: profile.doctorDetails?.yearsOfExperience || 0,
  bio: profile.doctorDetails?.bio || '',
  department: profile.department || '',
});

/**
 * Doctor directory for PATIENTS (choosing who to message or send a report to).
 *
 * Built from the *accounts* with role DOCTOR, not only from staff profiles:
 * a doctor an admin registered but who has no staff profile yet is still a
 * real, active doctor and must be selectable. Profile details enrich an
 * entry when a profile exists; a doctor whose profile is explicitly
 * inactive / not ACTIVE employment is left out.
 */
export const listDoctorDirectoryForPatient = async ({ search, page = 1, limit = 50 } = {}) => {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);

  const users = await User.find({
    role: ROLES.DOCTOR,
    status: 'ACTIVE',
    isDeleted: { $ne: true },
  })
    .select('name')
    .sort({ name: 1 })
    .lean();

  const profiles = await StaffProfile.find({ user: { $in: users.map((u) => u._id) } }).lean();
  const profileByUser = new Map(profiles.map((p) => [String(p.user), p]));

  const needle = (search || '').trim().toLowerCase();
  const entries = [];
  for (const u of users) {
    const profile = profileByUser.get(String(u._id));
    if (profile && (profile.isActive === false || profile.employmentStatus !== 'ACTIVE')) continue;
    const entry = toDoctorDirectoryEntry(
      profile ? { ...profile, user: u } : { _id: u._id, user: u },
    );
    if (needle && !`${entry.name} ${entry.specialization}`.toLowerCase().includes(needle)) continue;
    entries.push(entry);
  }

  const total = entries.length;
  const items = entries.slice((safePage - 1) * safeLimit, safePage * safeLimit);
  return { items, total, page: safePage, limit: safeLimit };
};

export const getDoctorById = async (id) => {
  const profile = await getStaffProfileById(id);

  if (profile.designation !== 'DOCTOR') {
    throw new AppError('Doctor not found.', 404, {
      code: 'DOCTOR_NOT_FOUND',
    });
  }

  return profile;
};

// FET-16 — public website "Doctors" page. Deliberately a separate,
// narrower function rather than reusing `listDoctors`'s full
// `StaffProfile` documents on an unauthenticated route: this strips
// every HR/PII field (employeeId, email, phone, employment dates,
// emergency contact, etc.) down to what a marketing page should ever
// expose — name, specialization/qualifications/experience/bio. No new
// model field is introduced; this only narrows the projection.
export const listPublicDoctors = async ({ search, page = 1, limit = 50 } = {}) => {
  const { items, total, page: currentPage, limit: currentLimit } = await listDoctors({
    search,
    page,
    limit,
  });

  const publicItems = items.map((profile) => ({
    id: profile._id,
    name: profile.user?.name || '',
    specialization: profile.doctorDetails?.specialization || '',
    qualifications: profile.doctorDetails?.qualifications || [],
    yearsOfExperience: profile.doctorDetails?.yearsOfExperience || 0,
    bio: profile.doctorDetails?.bio || '',
    department: profile.department || '',
  }));

  return { items: publicItems, total, page: currentPage, limit: currentLimit };
};
