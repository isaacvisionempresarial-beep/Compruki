import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "panel"
  | "orders"
  | "catalog"
  | "store"
  | "people"
  | "chart"
  | "link"
  | "settings"
  | "logout"
  | "menu"
  | "close"
  | "check"
  | "search"
  | "spark"
  | "bag"
  | "sync"
  | "chat";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

const paths: Record<IconName, ReactNode> = {
  panel: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  orders: (
    <>
      <path d="M7.2 3.8h6.6l4 4V19a1.6 1.6 0 0 1-1.6 1.6H7.2A1.6 1.6 0 0 1 5.6 19V5.4A1.6 1.6 0 0 1 7.2 3.8Z" />
      <path d="M13.5 3.9V8h4M8.2 12.2h7.2M8.2 15.6h4.8" />
    </>
  ),
  catalog: (
    <>
      <path d="M12.2 3.8 20.2 11.8 12.2 19.8 4.2 11.8V5.8a2 2 0 0 1 2-2h6Z" />
      <path d="M8.4 8.4h.01" />
    </>
  ),
  store: (
    <>
      <path d="M4 10.2 5.4 4.8h13.2L20 10.2" />
      <path d="M4 10.2h16V19a1.2 1.2 0 0 1-1.2 1.2H5.2A1.2 1.2 0 0 1 4 19v-8.8Z" />
      <path d="M9.2 20.2v-5.2h5.6v5.2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="9" r="2.6" />
      <path d="M4.4 18.6c.5-2.5 2.2-3.8 4.6-3.8s4.1 1.3 4.6 3.8" />
      <circle cx="16.4" cy="9.4" r="2.1" />
      <path d="M15.2 14.9c1.7.2 3 1.2 3.6 3.7" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19.2h16" />
      <path d="M7.5 19.2v-5.2" />
      <path d="M12 19.2V7.6" />
      <path d="M16.5 19.2v-7.4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.2 13.8 9.4" />
      <path d="M9.2 16.2 7.6 17.8a3.1 3.1 0 0 1-4.4-4.4l2.4-2.4a3.1 3.1 0 0 1 4.4 0" />
      <path d="M14.8 7.8 16.4 6.2a3.1 3.1 0 0 1 4.4 4.4l-2.4 2.4a3.1 3.1 0 0 1-4.4 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.6v2.1M12 18.3v2.1M3.6 12h2.1M18.3 12h2.1M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5" />
    </>
  ),
  logout: (
    <>
      <path d="M10 7.2V5.6A1.6 1.6 0 0 1 11.6 4h6.8A1.6 1.6 0 0 1 20 5.6v12.8a1.6 1.6 0 0 1-1.6 1.6h-6.8a1.6 1.6 0 0 1-1.6-1.6v-1.6" />
      <path d="M4 12h10" />
      <path d="M11.2 8.8 14.4 12l-3.2 3.2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5 9.2 16.5 19 7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.2" />
      <path d="M16 16.2 20 20.2" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3.5 13.6 8.4 18.5 10 13.6 11.6 12 16.5 10.4 11.6 5.5 10 10.4 8.4 12 3.5Z" />
      <path d="M18 14.2 18.7 16.3 20.8 17 18.7 17.7 18 19.8 17.3 17.7 15.2 17 17.3 16.3 18 14.2Z" />
    </>
  ),
  bag: (
    <>
      <path d="M6.2 8.2h11.6l-.8 11.2a1.4 1.4 0 0 1-1.4 1.3H8.4a1.4 1.4 0 0 1-1.4-1.3L6.2 8.2Z" />
      <path d="M9 8.2V6.8A3 3 0 0 1 12 3.8 3 3 0 0 1 15 6.8v1.4" />
    </>
  ),
  sync: (
    <>
      <path d="M20 8.2A8 8 0 0 0 6.5 6.2" />
      <path d="M4 4.4v4h4" />
      <path d="M4 15.8a8 8 0 0 0 13.5 2" />
      <path d="M20 19.6v-4h-4" />
    </>
  ),
  chat: (
    <>
      <path d="M5.2 5.2h13.6A1.6 1.6 0 0 1 20.4 6.8v8.2a1.6 1.6 0 0 1-1.6 1.6H10l-3.8 3.2V16.6H5.2A1.6 1.6 0 0 1 3.6 15V6.8A1.6 1.6 0 0 1 5.2 5.2Z" />
      <path d="M8 9.4h8M8 12.4h5.2" />
    </>
  ),
};
