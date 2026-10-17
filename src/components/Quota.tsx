import { quotaUsedToday } from "../lib/db";
import { QUOTA_LIMIT, isDemo } from "../lib/youtube";

export default function Quota() {
  if (isDemo) return <span className="quota">Demo data. Add YOUTUBE_API_KEY for real channels.</span>;
  const used = quotaUsedToday();
  return (
    <span className="quota" title="Searches cost 100 units; channel loads cost about 5.">
      {used.toLocaleString()} of {QUOTA_LIMIT.toLocaleString()} API units used today
    </span>
  );
}
