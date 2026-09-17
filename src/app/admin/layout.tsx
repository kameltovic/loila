// Private page: excluded from Umami session replays (block selector ".umami-block").
export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  return <div className="umami-block">{children}</div>;
}
