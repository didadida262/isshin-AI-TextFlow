import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faClapperboard,
  faComments,
  faBell,
  faGear,
  faRightFromBracket,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import AppLogo from "../assets/AppLogo";
import type { AppNav, AuthUser } from "../types";
import { useI18n } from "../contexts/I18nContext";
import { LanguageToggle } from "./LanguageToggle";

const SIDEBAR_EXPANDED = 280;
const SIDEBAR_COLLAPSED = 72;

interface SidebarProps {
  user: AuthUser;
  activeNav: AppNav;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavChange: (nav: AppNav) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  notificationCount?: number;
  notificationShakeTick?: number;
  onLogout: () => void;
}

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
const widthTransition = { type: "tween" as const, duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

const navItems: { id: AppNav; labelKey: string; icon: typeof faComments }[] = [
  { id: "creation", labelKey: "nav.creation", icon: faClapperboard },
  { id: "session", labelKey: "nav.session", icon: faComments },
];

export function Sidebar({
  user,
  activeNav,
  collapsed,
  onToggleCollapsed,
  onNavChange,
  onOpenSettings,
  onOpenNotifications,
  notificationCount = 0,
  notificationShakeTick = 0,
  onLogout,
}: SidebarProps) {
  const { t } = useI18n();
  const toggleLabel = collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar");
  const [bellShaking, setBellShaking] = useState(false);
  const prevShakeTickRef = useRef(0);

  useEffect(() => {
    if (notificationShakeTick <= prevShakeTickRef.current) return;
    prevShakeTickRef.current = notificationShakeTick;
    setBellShaking(true);
    const timer = window.setTimeout(() => setBellShaking(false), 1300);
    return () => window.clearTimeout(timer);
  }, [notificationShakeTick]);

  const bellIconClass = `text-sm origin-top ${bellShaking ? "animate-bell-shake" : ""}`;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
      transition={widthTransition}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#0a0a0a]"
    >
      <div
        className={`flex shrink-0 items-center border-b border-white/5 py-4 ${
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        }`}
      >
        <AppLogo
          className={`shrink-0 ${collapsed ? "h-10 w-10" : "h-11 w-11"}`}
          title={t("auth.title")}
        />
        {!collapsed && (
          <span className="min-w-0 flex-1 text-base font-semibold leading-tight tracking-wide">
            {t("auth.title")}
          </span>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={toggleLabel}
            aria-label={toggleLabel}
            className="shrink-0 rounded-md p-1.5 text-text-muted transition hover:bg-white/5 hover:text-white"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center border-b border-white/5 py-2">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={toggleLabel}
            aria-label={toggleLabel}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-white/5 hover:text-white"
          >
            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
          </button>
        </div>
      )}

      <nav className={`flex-1 space-y-1 py-3 ${collapsed ? "px-1.5" : "px-2"}`}>
        {navItems.map((item) => {
          const active = activeNav === item.id;
          const label = t(item.labelKey);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavChange(item.id)}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={`relative flex w-full items-center rounded-lg py-2.5 text-sm font-medium transition ${
                collapsed ? "justify-center px-0" : "gap-2.5 px-3"
              } ${active ? "text-white" : "text-text-muted hover:text-white"}`}
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
                className={`relative z-10 text-sm ${active ? "text-accent" : ""}`}
              />
              {!collapsed && <span className="relative z-10">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className={`pb-3 pt-3 ${collapsed ? "px-1.5" : "px-3"}`}>
        <div className={`-mx-3 mb-3 h-px bg-white/10 ${collapsed ? "mx-0" : ""}`} aria-hidden />

        <div
          className={`mb-3 flex overflow-hidden rounded-xl border border-white/10 bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${
            collapsed ? "flex-col" : ""
          }`}
        >
          <button
            type="button"
            onClick={onOpenNotifications}
            title={t("nav.notifications")}
            aria-label={t("nav.notifications")}
            className={`relative flex items-center justify-center text-text-muted transition hover:bg-white/5 hover:text-white ${
              collapsed ? "border-b border-white/5 py-2.5" : "border-r border-white/5 flex-1 py-2.5"
            }`}
          >
            <FontAwesomeIcon icon={faBell} className={bellIconClass} />
            {notificationCount > 0 ? (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </button>
          <LanguageToggle
            compact={collapsed}
            className={collapsed ? "border-b border-white/5" : "border-r border-white/5"}
          />
          <button
            type="button"
            onClick={onOpenSettings}
            title={t("nav.settings")}
            aria-label={t("nav.settings")}
            className={`flex items-center justify-center text-text-muted transition hover:bg-white/5 hover:text-white ${
              collapsed ? "py-2.5" : "flex-1 py-2.5"
            }`}
          >
            <FontAwesomeIcon icon={faGear} className="text-sm" />
          </button>
        </div>

        {collapsed ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-surface py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <FontAwesomeIcon icon={faUser} className="text-xs" />
            </div>
            <button
              type="button"
              onClick={onLogout}
              title={t("auth.logout")}
              aria-label={t("auth.logout")}
              className="rounded-md p-1.5 text-text-muted transition hover:bg-white/5 hover:text-white"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="text-xs" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-surface px-2.5 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <FontAwesomeIcon icon={faUser} className="text-xs" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {user.displayName}
              </p>
              <p className="truncate text-[11px] text-text-muted">
                @{user.username}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title={t("auth.logout")}
              aria-label={t("auth.logout")}
              className="shrink-0 rounded-md p-1.5 text-text-muted transition hover:bg-white/5 hover:text-white"
            >
              <FontAwesomeIcon icon={faRightFromBracket} className="text-xs" />
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
