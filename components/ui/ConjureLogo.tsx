interface ConjureLogoProps {
  size?: number;
}

export default function ConjureLogo({ size = 18 }: ConjureLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className="shrink-0"
    >
      <rect width="32" height="32" rx="6" fill="#18181B" />
      <path
        d="M21 10 L15 10 Q11 10 11 14 L11 18 Q11 22 15 22 L21 22"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M25 4 L25.7 6 L27.7 6.7 L25.7 7.4 L25 9.4 L24.3 7.4 L22.3 6.7 L24.3 6 Z"
        fill="#A78BFA"
      />
    </svg>
  );
}
