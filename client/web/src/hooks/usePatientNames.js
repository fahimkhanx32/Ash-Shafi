import { useEffect, useRef, useState } from 'react';

import * as patientsService from '../services/patientsService.js';

/**
 * FET-11 — `GET /investigations` and `GET /reports` (the cross-patient
 * roster endpoints `InvestigationsPage.jsx`/`ReportsPage.jsx` list
 * against) return `patientProfile` as a bare id — neither
 * `investigation.service.js`'s `listInvestigations` nor
 * `report.service.js`'s `listReports` populates it (confirmed by
 * reading both directly), unlike the single-record `GET /:id` routes,
 * which do. Rather than inventing a name the API never sent (master
 * prompt §79), this resolves the *real* patient record via the
 * already-real `GET /patients/:id` (`patientsService.getPatient`,
 * the same call `PatientWorkspacePage` itself makes) for whichever
 * distinct ids are on the current page, caches them for the
 * component's lifetime, and reports "Loading…" honestly while a given
 * id is in flight rather than blocking the whole table on it.
 */
export function usePatientNames(patientProfileIds = []) {
  const [names, setNames] = useState({}); // id -> { fullName, patientId } | 'error'
  const cacheRef = useRef({});

  useEffect(() => {
    const ids = [...new Set((patientProfileIds || []).filter(Boolean))].filter((id) => !cacheRef.current[id]);
    if (ids.length === 0) return;

    ids.forEach((id) => {
      cacheRef.current[id] = 'loading';
    });
    setNames({ ...cacheRef.current });

    ids.forEach((id) => {
      patientsService
        .getPatient(id)
        .then((profile) => {
          cacheRef.current[id] = {
            fullName: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
            patientId: profile.patientId,
          };
          setNames({ ...cacheRef.current });
        })
        .catch(() => {
          cacheRef.current[id] = 'error';
          setNames({ ...cacheRef.current });
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(patientProfileIds)]);

  return names;
}
