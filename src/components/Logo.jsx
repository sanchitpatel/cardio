// Dr. Pragya Dental Studio — tooth monogram mark.
// Minimal geometric tooth glyph rendered inline so it inherits currentColor
// and stays crisp at any size. Paired with a hairline ring for a machined feel.
export default function Logo({ className = '' }) {
  return (
    <img
      src="/logo.png"
      alt="Clinic Logo"
      className={`${className} object-contain`}
    />
  );
}
