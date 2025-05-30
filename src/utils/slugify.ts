import slugify from 'slugify';

/**
 * Converts a string to a URL-friendly slug using the slugify package
 */
export function generateSlug(str: string): string {
  return slugify(str, {
    lower: true,      // Convert to lowercase
    strict: true,     // Strip special characters
    trim: true        // Trim leading and trailing spaces
  });
}
