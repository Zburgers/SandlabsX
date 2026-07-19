import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props });

export const DashboardIcon = (props: IconProps) => <svg {...base(props)}><path d="M4 5.5h6v5H4zM14 5.5h6v9h-6zM4 14.5h6v4H4zM14 18.5h6" /></svg>;
export const CapsuleIcon = (props: IconProps) => <svg {...base(props)}><path d="M8 4h8l4 7-4 8H8l-4-8 4-7Z" /><path d="m8 4 4 7 4-7M4 11h16M8 19l4-8 4 8" /></svg>;
export const ScenarioIcon = (props: IconProps) => <svg {...base(props)}><path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" /></svg>;
export const AssignmentIcon = (props: IconProps) => <svg {...base(props)}><path d="M8 5h11v15H8zM5 8H3v12h11M11 9h5M11 13h5M11 17h3" /></svg>;
export const ImageIcon = (props: IconProps) => <svg {...base(props)}><path d="M4 7 12 3l8 4-8 4-8-4Z" /><path d="m4 12 8 4 8-4M4 17l8 4 8-4" /></svg>;
export const AccountIcon = (props: IconProps) => <svg {...base(props)}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
export const MenuIcon = (props: IconProps) => <svg {...base(props)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const CloseIcon = (props: IconProps) => <svg {...base(props)}><path d="m6 6 12 12M18 6 6 18" /></svg>;
export const ArrowIcon = (props: IconProps) => <svg {...base(props)}><path d="M5 12h14M14 7l5 5-5 5" /></svg>;
export const PlusIcon = (props: IconProps) => <svg {...base(props)}><path d="M12 5v14M5 12h14" /></svg>;
export const SearchIcon = (props: IconProps) => <svg {...base(props)}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>;
