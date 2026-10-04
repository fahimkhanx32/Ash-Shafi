import mongoose from 'mongoose';

/**
 * Public-website navbar, fully admin-editable (dashboard request:
 * "create new items in navbar or can hide item in navbar, can perform
 * crud operation in navbar items"). A flat collection with an optional
 * self-referencing `parentId` (rather than an embedded children array
 * like Lawyee Apparel's `navbarMenu` JSON blob) so each item — top-level
 * or dropdown child — is independently CRUD-able, reorderable, and
 * hideable through ordinary REST calls instead of read-modify-write on
 * one big document.
 */
const navbarItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    href: { type: String, required: true, trim: true, maxlength: 300 },
    order: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    openInNewTab: { type: Boolean, default: false },
    // Null for a top-level item; set to another item's _id to render
    // as a dropdown child of that item (one level deep, matching the
    // Lawyee Apparel navbar's dropdown pattern).
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'NavbarItem', default: null, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

navbarItemSchema.index({ isActive: 1, parentId: 1, order: 1 });

export const NavbarItem = mongoose.model('NavbarItem', navbarItemSchema, 'website_navbar_items');
