// dHealth
// Minimal geometric tooth glyph rendered inline so it inherits currentColor
// and stays crisp at any size. Paired with a hairline ring for a machined feel.
export default function Logo({ className = '' }) {
  return (
    <img
      src="/logo.avif"
      alt="Clinic Logo"
      className={`${className} object-contain`}
    />
  );
}
