/**
 * Registration-country dropdown options, extracted 2026-08-27 (Onboarding
 * Architecture & Path Routing brief, Part 8a) from
 * `(app)/business-profile/BusinessProfileForm.tsx`, where this list
 * originated — Path B's new minimal-profile step needs the exact same
 * dropdown (registration country + conditional UAE free zone), and
 * duplicating the list by hand would risk the two forms drifting apart on
 * which countries are "known" vs. "Other." Business Profile now imports
 * from here too.
 */
export const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark",
  "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland",
  "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands",
  "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
];

export const OTHER_COUNTRY_SENTINEL = "__other__";

export const KNOWN_COUNTRIES = ["United Kingdom", ...EU_COUNTRIES, "Saudi Arabia", "United Arab Emirates"];
