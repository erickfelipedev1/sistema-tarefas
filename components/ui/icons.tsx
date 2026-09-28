// Conjunto de ícones lineares próprios (sem dependência externa), no
// mesmo estilo em todo o sistema: traço fino, cantos arredondados.
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function createIcon(displayName: string, children: React.ReactNode) {
  function IconComponent({ className = "h-4 w-4", ...props }: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    );
  }
  IconComponent.displayName = displayName;
  return IconComponent;
}

export const ClipboardListIcon = createIcon(
  "ClipboardListIcon",
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 10.5h6M9 14h6M9 17.5h3" />
  </>
);

export const CalendarIcon = createIcon(
  "CalendarIcon",
  <>
    <rect x="3.5" y="5" width="17" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </>
);

export const BookOpenIcon = createIcon(
  "BookOpenIcon",
  <>
    <path d="M4 5.5C5.5 4.5 8 4 12 5.5V19c-4-1.5-6.5-1-8 0V5.5Z" />
    <path d="M20 5.5C18.5 4.5 16 4 12 5.5V19c4-1.5 6.5-1 8 0V5.5Z" />
  </>
);

export const FolderIcon = createIcon(
  "FolderIcon",
  <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h4l2 2.5h7A1.5 1.5 0 0 1 20 9v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-11Z" />
);

export const FileTextIcon = createIcon(
  "FileTextIcon",
  <>
    <path d="M7 3h7l4 4v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4.5A1.5 1.5 0 0 1 7 3Z" />
    <path d="M14 3v4h4" />
    <path d="M9 12.5h6M9 16h4" />
  </>
);

export const FileBadgeIcon = createIcon(
  "FileBadgeIcon",
  <>
    <path d="M7 3h7l4 4v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4.5A1.5 1.5 0 0 1 7 3Z" />
    <path d="M14 3v4h4" />
    <rect x="8" y="12.5" width="8" height="4.5" rx="1" />
  </>
);

export const FileGridIcon = createIcon(
  "FileGridIcon",
  <>
    <path d="M7 3h7l4 4v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4.5A1.5 1.5 0 0 1 7 3Z" />
    <path d="M14 3v4h4" />
    <path d="M8.5 12h7M8.5 15.5h7M11.5 12v6" />
  </>
);

export const FileSlideIcon = createIcon(
  "FileSlideIcon",
  <>
    <path d="M7 3h7l4 4v13a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4.5A1.5 1.5 0 0 1 7 3Z" />
    <path d="M14 3v4h4" />
    <path
      d="M9.5 12.3v4.4l4-2.2-4-2.2Z"
      fill="currentColor"
      stroke="none"
    />
  </>
);

export const FileStackIcon = createIcon(
  "FileStackIcon",
  <>
    <path d="M7 3h7l4 4v10a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 17V4.5A1.5 1.5 0 0 1 7 3Z" />
    <path d="M14 3v4h4" />
  </>
);

export const LinkIcon = createIcon(
  "LinkIcon",
  <>
    <path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L10.8 7.5" />
    <path d="M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </>
);

export const InboxIcon = createIcon(
  "InboxIcon",
  <>
    <path d="M4 12h4.2l1.3 2.5h4.9L15.8 12H20" />
    <path d="M4.5 12 6 5.8A1.5 1.5 0 0 1 7.5 4.5h9A1.5 1.5 0 0 1 18 5.8L19.5 12" />
    <path d="M4 12v5.5A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5V12" />
  </>
);

export const SendIcon = createIcon(
  "SendIcon",
  <path d="m4 11 16-7-6 16-2.5-7L4 11Z" />
);

export const MessageCircleIcon = createIcon(
  "MessageCircleIcon",
  <path d="M12 4c4.97 0 9 3.31 9 7.4 0 4.09-4.03 7.4-9 7.4-1.02 0-2-.13-2.9-.38L4.5 20l1.2-3.6C4.65 15 3 13.3 3 11.4 3 7.31 7.03 4 12 4Z" />
);

export const SearchIcon = createIcon(
  "SearchIcon",
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.8-3.8" />
  </>
);

export const SlidersIcon = createIcon(
  "SlidersIcon",
  <>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h12M20 18h0" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="7" cy="12" r="2" />
    <circle cx="16" cy="18" r="2" />
  </>
);

export const PlusIcon = createIcon("PlusIcon", <path d="M12 5v14M5 12h14" />);

export const MoreVerticalIcon = createIcon(
  "MoreVerticalIcon",
  <>
    <circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />
  </>
);

export const Trash2Icon = createIcon(
  "Trash2Icon",
  <>
    <path d="M4 7h16" />
    <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    <path d="M10 11v6M14 11v6" />
  </>
);

export const PencilIcon = createIcon(
  "PencilIcon",
  <path d="M4 20l1-4.2L15.6 5.2a1.6 1.6 0 0 1 2.3 0l1 1a1.6 1.6 0 0 1 0 2.3L8.2 19 4 20Z" />
);

export const UserIcon = createIcon(
  "UserIcon",
  <>
    <circle cx="12" cy="8" r="3.3" />
    <path d="M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5" />
  </>
);

export const LogOutIcon = createIcon(
  "LogOutIcon",
  <>
    <path d="M9 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H9" />
    <path d="M14 16l4-4-4-4" />
    <path d="M18 12H9" />
  </>
);

export const XIcon = createIcon("XIcon", <path d="M6 6l12 12M18 6 6 18" />);

export const AlertTriangleIcon = createIcon(
  "AlertTriangleIcon",
  <>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4.2" />
    <circle cx="12" cy="17.1" r="0.9" fill="currentColor" stroke="none" />
  </>
);

export const CheckCircleIcon = createIcon(
  "CheckCircleIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.2 2.3 2.3 4.7-4.7" />
  </>
);

export const ClockIcon = createIcon(
  "ClockIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>
);

export const SparklesIcon = createIcon(
  "SparklesIcon",
  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15ZM19 14l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" />
);

export const ChevronLeftIcon = createIcon(
  "ChevronLeftIcon",
  <path d="m14.5 5-7 7 7 7" />
);
export const ChevronRightIcon = createIcon(
  "ChevronRightIcon",
  <path d="m9.5 5 7 7-7 7" />
);
export const ChevronDownIcon = createIcon(
  "ChevronDownIcon",
  <path d="m5 8.5 7 7 7-7" />
);

export const MenuIcon = createIcon(
  "MenuIcon",
  <path d="M4 6h16M4 12h16M4 18h16" />
);

export const SmileIcon = createIcon(
  "SmileIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14c.9 1.2 2 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
    <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </>
);

export const CopyIcon = createIcon(
  "CopyIcon",
  <>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
    <path d="M15 8.5V6.5A1.5 1.5 0 0 0 13.5 5h-8A1.5 1.5 0 0 0 4 6.5v8A1.5 1.5 0 0 0 5.5 16h2" />
  </>
);

export const CircleDotIcon = createIcon(
  "CircleDotIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none" />
  </>
);

export const BellIcon = createIcon(
  "BellIcon",
  <>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
    <path d="M10 18.5a2 2 0 0 0 4 0" />
  </>
);

export const SunIcon = createIcon(
  "SunIcon",
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </>
);

export const MoonIcon = createIcon(
  "MoonIcon",
  <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
);

export const GlobeIcon = createIcon(
  "GlobeIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </>
);

export const LockIcon = createIcon(
  "LockIcon",
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 1 1 8 0v4" />
  </>
);

export const BuildingIcon = createIcon(
  "BuildingIcon",
  <>
    <rect x="4" y="3.5" width="11" height="17" rx="1" />
    <path d="M8 8h3M8 11.5h3M8 15h3" />
    <path d="M15 9.5h4.5a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H15" />
    <path d="M17.3 13h.01M17.3 16h.01" />
  </>
);

export const TargetIcon = createIcon(
  "TargetIcon",
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.8" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </>
);

export const ReceiptIcon = createIcon(
  "ReceiptIcon",
  <>
    <path d="M6 3h12v18l-2.5-1.5L13 21l-1-1.5L11 21l-2.5-1.5L6 21V3Z" />
    <path d="M9 8h6M9 11.5h6M9 15h4" />
  </>
);

export const HomeIcon = createIcon(
  "HomeIcon",
  <>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9.5a1 1 0 0 0 1 1h3.5v-6h3v6H17a1 1 0 0 0 1-1V10" />
  </>
);

export const UsersIcon = createIcon(
  "UsersIcon",
  <>
    <circle cx="9" cy="8.3" r="3" />
    <path d="M3 19c1-3.2 3.4-4.9 6-4.9s5 1.7 6 4.9" />
    <path d="M15.5 5.2a3 3 0 0 1 0 5.9" />
    <path d="M18 14.4c2 .6 3.4 2.1 4 4.6" />
  </>
);
