/**
 * Formatting is not a matter of taste here — it is what keeps a diff about the
 * change and not about the whitespace.
 *
 * `prettier-plugin-tailwindcss` sorts class lists into Tailwind's own order, so
 * two people adding a class to the same element produce the same line.
 */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 90,
  tabWidth: 2,
  arrowParens: "always",
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
