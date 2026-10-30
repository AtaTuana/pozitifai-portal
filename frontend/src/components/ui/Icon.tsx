const paths = {
  rejections:
    'M21 11a8 8 0 0 1-8 8H7l-4 3v-6a8 8 0 0 1-1-4 9 9 0 0 1 9-9h2a8 8 0 0 1 8 8ZM7 12v2m4-6v6m4-4v4',
  headset: 'M4 13V10a8 8 0 0 1 16 0v3M4 11H2v7h4v-7H4Zm16 0h2v7h-4v-7h2Zm0 7v2a2 2 0 0 1-2 2h-5',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  plan: 'M3 3h6v6H3zM15 3h6v6h-6zM9 15h6v6H9zM6 9v3h12V9m-6 3v3',
  users:
    'M14 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 21v-3a7 7 0 0 1 14 0v3m0-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4',
  agent: 'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-3a7 7 0 0 1 14 0v3',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  undo: 'M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5',
  redo: 'M20 10H10a6 6 0 0 0 0 12m10-12-5-5m5 5-5 5',
  fit: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7m4-7v7',
  logout: 'M10 4H4v16h6m4-14 6 6-6 6m-6-6h12',
  menu: 'M4 6h16M4 12h16M4 18h16',
  check: 'm5 12 4 4L19 6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 14v7h16v-7',
  campaign: 'm4 10 14-6v16L4 14zm0 0v4m3 1 2 6h3l-2-5m11-7 2-1m-2 7 2 1',
  link: 'm10 13 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
};

export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
