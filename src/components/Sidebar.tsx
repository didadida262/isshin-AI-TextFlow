import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComments,
  faGear,
  faPenToSquare,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";
import type { AppNav } from "../types";
import { useI18n } from "../contexts/I18nContext";
import { LanguageToggle } from "./LanguageToggle";

interface SidebarProps {
  activeNav: AppNav;
  onNavChange: (nav: AppNav) => void;
  onOpenSettings: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const navItems: { id: AppNav; labelKey: string; icon: typeof faComments }[] = [
  { id: "creation", labelKey: "nav.creation", icon: faPenToSquare },
  { id: "session", labelKey: "nav.session", icon: faComments },
];

export function Sidebar({
  activeNav,
  onNavChange,
  onOpenSettings,
}: SidebarProps) {
  const { t } = useI18n();
  return (
    <aside className="flex h-full w-44 flex-col border-r border-white/5 bg-[#0a0a0a]">
      <motion.div
        className="flex items-center gap-2 border-b border-white/5 px-4 py-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <FontAwesomeIcon icon={faVideo} className="text-accent text-lg" />
        <span className="text-sm font-semibold tracking-wide">TextFlow</span>
      </motion.div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavChange(item.id)}
              className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "text-white" : "text-text-muted hover:text-white"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-nav"
                  className="absolute inset-0 rounded-lg bg-white/10"
                  transition={spring}
                />
              )}
              <FontAwesomeIcon
                icon={item.icon}
                className={`relative z-10 text-xs ${active ? "text-accent" : ""}`}
              />
              <span className="relative z-10">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>

      <motion.div
        className="border-t border-white/5 px-2 pb-3 pt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex overflow-hidden rounded-xl border border-white/10 bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <LanguageToggle className="border-r border-white/5" />
          <button
            type="button"
            onClick={onOpenSettings}
            title={t("nav.settings")}
            aria-label={t("nav.settings")}
            className="flex flex-1 items-center justify-center py-2.5 text-text-muted transition hover:bg-white/5 hover:text-white"
          >
            <FontAwesomeIcon icon={faGear} className="text-sm" />
          </button>
        </div>
      </motion.div>
    </aside>
  );
}
