import mongoose from 'mongoose';

import env from '../config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
} from '../config/database.js';
import { User } from '../users/user.model.js';
import { ROLES } from '../security/permissions.js';
import { hashPassword } from '../security/password.js';
import { ensureSystemRolesSeeded } from '../modules/roles/services/role.service.js';

const normalizeEmail = (email) => {
  return email?.trim().toLowerCase();
};

const normalizeUsername = (username) => {
  return username?.trim().toLowerCase();
};

const requireValue = (name, value) => {
  if (!value || !String(value).trim()) {
    throw new Error(
      `${name} is required for database seeding.`,
    );
  }

  return String(value).trim();
};

const createUserIfMissing = async ({
  name,
  email,
  username,
  password,
  role,
  isProtected = false,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);

  const existingByEmail = await User.findOne({
    email: normalizedEmail,
  });

  const existingByUsername = await User.findOne({
    username: normalizedUsername,
  });

  if (existingByEmail || existingByUsername) {
    const existing = existingByEmail || existingByUsername;

    console.log(
      `User already exists: ${existing.username} (${existing.role})`,
    );

    // Backfill the protection flag on a pre-existing protected
    // account created before this field existed. This uses the
    // documented bypass symbol because it is the one legitimate,
    // reviewed, non-CRUD path for setting `isProtected` itself.
    if (isProtected && !existing.isProtected) {
      existing.isProtected = true;
      existing.$locals.protectedBypass = User.PROTECTED_BYPASS;
      await existing.save();

      console.log(
        `Backfilled protected-account flag for: ${existing.username}`,
      );
    }

    return existing;
  }

  const passwordHash = await hashPassword(password);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    passwordHash,
    role,
    status: 'ACTIVE',
    isProtected,
    emailVerifiedAt: new Date(),
    passwordChangedAt: new Date(),
  });

  console.log(
    `Created ${role}: ${user.username}`,
  );

  return user;
};

const seed = async () => {
  try {
    await connectDatabase();

    /*
     * ========================================================
     * SOFTWARE OWNER
     * ========================================================
     *
     * This is the permanent top-level platform owner.
     */
    const ownerName = requireValue(
      'OWNER_NAME',
      env.owner.name,
    );

    const ownerEmail = requireValue(
      'OWNER_EMAIL',
      env.owner.email,
    );

    const ownerUsername = requireValue(
      'OWNER_USERNAME',
      env.owner.username,
    );

    const ownerPassword = requireValue(
      'OWNER_INITIAL_PASSWORD',
      env.owner.initialPassword,
    );

    await createUserIfMissing({
      name: ownerName,
      email: ownerEmail,
      username: ownerUsername,
      password: ownerPassword,
      role: ROLES.SOFTWARE_OWNER,
      // BET-04 fix: this was previously omitted, which meant the
      // Owner account was silently created/left as `isProtected:
      // false` — i.e. NOT actually protected against ordinary CRUD,
      // contradicting master prompt section 10 and the BET-03
      // handoff notes' claim that it was. See PROJECT_PROGRESS.md /
      // completion report for this task.
      isProtected: true,
    });

    /*
     * ========================================================
     * DIRECTOR
     * ========================================================
     */
    const directorName = requireValue(
      'DIRECTOR_NAME',
      env.director.name,
    );

    const directorEmail = requireValue(
      'DIRECTOR_EMAIL',
      env.director.email,
    );

    const directorUsername = requireValue(
      'DIRECTOR_USERNAME',
      env.director.username,
    );

    const directorPassword = requireValue(
      'DIRECTOR_INITIAL_PASSWORD',
      env.director.initialPassword,
    );

    await createUserIfMissing({
      name: directorName,
      email: directorEmail,
      username: directorUsername,
      password: directorPassword,
      role: ROLES.DIRECTOR,
      // BET-04 fix: same omission as the Owner account above.
      isProtected: true,
    });

    /*
     * ========================================================
     * INITIAL ADMIN
     * ========================================================
     *
     * The initial admin gets a generated identity.
     * Change these values before production deployment.
     */
    const adminPassword = requireValue(
      'INITIAL_ADMIN_PASSWORD',
      env.initialAdmin.password,
    );

    await createUserIfMissing({
      name: 'System Administrator',
      email: 'admin@ashshafi.local',
      username: 'admin',
      password: adminPassword,
      role: ROLES.ADMIN,
    });

    /*
     * ========================================================
     * SYSTEM ROLES (BET-04)
     * ========================================================
     *
     * Mirrors the fixed, code-defined roles into the `roles`
     * collection so the roles administration API has a single,
     * unified list to read from. Purely a read-side projection —
     * see `modules/roles/role.service.js` for why enforcement
     * itself never depends on this.
     */
    await ensureSystemRolesSeeded();
    console.log('System roles synced.');

    /*
     * ========================================================
     * DEMO PATIENT ACCOUNT
     * ========================================================
     *
     * A ready-to-use patient login for testing the patient
     * portal, prescription verification, billing, messages,
     * appointments, and any patient-facing feature.
     * Change the password before production deployment.
     */
    await createUserIfMissing({
      name: 'Demo Patient',
      email: 'patient@ashshafi.local',
      username: 'patient',
      password: 'patient123',
      role: ROLES.PATIENT,
    });

    const patientUser = await User.findOne({ email: 'patient@ashshafi.local' });
    if (patientUser) {
      const { PatientProfile } = await import('../modules/patients/models/patient-profile.model.js');
      const existingProfile = await PatientProfile.findOne({ user: patientUser._id });
      if (!existingProfile) {
        const { createPatientProfile } = await import('../modules/patients/services/patient.service.js');
        await createPatientProfile(
          {
            firstName: 'Fahim',
            lastName: 'Patient',
            gender: 'MALE',
            dateOfBirth: new Date('1995-12-14'),
            phone: '01753563877',
            bloodGroup: 'B+',
            preferredLanguage: 'en',
          },
          patientUser._id,
          patientUser._id,
        );
        console.log('Seeded patient clinical profile.');
      }
    }

    /*
     * ========================================================
     * SEED MEDICINES REFERENCE DATA
     * ========================================================
     */
    const { Medicine } = await import('../modules/medicines/models/medicine.model.js');
    const sampleMedicines = [
      { genericName: 'Linagliptin', brandName: 'Lino', strength: '5', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Levothyroxine Sodium', brandName: 'Thyrox', strength: '25', unit: 'mcg', dosageForm: 'TABLET', manufacturer: 'Popular Pharmaceuticals Ltd.' },
      { genericName: 'Frusemide', brandName: 'Fusid', strength: '40', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Beximco Pharmaceuticals Ltd.' },
      { genericName: 'Calcitriol', brandName: 'Raditrol', strength: '0.25', unit: 'mcg', dosageForm: 'CAPSULE', manufacturer: 'Incepta Pharmaceuticals Ltd.' },
      { genericName: 'Erythropoietin', brandName: 'Initer', strength: '5000', unit: 'IU', dosageForm: 'INJECTION', manufacturer: 'Incepta Pharmaceuticals Ltd.' },
      { genericName: 'Domperidone', brandName: 'Deflux', strength: '10', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Esomeprazole', brandName: 'Sergel MUPS', strength: '20', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Healthcare Pharmaceuticals Ltd.' },
      { genericName: 'Pregabalin', brandName: 'Pegalin', strength: '50', unit: 'mg', dosageForm: 'CAPSULE', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Tramadol Hydrochloride', brandName: 'Ultramal Retard', strength: '50', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Palonosetron', brandName: 'Paloxi', strength: '0.5', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Incepta Pharmaceuticals Ltd.' },
      { genericName: 'Tolperisone Hydrochloride', brandName: 'Myolax', strength: '50', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Doxycycline', brandName: 'Doxicap', strength: '100', unit: 'mg', dosageForm: 'CAPSULE', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Meropenem', brandName: 'Meropen', strength: '500', unit: 'mg', dosageForm: 'INJECTION', manufacturer: 'Incepta Pharmaceuticals Ltd.' },
      { genericName: 'Calcium Carbonate', brandName: 'Calbo', strength: '500', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Square Pharmaceuticals Ltd.' },
      { genericName: 'Paracetamol', brandName: 'Napa Extra', strength: '500+65', unit: 'mg', dosageForm: 'TABLET', manufacturer: 'Beximco Pharmaceuticals Ltd.' },
    ];

    for (const med of sampleMedicines) {
      await Medicine.findOneAndUpdate(
        { genericName: med.genericName, brandName: med.brandName, strength: med.strength },
        { $setOnInsert: { ...med, isActive: true, verificationStatus: 'VERIFIED' } },
        { upsert: true, new: true },
      );
    }
    console.log('Sample reference medicines synced.');

    console.log('');
    console.log(
      'Database seeding completed successfully.',
    );
    console.log('');
  } catch (error) {
    console.error(
      'Database seeding failed:',
      error,
    );

    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

seed();