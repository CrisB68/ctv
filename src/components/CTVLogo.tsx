import React, { useState } from "react";

interface CTVLogoProps {
  size?: number | string;
  className?: string;
  showText?: boolean;
}

export default function CTVLogo({ size = 44, className = "", showText = true }: CTVLogoProps) {
  const [imgSrc, setImgSrc] = useState<string | null>("/logo_CTV.png");

  // Se o usuário colocar o arquivo de imagem logo_CTV.png ou LOGO_CTV.png na pasta public
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt="Logo CTV - Centro de Terapias Vibracionais"
        className={`object-contain shrink-0 ${className}`}
        style={{ width: typeof size === "number" ? `${size}px` : size, height: typeof size === "number" ? `${size}px` : size }}
        onError={() => {
          if (imgSrc === "/logo_CTV.png") {
            setImgSrc("/LOGO_CTV.png");
          } else {
            setImgSrc(null);
          }
        }}
      />
    );
  }

  // Renderização Vetorial SVG de alta fidelidade
  return (
    <svg
      viewBox="0 0 500 500"
      className={`shrink-0 select-none ${className}`}
      style={{ width: typeof size === "number" ? `${size}px` : size, height: typeof size === "number" ? `${size}px` : size }}
      aria-label="Centro de Terapias Vibracionais - Natal RN Brasil"
    >
      <defs>
        {/* Arco do texto superior */}
        <path id="ctv-top-arc" d="M 50,250 A 200,200 0 0,1 450,250" fill="none" />
        {/* Arco do texto inferior */}
        <path id="ctv-bot-arc" d="M 80,250 A 170,170 0 0,0 420,250" fill="none" />
      </defs>

      {/* Texto circular superior */}
      {showText && (
        <text fill="#1F2937" fontSize="23" fontWeight="800" letterSpacing="5" fontFamily="system-ui, -apple-system, sans-serif">
          <textPath href="#ctv-top-arc" startOffset="50%" textAnchor="middle">
            CENTRO DE TERAPIAS VIBRACIONAIS
          </textPath>
        </text>
      )}

      {/* Texto circular inferior */}
      {showText && (
        <text fill="#1F2937" fontSize="24" fontWeight="800" letterSpacing="6" fontFamily="system-ui, -apple-system, sans-serif">
          <textPath href="#ctv-bot-arc" startOffset="50%" textAnchor="middle">
            NATAL . RN . BRASIL
          </textPath>
        </text>
      )}

      {/* 3 Órbitas Elípticas Verdes */}
      <g stroke="#3BA755" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="250" cy="250" rx="72" ry="152" transform="rotate(-30 250 250)" />
        <ellipse cx="250" cy="250" rx="72" ry="152" transform="rotate(30 250 250)" />
        <ellipse cx="250" cy="250" rx="72" ry="152" transform="rotate(90 250 250)" />
      </g>

      {/* Núcleo Central Yin-Yang (+ e -) */}
      <g transform="translate(250, 250)">
        {/* Círculo base de corte */}
        <circle cx="0" cy="0" r="36" fill="#111111" />
        {/* Metade Vermelha */}
        <path
          d="M 0,-36 A 36,36 0 0,1 0,36 A 18,18 0 0,1 0,0 A 18,18 0 0,0 0,-36 Z"
          fill="#E53935"
        />
        {/* Símbolo + (positivo) na área vermelha */}
        <text x="0" y="-12" fill="#111111" fontSize="18" fontWeight="900" textAnchor="middle" dominantBaseline="central">
          +
        </text>
        {/* Símbolo - (negativo) na área preta */}
        <text x="0" y="14" fill="#FFFFFF" fontSize="22" fontWeight="900" textAnchor="middle" dominantBaseline="central">
          -
        </text>
      </g>

      {/* Nó C */}
      <g transform="translate(126, 328)">
        <circle cx="0" cy="0" r="24" fill="#111111" stroke="#FFFFFF" strokeWidth="2.5" />
        <text x="0" y="2" fill="#FFFFFF" fontSize="24" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
          C
        </text>
      </g>

      {/* Nó T */}
      <g transform="translate(250, 396)">
        <circle cx="0" cy="0" r="24" fill="#111111" stroke="#FFFFFF" strokeWidth="2.5" />
        <text x="0" y="2" fill="#FFFFFF" fontSize="24" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
          T
        </text>
      </g>

      {/* Nó V */}
      <g transform="translate(374, 328)">
        <circle cx="0" cy="0" r="24" fill="#111111" stroke="#FFFFFF" strokeWidth="2.5" />
        <text x="0" y="2" fill="#FFFFFF" fontSize="24" fontWeight="900" textAnchor="middle" dominantBaseline="central" fontFamily="system-ui, sans-serif">
          V
        </text>
      </g>
    </svg>
  );
}
