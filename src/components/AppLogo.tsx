import appLogoSrc from "../assets/270226c058e3f12ad7bb9e96e3b029bc0e2c0461.png";
import styles from "./AppLogo.module.css";

export type AppLogoVariant = "titlebar" | "hero";

export type AppLogoProps = {
  /** 默认 titlebar：锁死与 Figma Shell 一致的裁切与混色 */
  variant?: AppLogoVariant;
  /** 仅透传到根节点，便于外层布局（如 rtl） */
  className?: string;
  alt?: string;
};

/**
 * 应用图标唯一入口：资源路径与样式与 Figma `Shell.tsx` 标题栏块对齐。
 * 资源文件：`src/assets/270226c058e3f12ad7bb9e96e3b029bc0e2c0461.png`（与 PRD / project-context 登记的 source of truth 同名）。
 */
export function AppLogo({ variant = "titlebar", className, alt = "ClawScope" }: AppLogoProps) {
  if (variant === "hero") {
    return (
      <img
        src={appLogoSrc}
        alt={alt}
        className={`${styles.heroImg} ${className ?? ""}`.trim()}
        width={192}
        height={192}
        draggable={false}
      />
    );
  }

  return (
    <div className={`${styles.titlebarWrap} ${className ?? ""}`.trim()}>
      <img
        src={appLogoSrc}
        alt={alt}
        className={styles.titlebarImg}
        draggable={false}
      />
    </div>
  );
}

export const APP_LOGO_ASSET_URL = appLogoSrc;
