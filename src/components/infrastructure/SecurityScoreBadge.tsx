interface SecurityScoreBadgeProps {
  score: number;
}

const SecurityScoreBadge = ({ score }: SecurityScoreBadgeProps) => {
  let colorClass: string;
  if (score >= 80) {
    colorClass = 'bg-[#00D4AA]/20 text-[#00D4AA]';
  } else if (score >= 60) {
    colorClass = 'bg-yellow-500/20 text-yellow-400';
  } else if (score >= 40) {
    colorClass = 'bg-orange-500/20 text-orange-400';
  } else {
    colorClass = 'bg-red-500/20 text-red-400';
  }

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${colorClass}`}>
      {score}
    </span>
  );
};

export default SecurityScoreBadge;
