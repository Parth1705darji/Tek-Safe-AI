import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
}

interface SkillSelectorProps {
  activeSkills: string[];
  onChange: (slugs: string[]) => void;
}

const SkillSelector = ({ activeSkills, onChange }: SkillSelectorProps) => {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch('/api/admin/skills')
      .then(r => r.ok ? r.json() : { skills: [] })
      .then(d => setSkills(d.skills ?? []))
      .catch(() => {});
  }, []);

  if (skills.length === 0) return null;

  const toggle = (slug: string) => {
    onChange(
      activeSkills.includes(slug)
        ? activeSkills.filter(s => s !== slug)
        : [...activeSkills, slug]
    );
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-1">
      <Zap className="h-3.5 w-3.5 text-gray-500 shrink-0" />
      {skills.map(skill => {
        const active = activeSkills.includes(skill.slug);
        return (
          <button
            key={skill.slug}
            type="button"
            onClick={() => toggle(skill.slug)}
            title={skill.description}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150 border ${
              active
                ? 'border-transparent text-white'
                : 'border-gray-700 bg-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
            style={active ? { backgroundColor: skill.color, borderColor: skill.color } : {}}
          >
            <span>{skill.icon}</span>
            {skill.name}
          </button>
        );
      })}
    </div>
  );
};

export default SkillSelector;
