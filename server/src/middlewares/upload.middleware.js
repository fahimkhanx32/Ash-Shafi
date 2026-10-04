import multer from 'multer';

import env from '../config/env.js';
import {
    validateUploadedFile,
    generateStorageFilename,
} from '../security/file-security.js';

const storage = multer.memoryStorage();

const createFileFilter = () => {
    return (req, file, callback) => {
        try {
            const maxSizeMap = {
                'image/jpeg':
                    env.uploads.imageMb * 1024 * 1024,

                'image/png':
                    env.uploads.imageMb * 1024 * 1024,

                'image/webp':
                    env.uploads.imageMb * 1024 * 1024,

                'application/pdf':
                    env.uploads.pdfMb * 1024 * 1024,

                'audio/mpeg':
                    env.uploads.audioMb * 1024 * 1024,

                'audio/wav':
                    env.uploads.audioMb * 1024 * 1024,

                'video/mp4':
                    env.uploads.videoMb * 1024 * 1024,

                // BET-12 — investigation/medical-report uploads
                // (lab spreadsheets, scanned Office documents).
                'application/msword':
                    env.uploads.documentMb * 1024 * 1024,

                'application/vnd.ms-excel':
                    env.uploads.documentMb * 1024 * 1024,

                'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    env.uploads.documentMb * 1024 * 1024,

                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                    env.uploads.documentMb * 1024 * 1024,

                // BET-19 — CSV/Excel patient import.
                'text/csv':
                    env.uploads.documentMb * 1024 * 1024,
            };

            if (!Object.hasOwn(maxSizeMap, file.mimetype)) {
                return callback(
                    new Error('Unsupported file type.'),
                    false,
                );
            }

            return callback(null, true);
        } catch (error) {
            return callback(error, false);
        }
    };
};

const createUploader = (limits) => {
    return multer({
        storage,
        limits,
        fileFilter: createFileFilter(),
    });
};

export const uploadSingle = (
    fieldName = 'file',
) => {
    const uploader = createUploader({
        fileSize:
            env.uploads.documentMb * 1024 * 1024,
        files: 1,
    });

    return (req, res, next) => {
        uploader.single(fieldName)(
            req,
            res,
            (error) => {
                if (error) {
                    return next(error);
                }

                if (!req.file) {
                    return next();
                }

                try {
                    validateUploadedFile({
                        filename: req.file.originalname,
                        mimeType: req.file.mimetype,
                        size: req.file.size,
                        maxSizeBytes:
                            env.uploads.documentMb *
                            1024 *
                            1024,
                        buffer: req.file.buffer,
                    });

                    req.file.storageFilename =
                        generateStorageFilename(
                            req.file.originalname,
                        );

                    return next();
                } catch (validationError) {
                    return next(validationError);
                }
            },
        );
    };
};

export const uploadMultiple = (
    fieldName = 'files',
    maxCount = 5,
) => {
    const uploader = createUploader({
        fileSize:
            env.uploads.documentMb * 1024 * 1024,
        files: maxCount,
    });

    return (req, res, next) => {
        uploader.array(fieldName, maxCount)(
            req,
            res,
            (error) => {
                if (error) {
                    return next(error);
                }

                try {
                    for (const file of req.files ?? []) {
                        validateUploadedFile({
                            filename: file.originalname,
                            mimeType: file.mimetype,
                            size: file.size,
                            maxSizeBytes:
                                env.uploads.documentMb *
                                1024 *
                                1024,
                            buffer: file.buffer,
                        });

                        file.storageFilename =
                            generateStorageFilename(
                                file.originalname,
                            );
                    }

                    return next();
                } catch (validationError) {
                    return next(validationError);
                }
            },
        );
    };
};
// FET-16 — homepage hero/banner and CUSTOM-section background uploads
// accept either an image or a video (dashboard request: "can upload bg
// image or video in banner"). `uploadSingle`'s hard multer limit is
// `documentMb` (25MB by default) — too low for a real background video
// — so this variant raises the hard limit to `videoMb` (250MB by
// default) instead. The per-mimetype fileFilter is unchanged: only
// image/jpeg, image/png, image/webp, and video/mp4 pass it, each still
// checked against its own (smaller) size cap from that map.
export const uploadBannerMedia = (
    fieldName = 'file',
) => {
    const uploader = createUploader({
        fileSize:
            env.uploads.videoMb * 1024 * 1024,
        files: 1,
    });

    return (req, res, next) => {
        uploader.single(fieldName)(
            req,
            res,
            (error) => {
                if (error) {
                    return next(error);
                }

                if (!req.file) {
                    return next();
                }

                try {
                    validateUploadedFile({
                        filename: req.file.originalname,
                        mimeType: req.file.mimetype,
                        size: req.file.size,
                        maxSizeBytes:
                            env.uploads.videoMb *
                            1024 *
                            1024,
                        buffer: req.file.buffer,
                    });

                    req.file.storageFilename =
                        generateStorageFilename(
                            req.file.originalname,
                        );

                    return next();
                } catch (validationError) {
                    return next(validationError);
                }
            },
        );
    };
};
