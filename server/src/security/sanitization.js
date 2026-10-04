import sanitizeHtml from 'sanitize-html';

const DEFAULT_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
];

export const sanitizeHtmlContent = (
  value,
  options = {},
) => {
  if (typeof value !== 'string') {
    return value;
  }

  return sanitizeHtml(value, {
    allowedTags:
      options.allowedTags ?? DEFAULT_ALLOWED_TAGS,

    allowedAttributes:
      options.allowedAttributes ?? {},

    disallowedTagsMode: 'discard',

    ...options,
  });
};

export const sanitizeString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  }).trim();
};

export const sanitizeObjectStrings = (value) => {
  if (Array.isArray(value)) {
    return value.map(sanitizeObjectStrings);
  }

  if (
    value !== null &&
    typeof value === 'object'
  ) {
    const result = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = sanitizeObjectStrings(item);
    }

    return result;
  }

  return typeof value === 'string'
    ? sanitizeString(value)
    : value;
};