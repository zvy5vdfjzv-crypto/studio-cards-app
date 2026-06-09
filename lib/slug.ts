const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(s: string): string {
  return (
    (s || "")
      .normalize("NFD")
      .replace(DIACRITICS, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "canal"
  );
}
